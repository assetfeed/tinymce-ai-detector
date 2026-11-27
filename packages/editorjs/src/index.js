/**
 * AI writing check for Editor.js (2.x), by AssetFeed (https://assetfeed.com/ai-content-detector).
 *
 * A controller attached to an editor instance. It sends the text of all blocks to the AssetFeed AI detector and marks the
 * answer next to the text: a side bar per passage (orange: likely AI, amber: unsure, green: likely human), a tint behind
 * strong passages and a card on hover. The marks are drawn in a layer beside the redactor, not in a block, so nothing
 * reaches editor.save() or the undo history.
 *
 *   const editor = new EditorJS({ holder: 'editorjs', tools })
 *   await editor.isReady
 *   const detector = new AiDetector(editor, { endpoint: '/my-proxy/ai-check' })
 *   detector.check()
 */

import { DEFAULT_ENDPOINT, DetectorError, ERRORS, errorLinks, isDark, requestCheck } from '@assetfeed/ai-detector-core/api.js'
import { VIEWS, createBar } from '@assetfeed/ai-detector-core/bar.js'
import { createCard } from '@assetfeed/ai-detector-core/card.js'
import { MarkPainter, layerCss } from '@assetfeed/ai-detector-core/layer.js'
import { collectBlocks, kindOf, marksFor, percent } from '@assetfeed/ai-detector-core/marks.js'
import { format, joinBlocks, opaque } from './text.js'

export { DEFAULT_ENDPOINT }

const LINKS = errorLinks('editorjs-ai-detector')

const NOTICE_CSS = `
.aid-notice { box-sizing: border-box; padding: 6px 8px; font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; color: #111827; }
.aid-notice.is-dark { color: #eceef1; }
.aid-notice--error { color: oklch(55.3% 0.195 38.402); }
.aid-notice.is-dark.aid-notice--error { color: oklch(75% 0.183 55.934); }
.aid-notice a { color: inherit; text-decoration: underline; }
`

const t = format

/** The element the editor lives in: the holder option, else the holder of the editor's own config, else #editorjs. */
function findHolder(editor, holder) {
    const wanted = holder ?? editor?.configuration?.holder ?? 'editorjs'

    return typeof wanted === 'string' ? document.getElementById(wanted) : wanted
}

