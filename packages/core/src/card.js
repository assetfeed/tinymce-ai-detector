/**
 * The hover card of a marked passage: icon, verdict, words, a bar and the share. It lives in the page (not in the editor's
 * iframe), fixed to the viewport, above the hovered line unless there is no room. It repeats what the marks already say, so it
 * is hidden from assistive tech and takes no pointer events.
 */

const CSS = `
.aid-card { --fg: oklch(64.6% 0.222 41.116); --text: oklch(55.3% 0.195 38.402); --tint: color-mix(in srgb, oklch(64.6% 0.222 41.116) 15%, transparent);
  position: fixed; z-index: 1400; box-sizing: border-box; width: 224px; padding: 12px 14px; border-radius: 14px; background: #fff; color: #111827;
  box-shadow: 0 12px 32px -10px rgb(0 0 0 / .22), 0 2px 6px rgb(0 0 0 / .06), 0 0 0 1px rgb(0 0 0 / .04);
  font: 14px/1.2 ui-sans-serif, system-ui, sans-serif; pointer-events: none; animation: aid-card-in .12s ease-out; }
.aid-card.is-above { transform: translateY(-100%); animation-name: aid-card-in-above; }
@keyframes aid-card-in { from { opacity: 0; transform: translateY(-2px); } }
@keyframes aid-card-in-above { from { opacity: 0; transform: translateY(calc(-100% + 2px)); } }
.aid-card--unsure { --fg: oklch(82.8% 0.189 84.429); --text: oklch(55.5% 0.163 48.998); --tint: color-mix(in srgb, oklch(82.8% 0.189 84.429) 22%, transparent); }
.aid-card--human { --fg: oklch(62.7% 0.194 149.214); --text: oklch(52.7% 0.154 150.069); --tint: color-mix(in srgb, oklch(72.3% 0.219 149.579) 12%, transparent); }
.aid-card.is-dark { --fg: oklch(75% 0.183 55.934); --text: oklch(75% 0.183 55.934); --tint: color-mix(in srgb, oklch(75% 0.183 55.934) 17%, transparent);
  background: #1f2125; color: #eceef1; box-shadow: 0 12px 32px -10px rgb(0 0 0 / .7), 0 0 0 1px rgb(255 255 255 / .06); }
.aid-card.is-dark.aid-card--unsure { --fg: oklch(82.8% 0.189 84.429); --text: oklch(87.9% 0.169 91.605); --tint: color-mix(in srgb, oklch(82.8% 0.189 84.429) 16%, transparent); }
.aid-card.is-dark.aid-card--human { --fg: oklch(79.2% 0.209 151.711); --text: oklch(79.2% 0.209 151.711); --tint: color-mix(in srgb, oklch(79.2% 0.209 151.711) 13%, transparent); }
.aid-card__head { display: flex; align-items: center; gap: 8px; }
.aid-card__icon { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; background: var(--tint); color: var(--text); }
.aid-card__label { font-weight: 600; }
.aid-card__words { margin-left: auto; font-size: 12px; color: #5b6472; font-variant-numeric: tabular-nums; white-space: nowrap; }
.aid-card.is-dark .aid-card__words { color: #85888c; }
.aid-card__meter { height: 6px; margin-top: 12px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--fg) 18%, transparent); }
.aid-card__meter i { display: block; height: 100%; border-radius: inherit; background: var(--fg); }
.aid-card__share { display: flex; align-items: center; gap: 6px; margin: 8px 0 0; font-size: 12px; font-weight: 500; color: #4b5563; font-variant-numeric: tabular-nums; }
.aid-card.is-dark .aid-card__share { color: #c5c8cc; }
.aid-card__dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--fg); }
@media (prefers-reduced-motion: reduce) { .aid-card { animation: none; } }
`

// Lucide Bot, User and CircleQuestionMark (ISC licence), 24px grid.
const ICONS = {
    ai: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
    human: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    unsure: '<circle cx="12" cy="12" r="10"/><path d="M9 9.5a3 2.5 0 016 0c0 2-2 2-3 3.5"/><path d="M12 17h.01"/>',
}

const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/** The card's element in the page, and a function that shows a card ({ kind, label, words, share, fill, left, top, above }) or hides it (null). */
export function createCard(dark) {
    if (!document.getElementById('aid-card-style')) {
        const style = document.createElement('style')

        style.id = 'aid-card-style'
        style.textContent = CSS
        document.head.appendChild(style)
    }

    const el = document.createElement('div')

    el.setAttribute('aria-hidden', 'true')
    el.hidden = true
    document.body.appendChild(el)

    const show = (card) => {
        if (!card) {
            el.hidden = true
            return
        }

        el.className = `aid-card aid-card--${card.kind}${card.above ? ' is-above' : ''}${dark() ? ' is-dark' : ''}`
        el.style.left = `${card.left}px`
        el.style.top = `${card.top}px`
        el.innerHTML = `<div class="aid-card__head"><span class="aid-card__icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[card.kind]}</svg></span>`
            + `<span class="aid-card__label">${escape(card.label)}</span><span class="aid-card__words">${escape(card.words)}</span></div>`
            + (card.fill === null ? '' : `<div class="aid-card__meter"><i style="width:${Math.max(card.fill, 2)}%"></i></div>`)
            + (card.share ? `<p class="aid-card__share"><span class="aid-card__dot"></span>${escape(card.share)}</p>` : '')
        el.hidden = false
    }

    return { show, remove: () => el.remove() }
}
