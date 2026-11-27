/**
 * The check cycle every adapter shares: collect the lines, send them, keep the answer while the text is still the one it was
 * made for, draw the marks in a layer beside the editable element, run the bar under the editor.
 *
 * An adapter says what is editor-specific: where the editable element is, which lines the text has right now (with the
 * element each line sits in, or null when it is not on screen), where the bar goes. It calls refresh() after the text changed.
 */

import { DEFAULT_ENDPOINT, DetectorError, ERRORS, errorLinks, isDark, requestCheck } from './api.js'
import { VIEWS, createBar } from './bar.js'
import { createCard } from './card.js'
import { MarkPainter, layerCss } from './layer.js'
import { kindOf, marksFor, percent } from './marks.js'
import { format, joinBlocks, opaque } from './text.js'

export { DEFAULT_ENDPOINT, VIEWS }

export const DEFAULT_OPTIONS = {
    /** Where the text is posted as { text }. Your server route adds the API key (recommended). */
    endpoint: DEFAULT_ENDPOINT,
    /** Sent as X-Api-Token. Only for internal tools: the key is visible in the page. */
    apiKey: '',
    /** async ({ text }) => answer: your own transport. Return the data object of the API answer. */
    request: null,
    /** Show the bar under the editor. false for your own controls (see the state). */
    bar: true,
    /** (result) => void, after each answer. */
    onResult: null,
    /** (state) => void, after every change of the state, view or notice. */
    onChange: null,
    /** ({ message, type, link }) => void, to show messages yourself. By default they appear under the bar. */
    onNotice: null,
}

const NOTICE_CSS = `
.aid-notice { box-sizing: border-box; padding: 6px 8px; font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; color: #111827; }
.aid-notice.is-dark { color: #eceef1; }
.aid-notice--error { color: oklch(55.3% 0.195 38.402); }
.aid-notice.is-dark.aid-notice--error { color: oklch(75% 0.183 55.934); }
.aid-notice a { color: inherit; text-decoration: underline; }
`

const t = format

/**
 * @param {object} env
 * @param {string} env.source  the package name without the scope, for the UTM tags of the links in messages
 * @param {object} env.options  see DEFAULT_OPTIONS
 * @param {() => Element|null} env.root  the editable element: the marks' layer goes into its parent, the pointer is followed on it
 * @param {() => {el: Element|null, text: string}[]} env.blocks  the lines of the text now, one per non-empty block
 * @param {(bar: Element) => void} [env.placeBar]  puts the bar in the page; the bar is not made without it
 * @param {object} [deps]  replaceable for tests
 */
