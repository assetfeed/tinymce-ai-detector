/**
 * The text the detector gets and the marks its answer gives.
 *
 * The editor's text is sent as one line per block (the innermost p, h1-h6, li, blockquote, td, th), empty blocks left out.
 * The answer's windows name the lines they cover by number, so line i is block i of collectBlocks().
 */

const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th'

// A nested list inside a list item: the item is marked and sent for its own lines only.
const INNER = /^(UL|OL|TABLE|BLOCKQUOTE|P|DIV|H[1-6])$/

// A block this short carries no signal of its own; it only inherits its window's verdict.
export const MIN_MARK_WORDS = 12

/** An AI window gets the tint behind its lines from this P(AI) up; below it, the side bar only. */
export const STRONG_AI_SCORE = 0.85

export const innerBlock = (el) => Array.from(el.children).find((child) => INNER.test(child.tagName))

const collapse = (s) => s.replace(/\s+/g, ' ').trim()

function ownText(el) {
    const inner = innerBlock(el)

    if (!inner) {
        return el.textContent
    }

    const range = el.ownerDocument.createRange()

    range.selectNodeContents(el)
    range.setEndBefore(inner)

    return range.toString()
}

/** The blocks of the text in document order, each with the line sent for it: [{ el, text }]. */
export function collectBlocks(root) {
    return Array.from(root.querySelectorAll(BLOCKS))
        .filter((el) => el.tagName === 'LI' || !el.querySelector(BLOCKS))
        .map((el) => ({ el, text: collapse(ownText(el)) }))
        .filter((block) => block.text !== '')
}

const RANK = { HUMAN: 1, UNSURE: 2, AI: 3 }
const KIND = { AI: 'ai', UNSURE: 'unsure', HUMAN: 'human' }

const verdictOf = (win) => {
    const verdict = String(win?.verdict ?? '').toUpperCase()

    return RANK[verdict] ? verdict : null
}

/** 'ai' | 'unsure' | 'human' of a window or of the whole answer, null for anything else. */
export const kindOf = (win) => KIND[verdictOf(win)] ?? null

/** The window that speaks for each line number: of the windows covering it, the strongest (the first on a tie). */
export function lineWindows(windows) {
    const out = new Map()

    ;(windows || []).forEach((win, wi) => {
        const verdict = verdictOf(win)

        if (!verdict) {
            return
        }

        for (const index of win.paragraphs || []) {
            const current = out.get(Number(index))

            if (current === undefined || RANK[verdict] > RANK[verdictOf(windows[current])]) {
                out.set(Number(index), wi)
            }
        }
    })

    return out
}

const words = (text) => text.split(' ').filter(Boolean).length

/** The marks of an answer on the blocks it was given for, in document order: [{ el, kind, window, index }]. */
export function marksFor(blocks, result) {
    if (!result || result.status !== 'ok') {
        return []
    }

    const owner = lineWindows(result.windows)
    const marks = []

    blocks.forEach(({ el, text }, index) => {
        const wi = owner.get(index)
        const kind = wi === undefined ? null : kindOf(result.windows[wi])

        if (kind && words(text) >= MIN_MARK_WORDS) {
            marks.push({ el, kind, window: wi, index })
        }
    })

    return marks
}

/** Human windows and AI windows from STRONG_AI_SCORE up get the tint; unsure ones and weaker AI ones only the bar. */
export function isTinted(kind, score) {
    return kind === 'human' || (kind === 'ai' && typeof score === 'number' && score >= STRONG_AI_SCORE)
}

export const percent = (fraction) => Math.round(Math.min(1, Math.max(0, Number(fraction) || 0)) * 100)

/** What the hover card shows for a window. The score is the window's P(AI); a human window shows its complement. */
export function markCard(kind, win, t) {
    const score = typeof win?.score === 'number' && Number.isFinite(win.score) ? Math.min(1, Math.max(0, win.score)) : null
    const ai = score === null ? null : Math.round(score * 100)
    const fill = ai === null ? null : kind === 'human' ? 100 - ai : ai
    const n = Math.max(0, Math.round(Number(win?.words) || 0))

    return {
        kind,
        label: t(LABEL[kind]),
        words: n === 1 ? t('1 word') : t('{0} words', n.toLocaleString('en-US')),
        share: fill === null ? null : t(kind === 'human' ? 'Human {0}%' : 'AI {0}%', fill),
        fill,
    }
}

export const LABEL = { ai: 'Likely AI', human: 'Likely human', unsure: 'Unsure' }
