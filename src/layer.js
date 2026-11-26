/**
 * The layer the AI marks are drawn into, behind the text. The text is never touched: the caret, undo and paste stay as they
 * are, and nothing reaches getContent(), the undo levels or the saved HTML. Three kinds of shapes, redrawn once per frame after
 * a change of the text or the marks, on resize and on font load:
 * - a side bar per group (neighbouring blocks of one window): a 4px pill on one vertical line left of the text whatever the
 *   block's indent, 2px shorter at both ends so neighbouring windows read apart (<i>);
 * - a tint behind each line of a strong passage (human windows and AI windows from STRONG_AI_SCORE), one rounded box per
 *   visual line from the block's Range.getClientRects() (<b>);
 * - a thin underline under each line of the window under the mouse (<u>).
 * A mouse resting on a marked block for 300ms opens the hover card (onCard); any key, scroll or press closes it.
 *
 * The layer is a child of the iframe's <html> next to <body>, which the editor never serialises. The text sits at z-index 1:
 * the tints go under it, the bars and underlines over it.
 */

import { innerBlock, isTinted, markCard } from './marks.js'

// The colours of the marks (orange AI, amber unsure, green human), light and dark.
const PALETTE = {
    light: {
        ai: { accent: 'oklch(64.6% 0.222 41.116)', bar: 'color-mix(in oklab, oklch(70.5% 0.213 47.604) 85%, #fff)', tint: 'color-mix(in srgb, oklch(64.6% 0.222 41.116) 15%, transparent)' },
        unsure: { accent: 'oklch(82.8% 0.189 84.429)', bar: 'oklch(87.9% 0.169 91.605)', tint: 'color-mix(in srgb, oklch(82.8% 0.189 84.429) 22%, transparent)' },
        human: { accent: 'oklch(62.7% 0.194 149.214)', bar: 'color-mix(in oklab, oklch(72.3% 0.219 149.579) 75%, #fff)', tint: 'color-mix(in srgb, oklch(72.3% 0.219 149.579) 12%, transparent)' },
    },
    dark: {
        ai: { accent: 'oklch(75% 0.183 55.934)', bar: 'color-mix(in oklab, oklch(75% 0.183 55.934) 85%, transparent)', tint: 'color-mix(in srgb, oklch(75% 0.183 55.934) 17%, transparent)' },
        unsure: { accent: 'oklch(82.8% 0.189 84.429)', bar: 'color-mix(in oklab, oklch(87.9% 0.169 91.605) 80%, transparent)', tint: 'color-mix(in srgb, oklch(82.8% 0.189 84.429) 16%, transparent)' },
        human: { accent: 'oklch(79.2% 0.209 151.711)', bar: 'color-mix(in oklab, oklch(79.2% 0.209 151.711) 80%, transparent)', tint: 'color-mix(in srgb, oklch(79.2% 0.209 151.711) 13%, transparent)' },
    },
}

/** The layer's rules, in the editor's iframe. */
export function layerCss(dark) {
    const s = '.aid-marks'
    const p = dark ? PALETTE.dark : PALETTE.light

    return `
${s} { position: absolute; top: 0; left: 0; width: 0; height: 0; pointer-events: none; }
${s} > * { position: absolute; display: block; margin: 0; padding: 0; }
${s} > b { z-index: 0; border-radius: 4px; }
${s} > i { z-index: 2; width: 4px; border-radius: 999px; }
${s} > u { z-index: 2; height: 1.5px; border-radius: 1px; text-decoration: none; }` + ['ai', 'unsure', 'human'].map((kind) => `
${s} > i[data-kind="${kind}"] { background: ${p[kind].bar}; }
${s} > b[data-kind="${kind}"] { background: ${p[kind].tint}; }
${s} > u[data-kind="${kind}"] { background: ${p[kind].accent}; }`).join('')
}

/**
 * One box per visual line from a range's client rects: a line split by inline formatting (bold, a link) gives several rects
 * that overlap vertically; they are joined into one. Empty rects (collapsed spaces, a <br>) are dropped.
 */
export function mergeLineRects(rects) {
    const list = Array.from(rects)
        .filter((r) => r.right - r.left >= 1 && r.bottom - r.top >= 1)
        .map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }))
        .sort((a, b) => a.top - b.top || a.left - b.left)
    const out = []

    for (const r of list) {
        const line = out.find((l) => Math.min(l.bottom, r.bottom) - Math.max(l.top, r.top) > Math.min(l.bottom - l.top, r.bottom - r.top) / 2)

        if (!line) {
            out.push(r)
            continue
        }

        line.left = Math.min(line.left, r.left)
        line.right = Math.max(line.right, r.right)
        line.top = Math.min(line.top, r.top)
        line.bottom = Math.max(line.bottom, r.bottom)
    }

    return out
}

const CARD_WIDTH = 224
const CARD_HEIGHT = 96
const CARD_GAP = 8
const px = (n) => `${n.toFixed(1)}px`

