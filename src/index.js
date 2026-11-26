/**
 * AI writing check for TinyMCE (6, 7, 8) and HugeRTE (1.x), by AssetFeed (https://assetfeed.com/ai-content-detector).
 *
 * The toolbar button sends the editor's text to the AssetFeed AI detector and marks the answer next to the text: a side bar
 * per passage (orange: likely AI, amber: unsure, green: likely human), a tint behind strong passages and a card on hover.
 * The marks are drawn in a layer beside the document, so nothing is added to the content, getContent() or the undo history.
 *
 *   plugins: 'aidetector', toolbar: 'aidetector aidetectormarks'
 *   aidetector_endpoint: '/my-proxy/ai-check'   // your server adds the API key (recommended)
 *   aidetector_api_key: 'af_...'                // or the key itself, for internal tools only: it is visible in the page
 *   aidetector_request: async ({ text }) => answer  // or any transport you like
 */

import { createCard } from './card.js'
import { MarkPainter, layerCss } from './layer.js'
import { LABEL, collectBlocks, kindOf, marksFor, percent } from './marks.js'

export const DEFAULT_ENDPOINT = 'https://api.assetfeed.com/api/v1/ai-detector/checks'

// Lucide ScanText and Eye (ISC licence), drawn with strokes on the 24px grid of the editor's icons.
const ICON = (paths) => `<svg width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`
const ICON_CHECK = ICON('<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8h8"/><path d="M7 12h10"/><path d="M7 16h6"/>')
const ICON_MARKS = ICON('<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>')

const ERRORS = {
    401: 'The AI check needs a valid AssetFeed API key.',
    402: 'Not enough credits for this check.',
    429: 'Too many checks at once. Try again in a minute.',
    503: 'The detector is busy, try again in a minute.',
}

class DetectorError extends Error {
    constructor(status, message) {
        super(message || '')
        this.status = status
    }
}

const opaque = (color) => color && color !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(color)

/** Light text on the page means a dark theme: the marks and the card follow it. */
function isDark(el) {
    const [r, g, b] = (getComputedStyle(el).color.match(/\d+(\.\d+)?/g) || [0, 0, 0]).map(Number)

    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140
}