export class AiDetector {
    /**
     * @param {object} editor  an EditorJS instance, after `await editor.isReady`
     * @param {object} [options]
     * @param {string|HTMLElement} [options.holder]  the editor's holder; read from the editor's config when left out
     * @param {string} [options.endpoint]  where the text is posted as { text }. Your server route adds the API key (recommended).
     * @param {string} [options.apiKey]  sent as X-Api-Token. Only for internal tools: the key is visible in the page.
     * @param {Function} [options.request]  async ({ text }) => answer: your own transport. Return the data object of the API answer.
     * @param {boolean} [options.bar]  render the bar right after the holder. false for your own controls (see detector.state).
     * @param {Function} [options.onResult]  (result) => void, after each answer.
     * @param {Function} [options.onChange]  (state) => void, after every change of the state, view or notice.
     * @param {Function} [options.onNotice]  ({ message, type, link }) => void, to show messages yourself. By default they appear under the bar.
     */
    constructor(editor, options = {}) {
        options = { endpoint: DEFAULT_ENDPOINT, apiKey: '', request: null, bar: true, onResult: null, onChange: null, onNotice: null, ...options }

        /** idle | busy | ok | stale; result is the data object of the last answer that is still current, else null. */
        const state = (this.state = {
            status: 'idle',
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
        })

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
        let observer = null
        let holder = null

        const dom = () => {
            const el = holder?.querySelector('.codex-editor__redactor')

            return el?.isConnected ? el : null
        }

        async function send(text) {
            if (options.request) {
                return options.request({ text })
            }

            return requestCheck({ text, endpoint: options.endpoint, apiKey: options.apiKey, unreachable: t('Could not reach the AI detector.') })
        }

        function changed() {
            options.onChange?.(state)
        }

        function renderNotice() {
            if (!bar || options.onNotice) {
                return
            }

            const n = state.notice

            if (!n) {
                noticeEl?.remove()
                noticeEl = null
                return
            }

            if (!noticeEl) {
                noticeEl = bar.el.ownerDocument.createElement('div')
                bar.el.after(noticeEl)
            }

            noticeEl.className = `aid-notice aid-notice--${n.type}${isDark(holder) ? ' is-dark' : ''}`
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

            if (state.notice) {
                state.notice = null
                renderNotice()
                changed()
            }
        }

        function notify(message, type = 'info', link = null) {
            clearTimeout(noticeTimer)
            state.notice = { message, type, link: link ? { text: t(link.text), href: link.href } : null }
            options.onNotice?.(state.notice)
            renderNotice()
            changed()

            if (!link) {
                noticeTimer = setTimeout(dismiss, 8000)
            }
        }

        /**
         * The layer beside the redactor (inside .codex-editor, which Editor.js makes position:relative), made on the first
         * answer. The redactor is lifted to z-index 1 so the tints sit under the text: an opaque background moves from the
         * redactor to its parent so it does not cover them. Editor.js never sees the layer: it lives outside the redactor,
         * whose children Editor.js indexes by position.
         */
        function mount() {
            const el = dom()
            const parent = el?.parentElement

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
                    // The text sits in a centred column (.ce-block__content), not at the redactor's edge.
                    const column = el.querySelector('.ce-block__content') ?? el

                    return { dx: -x, dy: -y, barX: Math.max(2, column.getBoundingClientRect().left - x - 10) }
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
            bar?.render({
                status: state.status,
                kind: state.kind,
                percent: state.percent,
                view: state.view,
                checkedAt: state.checkedAt,
                dark: holder ? isDark(holder) : false,
            })
        }

        function setState() {
            state.status = busy ? 'busy' : state.result ? 'ok' : stale ? 'stale' : 'idle'
        }

        function paint() {
            const result = state.result

            setState()
            state.kind = result ? kindOf(result) ?? 'unsure' : null
            state.percent = result ? percent(result.ai_fraction) : 0
            painter?.update({ marks: marks ?? [], windows: result?.windows, view: state.view })
            renderBar()
            changed()
        }

        function setView(next) {
            if (!VIEWS.includes(next)) {
                return
            }

            state.view = next
            shown = next === 'off' ? shown : next
            paint()
        }

        function clear() {
            stale = false
            state.result = null
            state.checkedAt = null
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

                // The editor went away, or its text changed (typing, render() from code) while the answer was on its way: the
                // answer is for text that no longer exists, so it is dropped rather than drawn on the wrong blocks. Same text in
                // new elements is fine: the marks go on the blocks that are there now.
                const current = destroyed || !dom() ? null : collectBlocks(dom())

                if (!current || joinBlocks(current) !== sent) {
                    return
                }

                if (result?.status === 'too_short') {
                    notify(t('The text is too short to check. Add a few more sentences.'))
                } else if (result?.status === 'unsupported_language') {
                    notify(t('Only English text can be checked for now.'))
                } else if (result?.status === 'ok') {
                    mount()
                    state.view = state.view === 'off' ? shown : state.view
                    stale = false
                    answered = sent
                    state.result = result
                    state.checkedAt = new Date()
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
        // The same text in new elements (render() with the same data) keeps the answer on the elements that are there now.
        const onMutation = () => {
            const el = dom()

            if (!state.result || !el) {
                return
            }

            const current = collectBlocks(el)

            if (joinBlocks(current) === answered) {
                marks = marksFor(current, state.result)
            } else {
                state.result = null
                state.checkedAt = null
                marks = null
                stale = true
            }

            paint()
        }

        const setup = () => {
            holder = findHolder(editor, options.holder)

            const el = dom()

            if (destroyed || !el) {
                return
            }

            observer = new MutationObserver(onMutation)
            observer.observe(el, { childList: true, characterData: true, subtree: true })

            if (options.bar) {
                const doc = holder.ownerDocument

                if (!doc.getElementById('aid-notice-style')) {
                    const style = doc.createElement('style')

                    style.id = 'aid-notice-style'
                    style.textContent = NOTICE_CSS
                    doc.head.appendChild(style)
                }

                bar = createBar({ doc, t, onRun: check, onView: setView })
                holder.after(bar.el)
                renderBar()
            }
        }

        // The controller works on an editor that is ready; one that is still starting is waited for.
        const ready = Promise.resolve(editor?.isReady).then(setup, () => {})

        /** Sends the text and draws the answer. Returns a promise that settles when the check is over. */
        this.check = async () => {
            await ready

            return check()
        }
        /** Removes the marks. */
        this.clear = clear
        /** 'highlight', 'bars' or 'off'. */
        this.setView = setView
        /** Removes the marks, the bar and every listener. Call it before editor.destroy(). */
        this.destroy = () => {
            destroyed = true
            clearTimeout(noticeTimer)
            observer?.disconnect()
            painter?.destroy()
            card?.remove()
            bar?.remove()
            noticeEl?.remove()
            restore?.()
        }
    }
}

export default AiDetector