export class MarkPainter {
    /**
     * @param {object} o
     * @param {Element} o.root  the element holding the marked blocks; gets the pointer (an editor's body, the article)
     * @param {Element} o.layer  the absolutely positioned layer behind the root
     * @param {() => {dx: number, dy: number, barX: number}} o.place  client coordinates of the root's window to the layer's, and the bars' x
     * @param {() => {x: number, y: number}} [o.offset]  where the root's window sits in the page (an iframe's box)
     * @param {(card: object|null) => void} [o.onCard]  the hover card to show, in page coordinates, or null
     * @param {(text: string, ...args: any[]) => string} [o.t]  the editor's translate
     */
    constructor({ root, layer, place, offset, onCard, t }) {
        this.root = root
        this.layer = layer
        this.place = place
        this.offset = offset || (() => ({ x: 0, y: 0 }))
        this.onCard = onCard || (() => {})
        this.t = t || ((text) => text)
        this.doc = root.ownerDocument
        this.win = this.doc.defaultView
        this.marks = []
        this.windows = []
        this.view = 'highlight'
        this.markOf = new Map()
        this.hoverWindow = -1
        this.hoverEl = null
        this.hoverTimer = null
        this.cardOpen = false
        this.pointer = { x: 0, y: 0 }
        this.frame = 0
        this.fine = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null

        this.schedule = this.schedule.bind(this)
        this.closeCard = this.closeCard.bind(this)
        this.endHover = this.endHover.bind(this)
        this.onMove = this.onMove.bind(this)

        // In an editor's iframe the pointer is followed over the whole page, margins included, so crossing the body's
        // margin or the gap between two paragraphs does not end the hover.
        this.area = root.tagName === 'BODY' ? this.doc.documentElement : root
        this.area.addEventListener('pointermove', this.onMove)
        this.area.addEventListener('pointerleave', this.endHover)
        this.area.addEventListener('pointerdown', this.closeCard)
        root.addEventListener('input', this.closeCard)
        this.listen(true)

        const Observer = this.win.ResizeObserver || window.ResizeObserver
        this.resize = Observer ? new Observer(this.schedule) : null
        this.resize?.observe(root)
    }

    listen(on) {
        const method = on ? 'addEventListener' : 'removeEventListener'
        const wins = this.win === window ? [window] : [this.win, window]

        for (const win of wins) {
            win[method]('keydown', this.closeCard, true)
            win[method]('scroll', this.closeCard, { capture: true, passive: true })
            win[method]('resize', this.schedule)
        }
        // The line boxes move when a web font replaces the fallback.
        this.doc.fonts?.[method]?.('loadingdone', this.schedule)
    }

    /** marks: [{ el, kind, window, index }] in document order; windows: the stored answer's windows; view: highlight | bars | off. */
    update({ marks, windows, view }) {
        this.marks = marks || []
        this.windows = windows || []
        this.view = view || 'highlight'
        this.markOf = new Map(this.marks.map((mark) => [mark.el, mark]))

        if (this.view === 'off' || (this.hoverEl && !this.markOf.has(this.hoverEl))) {
            this.endHover()
        }

        this.schedule()
    }

    schedule() {
        if (this.frame || !this.win) {
            return
        }

        this.frame = this.win.requestAnimationFrame(() => {
            this.frame = 0
            this.draw()
        })
    }

    ownLineBoxes(el) {
        const range = this.doc.createRange()

        range.selectNodeContents(el)

        const inner = innerBlock(el)

        if (inner) {
            range.setEndBefore(inner)
        }

        return mergeLineRects(range.getClientRects())
    }

    draw() {
        const out = []

        if (this.view !== 'off' && this.marks.length > 0 && this.root.isConnected) {
            const { dx, dy, barX } = this.place()
            const tints = this.view === 'highlight'
            let group = null
            const flush = () => {
                if (group && group.bottom - group.top > 6) {
                    out.push(`<i data-kind="${group.kind}" style="left:${px(barX)};top:${px(group.top + 2)};height:${px(group.bottom - group.top - 4)}"></i>`)
                }
                group = null
            }

            for (const { el, kind, window: wi, index } of this.marks) {
                if (!el.isConnected) {
                    continue
                }

                const box = el.getBoundingClientRect()
                const inner = innerBlock(el)
                const bottom = inner ? inner.getBoundingClientRect().top : box.bottom

                if (bottom - box.top <= 0) {
                    continue
                }

                if (group && group.window === wi && group.index === index - 1) {
                    group.bottom = bottom + dy
                    group.index = index
                } else {
                    flush()
                    group = { kind, window: wi, index, top: box.top + dy, bottom: bottom + dy }
                }

                const tinted = tints && isTinted(kind, this.windows[wi]?.score)
                const hovered = wi === this.hoverWindow

                if (!tinted && !hovered) {
                    continue
                }

                for (const line of this.ownLineBoxes(el)) {
                    if (tinted) {
                        out.push(`<b data-kind="${kind}" style="left:${px(line.left + dx - 3)};top:${px(line.top + dy - 1)};width:${px(line.right - line.left + 6)};height:${px(line.bottom - line.top + 2)}"></b>`)
                    }
                    if (hovered) {
                        out.push(`<u data-kind="${kind}" style="left:${px(line.left + dx)};top:${px(line.bottom + dy + 1)};width:${px(line.right - line.left)}"></u>`)
                    }
                }
            }

            flush()
        }

        this.layer.innerHTML = out.join('')
    }

