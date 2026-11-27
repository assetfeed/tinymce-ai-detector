/**
 * AI writing check for Tiptap (2 and 3), by AssetFeed (https://assetfeed.com/ai-content-detector).
 *
 * The extension sends the editor's text to the AssetFeed AI detector and marks the answer next to the text: a side bar per
 * passage (orange: likely AI, amber: unsure, green: likely human), a tint behind strong passages and a card on hover.
 * The marks are drawn in a layer beside the editable element, not in the document, so nothing reaches getHTML(), getJSON()
 * or the undo history.
 *
 *   extensions: [StarterKit, AiDetector.configure({ endpoint: '/my-proxy/ai-check' })]
 *   editor.commands.checkAiWriting()
 */

import { Extension } from '@tiptap/core'
import { DEFAULT_ENDPOINT, DetectorError, ERRORS, errorLinks, isDark, requestCheck } from '@assetfeed/ai-detector-core/api.js'
import { VIEWS, createBar } from '@assetfeed/ai-detector-core/bar.js'
import { createCard } from '@assetfeed/ai-detector-core/card.js'
import { MarkPainter, layerCss } from '@assetfeed/ai-detector-core/layer.js'
import { collectBlocks, kindOf, marksFor, percent } from '@assetfeed/ai-detector-core/marks.js'
import { format, joinBlocks, opaque } from './text.js'

export { DEFAULT_ENDPOINT }

const LINKS = errorLinks('tiptap-ai-detector')

const NOTICE_CSS = `
.aid-notice { box-sizing: border-box; padding: 6px 8px; font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; color: #111827; }
.aid-notice.is-dark { color: #eceef1; }
.aid-notice--error { color: oklch(55.3% 0.195 38.402); }
.aid-notice.is-dark.aid-notice--error { color: oklch(75% 0.183 55.934); }
.aid-notice a { color: inherit; text-decoration: underline; }
`

const t = format
const cleanups = new WeakMap() // editor -> its teardown, since onCreate and onDestroy get separate contexts

