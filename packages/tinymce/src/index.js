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

import { DEFAULT_ENDPOINT, DetectorError, ERRORS, errorLinks, escapeHtml, isDark, requestCheck } from '@assetfeed/ai-detector-core/api.js'
import { VIEWS, createBar } from '@assetfeed/ai-detector-core/bar.js'
import { createCard } from '@assetfeed/ai-detector-core/card.js'
import { MarkPainter, layerCss } from '@assetfeed/ai-detector-core/layer.js'
import { LABEL, collectBlocks, kindOf, marksFor, percent } from '@assetfeed/ai-detector-core/marks.js'

export { DEFAULT_ENDPOINT }

// Lucide ScanText and Eye (ISC licence), drawn with strokes on the 24px grid of the editor's icons.
const ICON = (paths) => `<svg width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`
const ICON_CHECK = ICON('<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8h8"/><path d="M7 12h10"/><path d="M7 16h6"/>')
const ICON_MARKS = ICON('<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>')

const LINKS = errorLinks('tinymce-ai-detector')

const opaque = (color) => color && color !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(color)

export default function plugin(editor) {
    const option = editor.options.register

    option('aidetector_endpoint', { processor: 'string', default: DEFAULT_ENDPOINT })
    option('aidetector_api_key', { processor: 'string', default: '' })
    option('aidetector_request', { processor: 'function' })

    const t = (text, ...args) => editor.translate(args.length ? [text, ...args] : text)

    /**
     * A notification of the editor. Its text is HTML there, so every string is escaped; a link opens in a new tab, never in
     * the page the editor is on (the editor drops target="_blank", and leaving the page would lose unsaved text).
     */
    function notify(text, type = 'info', link = null) {
        const html = escapeHtml(text) + (link ? ` <a href="${escapeHtml(link.href)}" data-aid-link>${escapeHtml(t(link.text))}</a>` : '')
        const notification = editor.notificationManager.open({ text: html, type, timeout: link ? 0 : 8000, closeButton: true })

        notification.getEl?.()?.querySelector('[data-aid-link]')?.addEventListener('click', (event) => {
            event.preventDefault()
            window.open(link.href, '_blank', 'noopener')
        })
    }

    let busy = false
    let view = 'highlight' // highlight | bars | off
    let shown = 'highlight' // the view the marks toggle brings back
    let state = null // { text, result, marks, checkedAt }
    let stale = false // the text changed after the last answer
    let painter = null
    let card = null
    let bar = null
    let dark = false

    async function send(text) {
        const custom = editor.options.get('aidetector_request')

        if (custom) {
            return custom({ text })
        }

        return requestCheck({ text, endpoint: editor.options.get('aidetector_endpoint'), apiKey: editor.options.get('aidetector_api_key'), unreachable: t('Could not reach the AI detector.') })
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

    function renderBar() {
        const result = state?.result
        const statusbar = editor.getContainer().querySelector('.tox-statusbar')

        bar?.render({
            status: busy ? 'busy' : state ? 'ok' : stale ? 'stale' : 'idle',
            kind: result ? kindOf(result) ?? 'unsure' : null,
            percent: result ? percent(result.ai_fraction) : 0,
            view,
            checkedAt: state?.checkedAt,
            dark: isDark(statusbar || editor.getContainer()),
            // The frame between the text and the status bar is see-through: the bar takes the status bar's colour.
            background: statusbar ? getComputedStyle(statusbar).backgroundColor : '',
        })
    }

    function paint() {
        painter?.update({ marks: state?.marks, windows: state?.result?.windows, view })
        renderBar()
        editor.dispatch('AiDetectorStateChange')
    }

    function setView(next) {
        view = next
        shown = next === 'off' ? shown : next
        paint()
    }

    function clear() {
        stale = false
        state = null
        paint()
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
        renderBar()

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
                view = view === 'off' ? shown : view
                stale = false
                state = { text, result, marks: marksFor(current, result), checkedAt: new Date() }

                // The bar under the text shows the share; editors without it (inline) get it as a notification.
                if (!bar) {
                    const kind = kindOf(result) ?? 'unsure'

                    notify(`${t(LABEL[kind])} · ${t('AI {0}%', percent(result.ai_fraction))}`, kind === 'human' ? 'success' : 'warning')
                }
            } else {
                throw new DetectorError(0)
            }

            editor.dispatch('AiDetectorResult', { result })
        } catch (e) {
            if (!editor.removed) {
                const known = ERRORS[e?.status]

                notify(known ? t(known) : e?.message || t('The AI check failed. Try again later.'), 'error', LINKS[e?.status])
            }
        } finally {
            busy = false

            if (!editor.removed) {
                editor.setProgressState(false)
                paint()
            }
        }
    }

    // An answer is for the text it was given: the first edit after it drops the marks, and the bar asks for a recheck.
    editor.on('input change undo redo SetContent', () => {
        if (state && collectBlocks(editor.getBody()).map((block) => block.text).join('\n') !== state.text) {
            state = null
            stale = true
            paint()
        }
    })
    editor.on('init', () => {
        if (!editor.inline) {
            const container = editor.getContainer()
            const statusbar = container.querySelector('.tox-statusbar')

            bar = createBar({ doc: container.ownerDocument, scope: '.tox', t, onRun: check, onView: setView })

            if (statusbar) {
                statusbar.before(bar.el)
            } else {
                (container.querySelector('.tox-editor-container') || container).appendChild(bar.el)
            }
            renderBar()
        }
    })
    editor.on('SkinLoaded', renderBar)
    editor.on('remove', () => {
        painter?.destroy()
        card?.remove()
        bar?.remove()
    })

    editor.addCommand('AiDetectorCheck', check)
    editor.addCommand('AiDetectorClear', clear)
    editor.addCommand('AiDetectorToggleMarks', () => setView(view === 'off' ? shown : 'off'))
    editor.addCommand('AiDetectorSetView', (ui, next) => VIEWS.includes(next) && setView(next))

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
                api.setActive(Boolean(state?.marks?.length) && view !== 'off')
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
        getMetadata: () => ({ name: 'AI detector by AssetFeed', url: 'https://github.com/assetfeed/ai-detector-plugins' }),
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