export default function plugin(editor) {
    const option = editor.options.register

    option('aidetector_endpoint', { processor: 'string', default: DEFAULT_ENDPOINT })
    option('aidetector_api_key', { processor: 'string', default: '' })
    option('aidetector_request', { processor: 'function' })

    const t = (text, ...args) => editor.translate(args.length ? [text, ...args] : text)
    const notify = (text, type = 'info') => editor.notificationManager.open({ text, type, timeout: 8000 })

    let busy = false
    let visible = true
    let state = null // { text, result, marks }
    let painter = null
    let card = null
    let dark = false

    async function send(text) {
        const custom = editor.options.get('aidetector_request')

        if (custom) {
            return custom({ text })
        }

        const key = editor.options.get('aidetector_api_key')
        let response

        try {
            response = await fetch(editor.options.get('aidetector_endpoint'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(key ? { 'X-Api-Token': key } : {}) },
                body: JSON.stringify({ text }),
            })
        } catch (e) {
            throw new DetectorError(0, t('Could not reach the AI detector.'))
        }

        const body = await response.json().catch(() => null)

        if (!response.ok || !body?.success) {
            throw new DetectorError(response.status, body?.error?.message || body?.message)
        }

        return body.data
    }

    /** The layer beside the text and the card, made on the first answer. Inline editors get the summary only. */
    function mount() {
        if (painter || editor.inline) {
            return
        }

        const doc = editor.getDoc()
        const body = editor.getBody()
        const html = doc.documentElement
        const background = getComputedStyle(body).backgroundColor
        const style = doc.createElement('style')

        dark = isDark(body)
        // The tints sit under the text: an opaque body colour moves to <html> so it does not cover them.
        style.textContent = `html { position: relative;${opaque(background) ? ` background: ${background};` : ''} }`
            + ` body { position: relative; z-index: 1;${opaque(background) ? ' background: transparent;' : ''} }${layerCss(dark)}`
        doc.head.appendChild(style)

        const layer = doc.createElement('div')

        layer.className = 'aid-marks'
        layer.setAttribute('aria-hidden', 'true')
        html.appendChild(layer)
        card = createCard(() => dark)
        painter = new MarkPainter({
            root: body,
            layer,
            t,
            onCard: card.show,
            place: () => {
                const h = html.getBoundingClientRect()

                return { dx: -h.left, dy: -h.top, barX: Math.max(2, body.getBoundingClientRect().left - h.left - 10) }
            },
            offset: () => {
                const box = editor.iframeElement?.getBoundingClientRect()

                return box ? { x: box.left, y: box.top } : { x: 0, y: 0 }
            },
        })
    }

    function paint() {
        painter?.update({ marks: state?.marks, windows: state?.result?.windows, view: visible ? 'highlight' : 'off' })
        editor.dispatch('AiDetectorStateChange')
    }

    function clear() {
        if (state) {
            state = null
            paint()
        }
    }

    async function check() {
        if (busy) {
            return
        }

        const blocks = collectBlocks(editor.getBody())

        if (blocks.length === 0) {
            notify(t('Add some text to check.'))
            return
        }

        const text = blocks.map((block) => block.text).join('\n')

        busy = true
        editor.setProgressState(true)

        try {
            const result = await send(text)

            // The editor went away, or its text was replaced (setContent from code) while the answer was on its way: the answer
            // is for text that no longer exists, so it is dropped rather than drawn on the wrong blocks. Same text in new elements
            // (setContent with the same HTML) is fine: the marks go on the blocks that are there now.
            const current = editor.removed ? null : collectBlocks(editor.getBody())

            if (!current || current.map((block) => block.text).join('\n') !== text) {
                return
            }

            if (result?.status === 'too_short') {
                notify(t('The text is too short to check. Add a few more sentences.'))
            } else if (result?.status === 'unsupported_language') {
                notify(t('Only English text can be checked for now.'))
            } else if (result?.status === 'ok') {
                mount()
                visible = true
                state = { text, result, marks: marksFor(current, result) }
                paint()

                const kind = kindOf(result) ?? 'unsure'

                notify(`${t(LABEL[kind])} · ${t('AI {0}%', percent(result.ai_fraction))}`, kind === 'human' ? 'success' : 'warning')
            } else {
                throw new DetectorError(0)
            }

            editor.dispatch('AiDetectorResult', { result })
        } catch (e) {
            if (!editor.removed) {
                notify(e?.message || t(ERRORS[e?.status] || 'The AI check failed. Try again later.'), 'error')
            }
        } finally {
            busy = false

            if (!editor.removed) {
                editor.setProgressState(false)
            }
        }
    }

    // An answer is for the text it was given: the first edit after it drops the marks.
    editor.on('input change undo redo SetContent', () => {
        if (state && collectBlocks(editor.getBody()).map((block) => block.text).join('\n') !== state.text) {
            clear()
        }
    })
    editor.on('remove', () => {
        painter?.destroy()
        card?.remove()
    })

    editor.addCommand('AiDetectorCheck', check)
    editor.addCommand('AiDetectorClear', clear)
    editor.addCommand('AiDetectorToggleMarks', () => {
        visible = !visible
        paint()
    })

    editor.ui.registry.addIcon('ai-detector', ICON_CHECK)
    editor.ui.registry.addIcon('ai-detector-marks', ICON_MARKS)
    editor.ui.registry.addButton('aidetector', {
        icon: 'ai-detector',
        tooltip: 'Check for AI writing',
        onAction: check,
    })
    editor.ui.registry.addToggleButton('aidetectormarks', {
        icon: 'ai-detector-marks',
        tooltip: 'Show AI marks',
        onAction: () => editor.execCommand('AiDetectorToggleMarks'),
        onSetup: (api) => {
            const sync = () => {
                api.setEnabled(Boolean(state?.marks?.length))
                api.setActive(Boolean(state?.marks?.length) && visible)
            }

            sync()
            editor.on('AiDetectorStateChange', sync)

            return () => editor.off('AiDetectorStateChange', sync)
        },
    })
    editor.ui.registry.addMenuItem('aidetector', {
        icon: 'ai-detector',
        text: 'Check for AI writing',
        onAction: check,
    })

    return {
        getMetadata: () => ({ name: 'AI detector by AssetFeed', url: 'https://github.com/assetfeed/tinymce-ai-detector' }),
    }
}

/** Adds the plugin to every editor global on the page: tinymce, hugerte, or both. */
export function register(...globals) {
    for (const editors of globals) {
        editors?.PluginManager?.add('aidetector', plugin)
    }
}

if (typeof window !== 'undefined') {
    register(window.tinymce, window.hugerte)
}
