(() => {
  // src/card.js
  var CSS = `
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
`;
  var ICONS = {
    ai: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
    human: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    unsure: '<circle cx="12" cy="12" r="10"/><path d="M9 9.5a3 2.5 0 016 0c0 2-2 2-3 3.5"/><path d="M12 17h.01"/>'
  };
  var escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function createCard(dark) {
    if (!document.getElementById("aid-card-style")) {
      const style = document.createElement("style");
      style.id = "aid-card-style";
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.hidden = true;
    document.body.appendChild(el);
    const show = (card) => {
      if (!card) {
        el.hidden = true;
        return;
      }
      el.className = `aid-card aid-card--${card.kind}${card.above ? " is-above" : ""}${dark() ? " is-dark" : ""}`;
      el.style.left = `${card.left}px`;
      el.style.top = `${card.top}px`;
      el.innerHTML = `<div class="aid-card__head"><span class="aid-card__icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[card.kind]}</svg></span><span class="aid-card__label">${escape(card.label)}</span><span class="aid-card__words">${escape(card.words)}</span></div>` + (card.fill === null ? "" : `<div class="aid-card__meter"><i style="width:${Math.max(card.fill, 2)}%"></i></div>`) + (card.share ? `<p class="aid-card__share"><span class="aid-card__dot"></span>${escape(card.share)}</p>` : "");
      el.hidden = false;
    };
    return { show, remove: () => el.remove() };
  }

  // src/marks.js
  var BLOCKS = "p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th,div,pre,dt,dd,figcaption,caption,address";
  var INNER = /^(UL|OL|TABLE|BLOCKQUOTE|P|DIV|H[1-6])$/;
  var MIN_MARK_WORDS = 12;
  var STRONG_AI_SCORE = 0.85;
  var innerBlock = (el) => Array.from(el.children).find((child) => INNER.test(child.tagName));
  var collapse = (s) => s.replace(/\s+/g, " ").trim();
  function ownText(el) {
    let out = "";
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) {
          out += child.data;
        } else if (child.nodeType === 1) {
          if (child.tagName === "BR" || child.matches(BLOCKS)) {
            out += " ";
          } else {
            walk(child);
          }
        }
      }
    };
    walk(el);
    return out;
  }
  function collectBlocks(root) {
    return Array.from(root.querySelectorAll(BLOCKS)).map((el) => ({ el, text: collapse(ownText(el)) })).filter((block) => block.text !== "");
  }
  var RANK = { HUMAN: 1, UNSURE: 2, AI: 3 };
  var KIND = { AI: "ai", UNSURE: "unsure", HUMAN: "human" };
  var verdictOf = (win) => {
    const verdict = String(win?.verdict ?? "").toUpperCase();
    return RANK[verdict] ? verdict : null;
  };
  var kindOf = (win) => KIND[verdictOf(win)] ?? null;
  function lineWindows(windows) {
    const out = /* @__PURE__ */ new Map();
    (windows || []).forEach((win, wi) => {
      const verdict = verdictOf(win);
      if (!verdict) {
        return;
      }
      for (const index of win.paragraphs || []) {
        const current = out.get(Number(index));
        if (current === void 0 || RANK[verdict] > RANK[verdictOf(windows[current])]) {
          out.set(Number(index), wi);
        }
      }
    });
    return out;
  }
  var words = (text) => text.split(" ").filter(Boolean).length;
  function marksFor(blocks, result) {
    if (!result || result.status !== "ok") {
      return [];
    }
    const owner = lineWindows(result.windows);
    const marks = [];
    blocks.forEach(({ el, text }, index) => {
      const wi = owner.get(index);
      const kind = wi === void 0 ? null : kindOf(result.windows[wi]);
      if (kind && words(text) >= MIN_MARK_WORDS) {
        marks.push({ el, kind, window: wi, index });
      }
    });
    return marks;
  }
  function isTinted(kind, score) {
    return kind === "human" || kind === "ai" && typeof score === "number" && score >= STRONG_AI_SCORE;
  }
  var percent = (fraction) => Math.round(Math.min(1, Math.max(0, Number(fraction) || 0)) * 100);
  function markCard(kind, win, t) {
    const score = typeof win?.score === "number" && Number.isFinite(win.score) ? Math.min(1, Math.max(0, win.score)) : null;
    const ai = score === null ? null : Math.round(score * 100);
    const fill = ai === null ? null : kind === "human" ? 100 - ai : ai;
    const n = Math.max(0, Math.round(Number(win?.words) || 0));
    return {
      kind,
      label: t(LABEL[kind]),
      words: n === 1 ? t("1 word") : t("{0} words", n.toLocaleString("en-US")),
      share: fill === null ? null : t(kind === "human" ? "Human {0}%" : "AI {0}%", fill),
      fill
    };
  }
  var LABEL = { ai: "Likely AI", human: "Likely human", unsure: "Unsure" };

  // src/layer.js
  var PALETTE = {
    light: {
      ai: { accent: "oklch(64.6% 0.222 41.116)", bar: "color-mix(in oklab, oklch(70.5% 0.213 47.604) 85%, #fff)", tint: "color-mix(in srgb, oklch(64.6% 0.222 41.116) 15%, transparent)" },
      unsure: { accent: "oklch(82.8% 0.189 84.429)", bar: "oklch(87.9% 0.169 91.605)", tint: "color-mix(in srgb, oklch(82.8% 0.189 84.429) 22%, transparent)" },
      human: { accent: "oklch(62.7% 0.194 149.214)", bar: "color-mix(in oklab, oklch(72.3% 0.219 149.579) 75%, #fff)", tint: "color-mix(in srgb, oklch(72.3% 0.219 149.579) 12%, transparent)" }
    },
    dark: {
      ai: { accent: "oklch(75% 0.183 55.934)", bar: "color-mix(in oklab, oklch(75% 0.183 55.934) 85%, transparent)", tint: "color-mix(in srgb, oklch(75% 0.183 55.934) 17%, transparent)" },
      unsure: { accent: "oklch(82.8% 0.189 84.429)", bar: "color-mix(in oklab, oklch(87.9% 0.169 91.605) 80%, transparent)", tint: "color-mix(in srgb, oklch(82.8% 0.189 84.429) 16%, transparent)" },
      human: { accent: "oklch(79.2% 0.209 151.711)", bar: "color-mix(in oklab, oklch(79.2% 0.209 151.711) 80%, transparent)", tint: "color-mix(in srgb, oklch(79.2% 0.209 151.711) 13%, transparent)" }
    }
  };
  function layerCss(dark) {
    const s = ".aid-marks";
    const p = dark ? PALETTE.dark : PALETTE.light;
    return `
${s} { position: absolute; top: 0; left: 0; width: 0; height: 0; pointer-events: none; }
${s} > * { position: absolute; display: block; margin: 0; padding: 0; }
${s} > b { z-index: 0; border-radius: 4px; }
${s} > i { z-index: 2; width: 4px; border-radius: 999px; }
${s} > u { z-index: 2; height: 1.5px; border-radius: 1px; text-decoration: none; }` + ["ai", "unsure", "human"].map((kind) => `
${s} > i[data-kind="${kind}"] { background: ${p[kind].bar}; }
${s} > b[data-kind="${kind}"] { background: ${p[kind].tint}; }
${s} > u[data-kind="${kind}"] { background: ${p[kind].accent}; }`).join("");
  }
  function mergeLineRects(rects) {
    const list = Array.from(rects).filter((r) => r.right - r.left >= 1 && r.bottom - r.top >= 1).map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })).sort((a, b) => a.top - b.top || a.left - b.left);
    const out = [];
    for (const r of list) {
      const line = out.find((l) => Math.min(l.bottom, r.bottom) - Math.max(l.top, r.top) > Math.min(l.bottom - l.top, r.bottom - r.top) / 2);
      if (!line) {
        out.push(r);
        continue;
      }
      line.left = Math.min(line.left, r.left);
      line.right = Math.max(line.right, r.right);
      line.top = Math.min(line.top, r.top);
      line.bottom = Math.max(line.bottom, r.bottom);
    }
    return out;
  }
  var CARD_WIDTH = 224;
  var CARD_HEIGHT = 96;
  var CARD_GAP = 8;
  var px = (n) => `${n.toFixed(1)}px`;
  var MarkPainter = class {
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
      this.root = root;
      this.layer = layer;
      this.place = place;
      this.offset = offset || (() => ({ x: 0, y: 0 }));
      this.onCard = onCard || (() => {
      });
      this.t = t || ((text) => text);
      this.doc = root.ownerDocument;
      this.win = this.doc.defaultView;
      this.marks = [];
      this.windows = [];
      this.view = "highlight";
      this.markOf = /* @__PURE__ */ new Map();
      this.hoverWindow = -1;
      this.hoverEl = null;
      this.hoverTimer = null;
      this.cardOpen = false;
      this.pointer = { x: 0, y: 0 };
      this.frame = 0;
      this.fine = window.matchMedia ? window.matchMedia("(hover: hover) and (pointer: fine)") : null;
      this.schedule = this.schedule.bind(this);
      this.closeCard = this.closeCard.bind(this);
      this.endHover = this.endHover.bind(this);
      this.onMove = this.onMove.bind(this);
      this.area = root.tagName === "BODY" ? this.doc.documentElement : root;
      this.area.addEventListener("pointermove", this.onMove);
      this.area.addEventListener("pointerleave", this.endHover);
      this.area.addEventListener("pointerdown", this.closeCard);
      root.addEventListener("input", this.closeCard);
      this.listen(true);
      const Observer = this.win.ResizeObserver || window.ResizeObserver;
      this.resize = Observer ? new Observer(this.schedule) : null;
      this.resize?.observe(root);
    }
    listen(on) {
      const method = on ? "addEventListener" : "removeEventListener";
      const wins = this.win === window ? [window] : [this.win, window];
      for (const win of wins) {
        win[method]("keydown", this.closeCard, true);
        win[method]("scroll", this.closeCard, { capture: true, passive: true });
        win[method]("resize", this.schedule);
      }
      this.doc.fonts?.[method]?.("loadingdone", this.schedule);
    }
    /** marks: [{ el, kind, window, index }] in document order; windows: the stored answer's windows; view: highlight | bars | off. */
    update({ marks, windows, view }) {
      this.marks = marks || [];
      this.windows = windows || [];
      this.view = view || "highlight";
      this.markOf = new Map(this.marks.map((mark) => [mark.el, mark]));
      if (this.view === "off" || this.hoverEl && !this.markOf.has(this.hoverEl)) {
        this.endHover();
      }
      this.schedule();
    }
    schedule() {
      if (this.frame || !this.win) {
        return;
      }
      this.frame = this.win.requestAnimationFrame(() => {
        this.frame = 0;
        this.draw();
      });
    }
    ownLineBoxes(el) {
      const range = this.doc.createRange();
      range.selectNodeContents(el);
      const inner = innerBlock(el);
      if (inner) {
        range.setEndBefore(inner);
      }
      return mergeLineRects(range.getClientRects());
    }
    draw() {
      const out = [];
      if (this.view !== "off" && this.marks.length > 0 && this.root.isConnected) {
        const { dx, dy, barX } = this.place();
        const tints = this.view === "highlight";
        let group = null;
        const flush = () => {
          if (group && group.bottom - group.top > 6) {
            out.push(`<i data-kind="${group.kind}" style="left:${px(barX)};top:${px(group.top + 2)};height:${px(group.bottom - group.top - 4)}"></i>`);
          }
          group = null;
        };
        for (const { el, kind, window: wi, index } of this.marks) {
          if (!el.isConnected) {
            continue;
          }
          const box = el.getBoundingClientRect();
          const inner = innerBlock(el);
          const bottom = inner ? inner.getBoundingClientRect().top : box.bottom;
          if (bottom - box.top <= 0) {
            continue;
          }
          if (group && group.window === wi && group.index === index - 1) {
            group.bottom = bottom + dy;
            group.index = index;
          } else {
            flush();
            group = { kind, window: wi, index, top: box.top + dy, bottom: bottom + dy };
          }
          const tinted = tints && isTinted(kind, this.windows[wi]?.score);
          const hovered = wi === this.hoverWindow;
          if (!tinted && !hovered) {
            continue;
          }
          for (const line of this.ownLineBoxes(el)) {
            if (tinted) {
              out.push(`<b data-kind="${kind}" style="left:${px(line.left + dx - 3)};top:${px(line.top + dy - 1)};width:${px(line.right - line.left + 6)};height:${px(line.bottom - line.top + 2)}"></b>`);
            }
            if (hovered) {
              out.push(`<u data-kind="${kind}" style="left:${px(line.left + dx)};top:${px(line.bottom + dy + 1)};width:${px(line.right - line.left)}"></u>`);
            }
          }
        }
        flush();
      }
      this.layer.innerHTML = out.join("");
    }
    markAt(target) {
      for (let node = target; node && node !== this.root; node = node.parentNode) {
        const mark = this.markOf.get(node);
        if (mark) {
          return mark;
        }
      }
      return null;
    }
    /**
     * The mark at a height of the page, for a pointer that is not over a marked block: in the margin beside one, or in the gap
     * between two neighbouring blocks of one window (the gap belongs to the window, so its underline does not blink off and on
     * as the pointer moves from one paragraph to the next).
     */
    markAtY(y) {
      let previous = null;
      for (const mark of this.marks) {
        if (!mark.el.isConnected) {
          continue;
        }
        const box = mark.el.getBoundingClientRect();
        if (y >= box.top && y <= box.bottom) {
          return mark;
        }
        if (previous && y > previous.bottom && y < box.top) {
          return previous.mark.window === mark.window && previous.mark.index === mark.index - 1 ? previous.mark : null;
        }
        previous = { mark, bottom: box.bottom };
      }
      return null;
    }
    onMove(event) {
      if (event.pointerType !== "mouse" || event.buttons !== 0 || this.view === "off" || this.fine && !this.fine.matches) {
        this.endHover();
        return;
      }
      const mark = this.markAt(event.target) ?? this.markAtY(event.clientY);
      const next = mark ? mark.window : -1;
      this.pointer = { x: event.clientX, y: event.clientY };
      if (next !== this.hoverWindow) {
        this.hoverWindow = next;
        this.closeCard();
        this.schedule();
      }
      this.hoverEl = mark ? mark.el : null;
      if (!mark || this.cardOpen) {
        return;
      }
      clearTimeout(this.hoverTimer);
      this.hoverTimer = setTimeout(() => this.openCard(), 300);
    }
    closeCard() {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
      if (this.cardOpen) {
        this.cardOpen = false;
        this.onCard(null);
      }
    }
    endHover() {
      this.closeCard();
      this.hoverEl = null;
      if (this.hoverWindow !== -1) {
        this.hoverWindow = -1;
        this.schedule();
      }
    }
    // The caret in page coordinates, if it is in the root: the card does not cover it.
    caretBox(off) {
      const selection = this.win.getSelection?.();
      if (!selection || !selection.rangeCount || !this.root.contains(selection.anchorNode)) {
        return null;
      }
      const range = selection.getRangeAt(0);
      const box = range.getClientRects()[0] ?? range.getBoundingClientRect();
      return box.width === 0 && box.height === 0 ? null : { top: box.top + off.y, bottom: box.bottom + off.y };
    }
    openCard() {
      this.hoverTimer = null;
      const mark = this.hoverEl ? this.markOf.get(this.hoverEl) : null;
      const win = mark ? this.windows[mark.window] : null;
      if (!mark || !win || !mark.el.isConnected) {
        return;
      }
      const lines = this.ownLineBoxes(mark.el);
      const found = lines.find((l) => this.pointer.y >= l.top - 4 && this.pointer.y <= l.bottom + 4) ?? lines[0];
      if (!found) {
        return;
      }
      const off = this.offset();
      const line = { top: found.top + off.y, bottom: found.bottom + off.y };
      const roomAbove = line.top - CARD_GAP - CARD_HEIGHT >= 8;
      const roomBelow = line.bottom + CARD_GAP + CARD_HEIGHT <= window.innerHeight - 8;
      let above = roomAbove || !roomBelow;
      const caret = this.caretBox(off);
      if (caret) {
        const coversAbove = caret.bottom > line.top - CARD_GAP - CARD_HEIGHT && caret.top < line.top;
        const coversBelow = caret.top < line.bottom + CARD_GAP + CARD_HEIGHT && caret.bottom > line.bottom;
        if (above && coversAbove && roomBelow) {
          above = false;
        } else if (!above && coversBelow && roomAbove) {
          above = true;
        }
      }
      const left = Math.min(Math.max(this.pointer.x + off.x - 28, 8), window.innerWidth - CARD_WIDTH - 8);
      this.cardOpen = true;
      this.onCard({ ...markCard(mark.kind, win, this.t), left, top: above ? line.top - CARD_GAP : line.bottom + CARD_GAP, above });
    }
    destroy() {
      this.closeCard();
      this.area.removeEventListener("pointermove", this.onMove);
      this.area.removeEventListener("pointerleave", this.endHover);
      this.area.removeEventListener("pointerdown", this.closeCard);
      this.root.removeEventListener("input", this.closeCard);
      this.listen(false);
      this.resize?.disconnect();
      if (this.frame) {
        this.win?.cancelAnimationFrame(this.frame);
        this.frame = 0;
      }
      this.layer.innerHTML = "";
    }
  };

  // src/index.js
  var DEFAULT_ENDPOINT = "https://api.assetfeed.com/api/v1/ai-detector/checks";
  var ICON = (paths) => `<svg width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
  var ICON_CHECK = ICON('<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8h8"/><path d="M7 12h10"/><path d="M7 16h6"/>');
  var ICON_MARKS = ICON('<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>');
  var ERRORS = {
    401: "The AI check needs a valid AssetFeed API key.",
    402: "Not enough credits for this check.",
    429: "Too many checks at once. Try again in a minute.",
    503: "The detector is busy, try again in a minute."
  };
  var UTM = "utm_source=tinymce-ai-detector&utm_medium=plugin";
  var LINKS = {
    401: { text: "Get an API key", href: `https://assetfeed.com/api-keys?${UTM}` },
    402: { text: "See plans", href: `https://assetfeed.com/pricing?${UTM}` }
  };
  var escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  var DetectorError = class extends Error {
    constructor(status, message) {
      super(message || "");
      this.status = status;
    }
  };
  var opaque = (color) => color && color !== "transparent" && !/rgba\(.*,\s*0\)$/.test(color);
  function isDark(el) {
    const [r, g, b] = (getComputedStyle(el).color.match(/\d+(\.\d+)?/g) || [0, 0, 0]).map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140;
  }
  function plugin(editor) {
    const option = editor.options.register;
    option("aidetector_endpoint", { processor: "string", default: DEFAULT_ENDPOINT });
    option("aidetector_api_key", { processor: "string", default: "" });
    option("aidetector_request", { processor: "function" });
    const t = (text, ...args) => editor.translate(args.length ? [text, ...args] : text);
    function notify(text, type = "info", link = null) {
      const html = escapeHtml(text) + (link ? ` <a href="${escapeHtml(link.href)}" data-aid-link>${escapeHtml(t(link.text))}</a>` : "");
      const notification = editor.notificationManager.open({ text: html, type, timeout: link ? 0 : 8e3, closeButton: true });
      notification.getEl?.()?.querySelector("[data-aid-link]")?.addEventListener("click", (event) => {
        event.preventDefault();
        window.open(link.href, "_blank", "noopener");
      });
    }
    let busy = false;
    let visible = true;
    let state = null;
    let painter = null;
    let card = null;
    let dark = false;
    async function send(text) {
      const custom = editor.options.get("aidetector_request");
      if (custom) {
        return custom({ text });
      }
      const key = editor.options.get("aidetector_api_key");
      let response;
      try {
        response = await fetch(editor.options.get("aidetector_endpoint"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", ...key ? { "X-Api-Token": key } : {} },
          body: JSON.stringify({ text })
        });
      } catch (e) {
        throw new DetectorError(0, t("Could not reach the AI detector."));
      }
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new DetectorError(response.status, body?.error?.message || body?.message);
      }
      return body.data;
    }
    function mount() {
      if (painter || editor.inline) {
        return;
      }
      const doc = editor.getDoc();
      const body = editor.getBody();
      const html = doc.documentElement;
      const background = getComputedStyle(body).backgroundColor;
      const style = doc.createElement("style");
      dark = isDark(body);
      style.textContent = `html { position: relative;${opaque(background) ? ` background: ${background};` : ""} } body { position: relative; z-index: 1;${opaque(background) ? " background: transparent;" : ""} }${layerCss(dark)}`;
      doc.head.appendChild(style);
      const layer = doc.createElement("div");
      layer.className = "aid-marks";
      layer.setAttribute("aria-hidden", "true");
      html.appendChild(layer);
      card = createCard(() => dark);
      painter = new MarkPainter({
        root: body,
        layer,
        t,
        onCard: card.show,
        place: () => {
          const h = html.getBoundingClientRect();
          return { dx: -h.left, dy: -h.top, barX: Math.max(2, body.getBoundingClientRect().left - h.left - 10) };
        },
        offset: () => {
          const box = editor.iframeElement?.getBoundingClientRect();
          return box ? { x: box.left, y: box.top } : { x: 0, y: 0 };
        }
      });
    }
    function paint() {
      painter?.update({ marks: state?.marks, windows: state?.result?.windows, view: visible ? "highlight" : "off" });
      editor.dispatch("AiDetectorStateChange");
    }
    function clear() {
      if (state) {
        state = null;
        paint();
      }
    }
    async function check() {
      if (busy) {
        return;
      }
      const blocks = collectBlocks(editor.getBody());
      if (blocks.length === 0) {
        notify(t("Add some text to check."));
        return;
      }
      const text = blocks.map((block) => block.text).join("\n");
      busy = true;
      editor.setProgressState(true);
      try {
        const result = await send(text);
        const current = editor.removed ? null : collectBlocks(editor.getBody());
        if (!current || current.map((block) => block.text).join("\n") !== text) {
          return;
        }
        if (result?.status === "too_short") {
          notify(t("The text is too short to check. Add a few more sentences."));
        } else if (result?.status === "unsupported_language") {
          notify(t("Only English text can be checked for now."));
        } else if (result?.status === "ok") {
          mount();
          visible = true;
          state = { text, result, marks: marksFor(current, result) };
          paint();
          const kind = kindOf(result) ?? "unsure";
          notify(`${t(LABEL[kind])} \xB7 ${t("AI {0}%", percent(result.ai_fraction))}`, kind === "human" ? "success" : "warning");
        } else {
          throw new DetectorError(0);
        }
        editor.dispatch("AiDetectorResult", { result });
      } catch (e) {
        if (!editor.removed) {
          const known = ERRORS[e?.status];
          notify(known ? t(known) : e?.message || t("The AI check failed. Try again later."), "error", LINKS[e?.status]);
        }
      } finally {
        busy = false;
        if (!editor.removed) {
          editor.setProgressState(false);
        }
      }
    }
    editor.on("input change undo redo SetContent", () => {
      if (state && collectBlocks(editor.getBody()).map((block) => block.text).join("\n") !== state.text) {
        clear();
      }
    });
    editor.on("remove", () => {
      painter?.destroy();
      card?.remove();
    });
    editor.addCommand("AiDetectorCheck", check);
    editor.addCommand("AiDetectorClear", clear);
    editor.addCommand("AiDetectorToggleMarks", () => {
      visible = !visible;
      paint();
    });
    editor.ui.registry.addIcon("ai-detector", ICON_CHECK);
    editor.ui.registry.addIcon("ai-detector-marks", ICON_MARKS);
    editor.ui.registry.addButton("aidetector", {
      icon: "ai-detector",
      tooltip: "Check for AI writing",
      onAction: check
    });
    editor.ui.registry.addToggleButton("aidetectormarks", {
      icon: "ai-detector-marks",
      tooltip: "Show AI marks",
      onAction: () => editor.execCommand("AiDetectorToggleMarks"),
      onSetup: (api) => {
        const sync = () => {
          api.setEnabled(Boolean(state?.marks?.length));
          api.setActive(Boolean(state?.marks?.length) && visible);
        };
        sync();
        editor.on("AiDetectorStateChange", sync);
        return () => editor.off("AiDetectorStateChange", sync);
      }
    });
    editor.ui.registry.addMenuItem("aidetector", {
      icon: "ai-detector",
      text: "Check for AI writing",
      onAction: check
    });
    return {
      getMetadata: () => ({ name: "AI detector by AssetFeed", url: "https://github.com/assetfeed/tinymce-ai-detector" })
    };
  }
  function register(...globals) {
    for (const editors of globals) {
      editors?.PluginManager?.add("aidetector", plugin);
    }
  }
  if (typeof window !== "undefined") {
    register(window.tinymce, window.hugerte);
  }
})();
