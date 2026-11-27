/**
 * What both WordPress editors share: strings, the call to the plugin's REST route, the links of an error, the marks layer.
 */

import { DetectorError, errorLinks, isDark } from '@assetfeed/ai-detector-core/api.js'
import { createCard } from '@assetfeed/ai-detector-core/card.js'
import { MarkPainter, layerCss } from '@assetfeed/ai-detector-core/layer.js'

const { __ } = window.wp.i18n
const apiFetch = window.wp.apiFetch

export const config = window.assetfeedAid || {}

// ponytail: the strings of core are looked up at run time, so `wp i18n make-pot` does not see them; list them in a strings file if translators ask.
export const t = (text, ...args) => __(text, 'ai-detector-by-assetfeed').replace(/\{(\d+)\}/g, (_, i) => String(args[i]))

const LINKS = errorLinks('wordpress-ai-detector')

/** The server's answer for lines of text. The key never leaves the server: this only talks to the plugin's own route. */
export async function send(postId, lines) {
    try {
        return await apiFetch({ path: config.route, method: 'POST', data: { post_id: postId, lines } })
    } catch (e) {
        // A WP_Error has a code; anything else is the request not getting through at all.
        throw Object.assign(new DetectorError(e?.data?.upstream ?? 0, e?.code ? e.message : t('Could not reach the AI detector.')), { noKey: Boolean(e?.data?.no_key) })
    }
}

/** The link under an error: the settings page for a missing key, AssetFeed's own pages for a key or credits problem. */
export function linkFor(error) {
    if (error?.noKey) {
        return config.settingsUrl ? { text: t('Open settings'), href: config.settingsUrl } : null
    }

    const link = LINKS[error?.status]

    return link ? { text: t(link.text), href: link.href } : null
}

const opaque = (color) => color && color !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(color)

/**
 * The marks layer in an editor's iframe, beside the text: the same as the TinyMCE plugin's, so nothing is added to the post.
 *
 * @param {object} o
 * @param {Document} o.doc  the iframe's document
 * @param {HTMLIFrameElement} o.iframe
 * @param {() => number} o.left  the client x of the text's left edge in the iframe; the side bars go 10px left of it
 */
export function mountMarks({ doc, iframe, left }) {
    const body = doc.body
    const html = doc.documentElement
    const background = getComputedStyle(body).backgroundColor
    const dark = isDark(body)
    const style = doc.createElement('style')

    // The tints sit under the text: an opaque body colour moves to <html> so it does not cover them.
    style.textContent = `html { position: relative;${opaque(background) ? ` background: ${background};` : ''} }`
        + ` body { position: relative; z-index: 1;${opaque(background) ? ' background: transparent !important;' : ''} }${layerCss(dark)}`
    doc.head.appendChild(style)

    const layer = doc.createElement('div')

    layer.className = 'aid-marks'
    layer.setAttribute('aria-hidden', 'true')
    html.appendChild(layer)

    const card = createCard(() => dark)
    const painter = new MarkPainter({
        root: body,
        layer,
        t,
        onCard: card.show,
        place: () => {
            const h = html.getBoundingClientRect()

            return { dx: -h.left, dy: -h.top, barX: Math.max(2, left() - h.left - 10) }
        },
        offset: () => {
            const box = iframe.getBoundingClientRect()

            return { x: box.left, y: box.top }
        },
    })

    return {
        painter,
        destroy() {
            painter.destroy()
            card.remove()
            layer.remove()
            style.remove()
        },
    }
}

/**
 * The painter for the editor's iframe as it is now: made when first needed, made again if the editor replaced its iframe (the
 * block editor does when it leaves and re-enters the code editor), null while there is none.
 *
 * @param {() => HTMLIFrameElement|null} frame
 * @param {() => number} left  see mountMarks
 */
export function painterFor(frame, left) {
    let mounted = null

    return (create = true) => {
        const iframe = frame()
        const doc = iframe?.contentDocument

        if (mounted && mounted.doc !== doc) {
            try {
                mounted.destroy()
            } catch (e) {
                // The old iframe is gone with its layer.
            }
            mounted = null
        }

        if (create && !mounted && iframe && doc?.body) {
            mounted = { ...mountMarks({ doc, iframe, left }), doc }
        }

        return mounted?.painter ?? null
    }
}
