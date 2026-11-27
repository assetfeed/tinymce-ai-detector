/**
 * The AssetFeed AI detector API as the editor plugins use it: one POST with the text, one line per block, and the answer's
 * data object back. Errors carry the HTTP status, so a plugin can show its own message and a link for the known ones.
 */

export const DEFAULT_ENDPOINT = 'https://api.assetfeed.com/api/v1/ai-detector/checks'

export const ERRORS = {
    401: 'The AI check needs a valid AssetFeed API key.',
    402: 'Not enough credits for this check.',
    429: 'Too many checks at once. Try again in a minute.',
    503: 'The detector is busy, try again in a minute.',
}

/** Where a developer gets a key or more credits. The UTM tags show in AssetFeed's analytics which plugin a visit came from. */
export function errorLinks(source) {
    const utm = `utm_source=${source}&utm_medium=plugin`

    return {
        401: { text: 'Get an API key', href: `https://assetfeed.com/api-keys?${utm}` },
        402: { text: 'See plans', href: `https://assetfeed.com/pricing?${utm}` },
    }
}

export class DetectorError extends Error {
    constructor(status, message) {
        super(message || '')
        this.status = status
    }
}

/**
 * @param {object} o
 * @param {string} o.text  one line per block
 * @param {string} [o.endpoint]  the API or your proxy
 * @param {string} [o.apiKey]  sent as X-Api-Token (a key in the page can be read by anyone who opens it)
 * @param {string} [o.unreachable]  the message when the request does not get through
 */
export async function requestCheck({ text, endpoint = DEFAULT_ENDPOINT, apiKey = '', unreachable = 'Could not reach the AI detector.' }) {
    let response

    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(apiKey ? { 'X-Api-Token': apiKey } : {}) },
            body: JSON.stringify({ text }),
        })
    } catch (e) {
        throw new DetectorError(0, unreachable)
    }

    const body = await response.json().catch(() => null)

    if (!response.ok || !body?.success) {
        throw new DetectorError(response.status, body?.error?.message || body?.message)
    }

    return body.data
}

/** Light text means a dark theme: the marks, the card and the bar follow it. */
export function isDark(el) {
    const [r, g, b] = (getComputedStyle(el).color.match(/\d+(\.\d+)?/g) || [0, 0, 0]).map(Number)

    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140
}

export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
