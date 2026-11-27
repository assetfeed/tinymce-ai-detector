/**
 * The AI bar under the text, as in AssetFeed's own editors: the share of AI text with a meter, the marks view (highlight,
 * side bars only, hidden), when the text was checked and a button to check it again. The plugin puts it where it belongs in
 * its editor (under the text, above a status bar) and passes the editor's light or dark look.
 */

// Every rule starts with a scope: TinyMCE's skin resets its own elements (.tox :not(svg)) and would win over plain classes, so
// the TinyMCE plugin passes '.tox'. Other editors pass their own root class or nothing.
const CSS = `
.tox .aid-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 8px; border-top: 1px solid rgb(0 0 0 / .08);
  font: 13px/1.2 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; color: #111827; background: transparent; }
.tox .aid-bar.is-dark { color: #eceef1; border-top-color: rgb(255 255 255 / .1); }
.tox .aid-badge { --fg: #85888c; display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px; border-radius: 999px;
  background: #fff; box-shadow: 0 0 0 1px rgb(0 0 0 / .06); font-weight: 500; white-space: nowrap; }
.tox .aid-bar.is-dark .aid-badge { background: rgb(255 255 255 / .06); box-shadow: none; }
.tox .aid-badge--high, .tox .aid-badge--mid { --fg: oklch(64.6% 0.222 41.116); }
.tox .aid-badge--low { --fg: oklch(62.7% 0.194 149.214); }
.tox .aid-bar.is-dark .aid-badge--high, .tox .aid-bar.is-dark .aid-badge--mid { --fg: oklch(75% 0.183 55.934); }
.tox .aid-bar.is-dark .aid-badge--low { --fg: oklch(79.2% 0.209 151.711); }
.tox .aid-badge--high .aid-badge__label { color: oklch(55.3% 0.195 38.402); }
.tox .aid-bar.is-dark .aid-badge--high .aid-badge__label { color: oklch(75% 0.183 55.934); }
.tox .aid-badge__dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--fg); }
.tox .aid-badge.is-busy .aid-badge__dot { animation: aid-pulse 1s ease-in-out infinite; }
@keyframes aid-pulse { 50% { opacity: .25; } }
.tox .aid-badge__meter { flex: none; width: 40px; height: 4px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--fg) 20%, transparent); }
.tox .aid-badge__meter i { display: block; height: 100%; border-radius: inherit; background: var(--fg); }
.tox .aid-views { display: inline-flex; flex: none; gap: 2px; padding: 2px; border-radius: 999px; background: rgb(0 0 0 / .04); }
.tox .aid-bar.is-dark .aid-views { background: rgb(255 255 255 / .05); }
.tox .aid-views button { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 26px; padding: 0; border: 0; border-radius: 999px;
  background: transparent; color: #6b7280; cursor: pointer; }
.tox .aid-views button:hover { color: #111827; }
.tox .aid-views button[aria-checked="true"] { background: #fff; color: #111827; box-shadow: 0 1px 2px 0 rgb(0 0 0 / .08); }
.tox .aid-bar.is-dark .aid-views button { color: #a3a6ab; }
.tox .aid-bar.is-dark .aid-views button:hover { color: #fff; }
.tox .aid-bar.is-dark .aid-views button[aria-checked="true"] { background: #4b4e53; color: #fff; box-shadow: none; }
.tox .aid-views button:focus-visible, .tox .aid-run:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; }
.tox .aid-spacer { flex: 1 1 auto; }
.tox .aid-when { color: #6b7280; white-space: nowrap; font-variant-numeric: tabular-nums; }
.tox .aid-bar.is-dark .aid-when { color: #a3a6ab; }
.tox .aid-run { height: 30px; padding: 0 14px; border: 0; border-radius: 999px; background: #fff; color: inherit; font: inherit; font-weight: 500;
  box-shadow: 0 0 0 1px rgb(0 0 0 / .08); cursor: pointer; white-space: nowrap; }
.tox .aid-run:hover:not(:disabled) { box-shadow: 0 0 0 1px rgb(0 0 0 / .16); }
.tox .aid-run:disabled { opacity: .6; cursor: default; }
.tox .aid-bar.is-dark .aid-run { background: rgb(255 255 255 / .08); box-shadow: none; }
@media (prefers-reduced-motion: reduce) { .aid-badge.is-busy .aid-badge__dot { animation: none; } }
.tox .aid-bar [hidden] { display: none; }
`

// Lucide Highlighter, TextQuote and EyeOff (ISC licence), the same icons as in AssetFeed's editors.
const VIEW_ICONS = {
    highlight: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    bars: '<path d="M17 5H3"/><path d="M21 12H8"/><path d="M21 19H8"/><path d="M3 12v7"/>',
    off: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
}