export const AiDetector = Extension.create({
    name: 'aiDetector',

    addOptions() {
        return {
            /** Where the text is posted as { text }. Your server route adds the API key (recommended). */
            endpoint: DEFAULT_ENDPOINT,
            /** Sent as X-Api-Token. Only for internal tools: the key is visible in the page. */
            apiKey: '',
            /** async ({ text }) => answer: your own transport. Return the data object of the API answer. */
            request: null,
            /** Render the bar right after the editor element. false for your own controls (see editor.storage.aiDetector). */
            bar: true,
            /** (result) => void, after each answer. */
            onResult: null,
            /** (storage) => void, after every change of the state, view or notice. */
            onChange: null,
            /** ({ message, type, link }) => void, to show messages yourself. By default they appear under the bar. */
            onNotice: null,
        }
    },

    addStorage() {
        return {
            /** idle | busy | ok | stale */
            status: 'idle',
            /** The data object of the last answer that is still current, else null. */
            result: null,
            /** ai | unsure | human of the current answer, else null. */
            kind: null,
            /** The share of AI text of the current answer, 0 to 100. */
            percent: 0,
            /** highlight | bars | off */
            view: 'highlight',
            checkedAt: null,
            /** The last message { message, type, link }, null when there is none. */
            notice: null,
            /** check() returns a promise that settles when the check is over. */
            check: async () => {},
            clear: () => {},
            setView: () => {},
        }
    },

    addCommands() {
        return {
            // Side effects only when the command really runs: editor.can() calls commands without dispatch.
            checkAiWriting: () => ({ dispatch }) => {
                if (dispatch) {
                    this.storage.check()
                }

                return true
            },
            clearAiMarks: () => ({ dispatch }) => {
                if (dispatch) {
                    this.storage.clear()
                }

                return true
            },
            setAiMarksView: (view) => ({ dispatch }) => {
                if (!VIEWS.includes(view)) {
                    return false
                }

                if (dispatch) {
                    this.storage.setView(view)
                }

                return true
            },
        }
    },

    onCreate() {
        const editor = this.editor
        const storage = this.storage
        const options = this.options

        let busy = false
        let shown = 'highlight' // the view the marks toggle brings back
        let stale = false // the text changed after the last answer
        let answered = '' // the text of the current answer
        let marks = null
        let painter = null
        let card = null
        let bar = null
        let noticeEl = null
        let noticeTimer = 0
        let dark = false
        let restore = null
        let destroyed = false

        const dom = () => editor.view?.dom
        const host = () => dom()?.parentElement

        async function send(text) {
            if (options.request) {
                return options.request({ text })
            }

            return requestCheck({ text, endpoint: options.endpoint, apiKey: options.apiKey, unreachable: t('Could not reach the AI detector.') })
        }

        function changed() {
            options.onChange?.(storage)
        }

        function renderNotice() {
            if (!bar || options.onNotice) {
                return
            }

            const n = storage.notice

            if (!n) {
                noticeEl?.remove()
                noticeEl = null
                return
            }

            if (!noticeEl) {
                noticeEl = bar.el.ownerDocument.createElement('div')
                bar.el.after(noticeEl)
            }

            noticeEl.className = `aid-notice aid-notice--${n.type}${isDark(dom()) ? ' is-dark' : ''}`
            noticeEl.setAttribute('role', n.type === 'error' ? 'alert' : 'status')
            noticeEl.textContent = n.message

            if (n.link) {
                const a = noticeEl.ownerDocument.createElement('a')

                a.href = n.link.href
                a.target = '_blank'
                a.rel = 'noopener'
                a.textContent = n.link.text
                noticeEl.append(' ', a)
            }
        }

        function dismiss() {
            clearTimeout(noticeTimer)

            if (storage.notice) {
                storage.notice = null
                renderNotice()
                changed()
            }
        }

        function notify(message, type = 'info', link = null) {
            clearTimeout(noticeTimer)
            storage.notice = { message, type, link: link ? { text: t(link.text), href: link.href } : null }
            options.onNotice?.(storage.notice)
            renderNotice()
            changed()

            if (!link) {
                noticeTimer = setTimeout(dismiss, 8000)
            }
        }

        /**
         * The layer beside the editable element, made on the first answer. The element is position:relative at z-index 1 so the
         * tints sit under the text: an opaque background moves from the element to its parent so it does not cover them.
         */
        function mount() {
            const el = dom()
            const parent = host()

            if (painter || !el || !parent) {
                return
            }

            const doc = el.ownerDocument
            const background = getComputedStyle(el).backgroundColor
            const style = doc.createElement('style')
            const previous = { parent: parent.style.cssText, el: el.style.cssText }

            dark = isDark(el)
            style.textContent = layerCss(dark)
            doc.head.appendChild(style)

            if (getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative'
            }

            el.style.position = 'relative'
            el.style.zIndex = '1'

            if (opaque(background)) {
                parent.style.background = background
                el.style.background = 'transparent'
            }

            const layer = doc.createElement('div')

            layer.className = 'aid-marks'
            layer.setAttribute('aria-hidden', 'true')
            el.before(layer)
            card = createCard(() => dark)
            painter = new MarkPainter({
                root: el,
                layer,
                t,
                onCard: card.show,
                place: () => {
                    const p = parent.getBoundingClientRect()
                    const x = p.left + parent.clientLeft - parent.scrollLeft
                    const y = p.top + parent.clientTop - parent.scrollTop

                    return { dx: -x, dy: -y, barX: Math.max(2, el.getBoundingClientRect().left - x - 10) }
                },
            })
            restore = () => {
                layer.remove()
                style.remove()
                parent.style.cssText = previous.parent
                el.style.cssText = previous.el
            }
        }

        function renderBar() {
            const el = dom()

            bar?.render({
                status: storage.status,
                kind: storage.kind,
                percent: storage.percent,
                view: storage.view,
                checkedAt: storage.checkedAt,
                dark: el ? isDark(el) : false,
            })
        }

        function setState() {
            storage.status = busy ? 'busy' : storage.result ? 'ok' : stale ? 'stale' : 'idle'
        }

        function paint() {
            const result = storage.result

            setState()
            storage.kind = result ? kindOf(result) ?? 'unsure' : null
            storage.percent = result ? percent(result.ai_fraction) : 0
            painter?.update({ marks: marks ?? [], windows: result?.windows, view: storage.view })
            renderBar()
            changed()
        }

        function setView(next) {
            storage.view = next
            shown = next === 'off' ? shown : next
            paint()
        }

        function clear() {
            stale = false
            storage.result = null
            storage.checkedAt = null
            marks = null
            paint()
        }

        async function check() {
            if (busy || destroyed || !dom()) {
                return
            }

            const blocks = collectBlocks(dom())

            if (blocks.length === 0) {
                notify(t('Add some text to check.'))
                return
            }

            const sent = joinBlocks(blocks)

            busy = true
            dismiss()
            paint()

            try {
                const result = await send(sent)

                // The editor went away, or its text changed (typing, setContent from code) while the answer was on its way: the
                // answer is for text that no longer exists, so it is dropped rather than drawn on the wrong blocks. Same text in
                // new elements is fine: the marks go on the blocks that are there now.
                const current = destroyed ? null : collectBlocks(dom())

                if (!current || joinBlocks(current) !== sent) {
                    return
                }

                if (result?.status === 'too_short') {
                    notify(t('The text is too short to check. Add a few more sentences.'))
                } else if (result?.status === 'unsupported_language') {
                    notify(t('Only English text can be checked for now.'))
                } else if (result?.status === 'ok') {
                    mount()
                    storage.view = storage.view === 'off' ? shown : storage.view
                    stale = false
                    answered = sent
                    storage.result = result
                    storage.checkedAt = new Date()
                    marks = marksFor(current, result)
                } else {
                    throw new DetectorError(0)
                }

                options.onResult?.(result)
            } catch (e) {
                if (!destroyed) {
                    const known = ERRORS[e?.status]

                    notify(known ? t(known) : e?.message || t('The AI check failed. Try again later.'), 'error', LINKS[e?.status])
                }
            } finally {
                busy = false

                if (!destroyed) {
                    paint()
                }
            }
        }

        // An answer is for the text it was given: the first edit after it drops the marks, and the bar asks for a recheck.
        // The same text in new elements (setContent with the same HTML) keeps the answer on the elements that are there now.
        const onTransaction = ({ transaction }) => {
            if (!storage.result || !transaction.docChanged) {
                return
            }

            const current = collectBlocks(dom())

            if (joinBlocks(current) === answered) {
                marks = marksFor(current, storage.result)
            } else {
                storage.result = null
                storage.checkedAt = null
                marks = null
                stale = true
            }

            paint()
        }

        storage.check = check
        storage.clear = clear
        storage.setView = (view) => VIEWS.includes(view) && setView(view)
        editor.on('transaction', onTransaction)
        cleanups.set(editor, () => {
            destroyed = true
            clearTimeout(noticeTimer)
            editor.off('transaction', onTransaction)
            painter?.destroy()
            card?.remove()
            bar?.remove()
            noticeEl?.remove()
            restore?.()
        })

        if (options.bar && host()) {
            const doc = dom().ownerDocument

            if (!doc.getElementById('aid-notice-style')) {
                const style = doc.createElement('style')

                style.id = 'aid-notice-style'
                style.textContent = NOTICE_CSS
                doc.head.appendChild(style)
            }

            bar = createBar({ doc, t, onRun: check, onView: setView })
            host().after(bar.el)
            renderBar()
        }
    },

    onDestroy() {
        cleanups.get(this.editor)?.()
    },
})

export default AiDetector