export function createController(env, deps = {}) {
    const { Painter = MarkPainter, makeCard = createCard, makeBar = createBar } = deps
    const options = { ...DEFAULT_OPTIONS, ...env.options }
    const links = errorLinks(env.source)

    /** idle | busy | ok | stale; result is the data object of the last answer that is still current, else null. */
    const state = {
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
    }

    let busy = false
    let shown = 'highlight' // the view the marks toggle brings back
    let stale = false // the text changed after the last answer
    let answered = '' // the text of the current answer
    let marks = []
    let painter = null
    let card = null
    let bar = null
    let noticeEl = null
    let noticeTimer = 0
    let dark = false
    let restore = null
    let mountedRoot = null
    let destroyed = false

    const root = () => {
        const el = env.root()

        return el?.isConnected ? el : null
    }

    async function send(text) {
        if (options.request) {
            return options.request({ text })
        }

        return requestCheck({ text, endpoint: options.endpoint, apiKey: options.apiKey, unreachable: t('Could not reach the AI detector.') })
    }

    const changed = () => options.onChange?.(state)

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

        noticeEl.className = `aid-notice aid-notice--${n.type}${isDark(root() ?? bar.el) ? ' is-dark' : ''}`
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
     * The layer beside the editable element, made on the first answer. The element is position:relative at z-index 1 so the
     * tints sit under the text: an opaque background moves from the element to its parent so it does not cover them.
     */
    function mount() {
        const el = root()
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
        card = makeCard(() => dark)
        painter = new Painter({
            root: el,
            layer,
            t,
            onCard: card.show,
            place: () => {
                const p = parent.getBoundingClientRect()
                const x = p.left + parent.clientLeft - parent.scrollLeft
                const y = p.top + parent.clientTop - parent.scrollTop
                // One line for all the bars, left of the leftmost marked text (a list is indented) but not outside the element.
                const text = marks.reduce((left, mark) => Math.min(left, mark.el.getBoundingClientRect().left), Infinity)
                const edge = el.getBoundingClientRect().left

                return { dx: -x, dy: -y, barX: Math.max(edge + 2, (Number.isFinite(text) ? text : edge) - 10) - x }
            },
        })
        mountedRoot = el
        restore = () => {
            painter?.destroy()
            card?.remove()
            layer.remove()
            style.remove()
            parent.style.cssText = previous.parent
            el.style.cssText = previous.el
            painter = card = restore = mountedRoot = null
        }
    }

    function renderBar() {
        const el = root()

        bar?.render({
            status: state.status,
            kind: state.kind,
            percent: state.percent,
            view: state.view,
            checkedAt: state.checkedAt,
            dark: el ? isDark(el) : false,
        })
    }

    function paint() {
        const result = state.result

        state.status = busy ? 'busy' : result ? 'ok' : stale ? 'stale' : 'idle'
        state.kind = result ? kindOf(result) ?? 'unsure' : null
        state.percent = result ? percent(result.ai_fraction) : 0

        // The editable element was replaced (the editor re-rendered it): the layer went with it, so it is made again.
        if (painter && root() !== mountedRoot) {
            restore()
        }

        if (result && !painter) {
            mount()
        }

        painter?.update({ marks, windows: result?.windows, view: state.view })
        renderBar()
        changed()
    }

    const markBlocks = (blocks) => marksFor(blocks, state.result).filter((mark) => mark.el)

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
        marks = []
        paint()
    }

    async function check() {
        if (busy || destroyed || !root()) {
            return
        }

        const blocks = env.blocks()

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

            // The editor went away, or its text changed (typing, setData from code) while the answer was on its way: the
            // answer is for text that no longer exists, so it is dropped rather than drawn on the wrong blocks. Same text in
            // new elements is fine: the marks go on the blocks that are there now.
            const current = destroyed ? null : env.blocks()

            if (!current || joinBlocks(current) !== sent) {
                return
            }

            if (result?.status === 'too_short') {
                notify(t('The text is too short to check. Add a few more sentences.'))
            } else if (result?.status === 'unsupported_language') {
                notify(t('Only English text can be checked for now.'))
            } else if (result?.status === 'ok') {
                state.view = state.view === 'off' ? shown : state.view
                stale = false
                answered = sent
                state.result = result
                state.checkedAt = new Date()
                marks = markBlocks(current)
            } else {
                throw new DetectorError(0)
            }

            options.onResult?.(result)
        } catch (e) {
            if (!destroyed) {
                const known = ERRORS[e?.status]

                notify(known ? t(known) : e?.message || t('The AI check failed. Try again later.'), 'error', links[e?.status])
            }
        } finally {
            busy = false

            if (!destroyed) {
                paint()
            }
        }
    }

    /**
     * The text or its elements may have changed. An answer is for the text it was given: the first edit after it drops the
     * marks, and the bar asks for a recheck. The same text in new elements (setData with the same content) keeps the answer
     * on the elements that are there now.
     */
    function refresh() {
        if (destroyed || !state.result) {
            return
        }

        const current = env.blocks()

        if (joinBlocks(current) === answered) {
            marks = markBlocks(current)
        } else {
            state.result = null
            state.checkedAt = null
            marks = []
            stale = true
        }

        paint()
    }

    if (options.bar && env.placeBar) {
        const el = root()
        const doc = el?.ownerDocument ?? document

        if (!doc.getElementById('aid-notice-style')) {
            const style = doc.createElement('style')

            style.id = 'aid-notice-style'
            style.textContent = NOTICE_CSS
            doc.head.appendChild(style)
        }

        bar = makeBar({ doc, t, onRun: check, onView: setView })
        env.placeBar(bar.el)
        renderBar()
    }

    return {
        state,
        check,
        clear,
        setView,
        refresh,
        /** Removes the marks, the bar and every listener. */
        destroy() {
            destroyed = true
            clearTimeout(noticeTimer)
            restore?.()
            bar?.remove()
            noticeEl?.remove()
        },
    }
}