export const VIEWS = ['highlight', 'bars', 'off']
const VIEW_LABEL = { highlight: 'Highlight passages', bars: 'Side bars only', off: 'Hide marks' }
const LEVEL = { ai: 'high', unsure: 'mid', human: 'low' }

const el = (doc, tag, cls, attrs = {}) => Object.assign(doc.createElement(tag), cls ? { className: cls } : {}, attrs)

/**
 * @param {object} o
 * @param {Document} o.doc  the page document the bar goes into
 * @param {string} [o.scope]  a selector the bar sits inside, prefixed to every rule ('.tox' in TinyMCE)
 * @param {(text: string, ...args: any[]) => string} o.t  the editor's translate
 * @param {() => void} o.onRun  check the text
 * @param {(view: string) => void} o.onView  a marks view was picked
 * @returns {{el: HTMLElement, render: (s: object) => void, remove: () => void}}  the caller places el
 */
export function createBar({ doc, scope = '', t, onRun, onView }) {

    const styleId = `aid-bar-style${scope ? `-${scope.replace(/\W/g, '')}` : ''}`

    if (!doc.getElementById(styleId)) {
        doc.head.appendChild(el(doc, 'style', '', { id: styleId, textContent: CSS.replaceAll('.tox ', scope ? `${scope} ` : '') }))
    }

    const bar = el(doc, 'div', 'aid-bar')
    const badge = el(doc, 'span', 'aid-badge')
    const dot = el(doc, 'span', 'aid-badge__dot')
    const label = el(doc, 'span', 'aid-badge__label')
    const meter = el(doc, 'span', 'aid-badge__meter')
    const fill = el(doc, 'i')
    const views = el(doc, 'div', 'aid-views', { role: 'radiogroup' })
    const when = el(doc, 'span', 'aid-when')
    const run = el(doc, 'button', 'aid-run', { type: 'button' })

    meter.appendChild(fill)
    badge.append(dot, label, meter)
    views.setAttribute('aria-label', t('Marks view'))

    const buttons = VIEWS.map((view) => {
        const button = el(doc, 'button', '', { type: 'button', title: t(VIEW_LABEL[view]) })

        button.setAttribute('role', 'radio')
        button.setAttribute('aria-label', t(VIEW_LABEL[view]))
        button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${VIEW_ICONS[view]}</svg>`
        button.addEventListener('click', () => onView(view))
        views.appendChild(button)

        return button
    })

    // Arrow keys move along the radio group, as in any radio group.
    views.addEventListener('keydown', (event) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
        const current = buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true')

        if (step && current >= 0) {
            event.preventDefault()
            const next = (current + step + VIEWS.length) % VIEWS.length

            onView(VIEWS[next])
            buttons[next].focus()
        }
    })
    run.addEventListener('click', () => onRun())
    bar.append(badge, views, el(doc, 'span', 'aid-spacer'), when, run)

    /**
     * @param {object} s
     * @param {'idle'|'busy'|'ok'|'stale'} s.status
     * @param {string} [s.kind]  ai | unsure | human, for ok
     * @param {number} [s.percent]  the share of AI text, for ok
     * @param {string} [s.view]  the marks view
     * @param {Date} [s.checkedAt]
     * @param {boolean} s.dark
     * @param {string} [s.background]  the colour behind the bar (the editor's frame may be see-through)
     */
    function render(s) {
        bar.classList.toggle('is-dark', s.dark)
        bar.style.background = s.background || ''
        badge.className = `aid-badge${s.status === 'ok' ? ` aid-badge--${LEVEL[s.kind] ?? 'mid'}` : ''}${s.status === 'busy' ? ' is-busy' : ''}`
        label.textContent = {
            idle: t('AI check: not run yet'),
            busy: t('Checking…'),
            ok: t('AI text {0}%', s.percent),
            stale: t('Text changed since the check: recheck'),
        }[s.status]
        meter.hidden = s.status !== 'ok'
        fill.style.width = `${Math.max(2, s.percent ?? 0)}%`
        views.hidden = s.status !== 'ok'
        buttons.forEach((button, i) => {
            const on = VIEWS[i] === s.view

            button.setAttribute('aria-checked', on ? 'true' : 'false')
            button.tabIndex = on ? 0 : -1
        })
        when.hidden = !(s.checkedAt && s.status === 'ok')
        when.textContent = s.checkedAt ? t('Checked {0}', s.checkedAt.toLocaleString()) : ''
        run.disabled = s.status === 'busy'
        run.textContent = s.status === 'idle' ? t('Check for AI writing') : t('Recheck')
    }

    return { el: bar, render, remove: () => bar.remove() }
}