    markAt(target) {
        for (let node = target; node && node !== this.root; node = node.parentNode) {
            const mark = this.markOf.get(node)

            if (mark) {
                return mark
            }
        }

        return null
    }

    /**
     * The mark at a height of the page, for a pointer that is not over a marked block: in the margin beside one, or in the gap
     * between two neighbouring blocks of one window (the gap belongs to the window, so its underline does not blink off and on
     * as the pointer moves from one paragraph to the next).
     */
    markAtY(y) {
        let previous = null

        for (const mark of this.marks) {
            if (!mark.el.isConnected) {
                continue
            }

            const box = mark.el.getBoundingClientRect()

            if (y >= box.top && y <= box.bottom) {
                return mark
            }

            if (previous && y > previous.bottom && y < box.top) {
                return previous.mark.window === mark.window && previous.mark.index === mark.index - 1 ? previous.mark : null
            }

            previous = { mark, bottom: box.bottom }
        }

        return null
    }

    onMove(event) {
        if (event.pointerType !== 'mouse' || event.buttons !== 0 || this.view === 'off' || (this.fine && !this.fine.matches)) {
            this.endHover()
            return
        }

        const mark = this.markAt(event.target) ?? this.markAtY(event.clientY)

        this.pointer = { x: event.clientX, y: event.clientY }

        // Off a marked block (a gap, a margin, a short unmarked line) the window under the pointer stays as it was: the
        // underline changes only when the pointer reaches a block of another window, and goes when it leaves the editor.
        if (!mark) {
            clearTimeout(this.hoverTimer)
            this.hoverTimer = null

            return
        }

        const next = mark.window

        if (next !== this.hoverWindow) {
            this.hoverWindow = next
            this.closeCard()
            this.schedule()
        }

        this.hoverEl = mark.el

        if (this.cardOpen) {
            return
        }

        clearTimeout(this.hoverTimer)
        this.hoverTimer = setTimeout(() => this.openCard(), 300)
    }

    closeCard() {
        clearTimeout(this.hoverTimer)
        this.hoverTimer = null

        if (this.cardOpen) {
            this.cardOpen = false
            this.onCard(null)
        }
    }

    endHover() {
        this.closeCard()
        this.hoverEl = null

        if (this.hoverWindow !== -1) {
            this.hoverWindow = -1
            this.schedule()
        }
    }

    // The caret in page coordinates, if it is in the root: the card does not cover it.
    caretBox(off) {
        const selection = this.win.getSelection?.()

        if (!selection || !selection.rangeCount || !this.root.contains(selection.anchorNode)) {
            return null
        }

        const range = selection.getRangeAt(0)
        const box = range.getClientRects()[0] ?? range.getBoundingClientRect()

        return box.width === 0 && box.height === 0 ? null : { top: box.top + off.y, bottom: box.bottom + off.y }
    }

    openCard() {
        this.hoverTimer = null

        const mark = this.hoverEl ? this.markOf.get(this.hoverEl) : null
        const win = mark ? this.windows[mark.window] : null

        if (!mark || !win || !mark.el.isConnected) {
            return
        }

        const lines = this.ownLineBoxes(mark.el)
        const found = lines.find((l) => this.pointer.y >= l.top - 4 && this.pointer.y <= l.bottom + 4) ?? lines[0]

        if (!found) {
            return
        }

        const off = this.offset()
        const line = { top: found.top + off.y, bottom: found.bottom + off.y }
        const roomAbove = line.top - CARD_GAP - CARD_HEIGHT >= 8
        const roomBelow = line.bottom + CARD_GAP + CARD_HEIGHT <= window.innerHeight - 8
        let above = roomAbove || !roomBelow
        const caret = this.caretBox(off)

        if (caret) {
            const coversAbove = caret.bottom > line.top - CARD_GAP - CARD_HEIGHT && caret.top < line.top
            const coversBelow = caret.top < line.bottom + CARD_GAP + CARD_HEIGHT && caret.bottom > line.bottom

            if (above && coversAbove && roomBelow) {
                above = false
            } else if (!above && coversBelow && roomAbove) {
                above = true
            }
        }

        const left = Math.min(Math.max(this.pointer.x + off.x - 28, 8), window.innerWidth - CARD_WIDTH - 8)

        this.cardOpen = true
        this.onCard({ ...markCard(mark.kind, win, this.t), left, top: above ? line.top - CARD_GAP : line.bottom + CARD_GAP, above })
    }

    destroy() {
        this.closeCard()
        this.area.removeEventListener('pointermove', this.onMove)
        this.area.removeEventListener('pointerleave', this.endHover)
        this.area.removeEventListener('pointerdown', this.closeCard)
        this.root.removeEventListener('input', this.closeCard)
        this.listen(false)
        this.resize?.disconnect()

        if (this.frame) {
            this.win?.cancelAnimationFrame(this.frame)
            this.frame = 0
        }

        this.layer.innerHTML = ''
    }
}
