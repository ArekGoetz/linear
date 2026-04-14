# CLAUDE.md — Agent Profile: Front-End HTML

This file configures Claude Code's behavior in this repository. Read it before writing any code. Rules here are not style preferences — they reflect load-bearing decisions embedded in the codebase and explicit design requirements from the project owner.

---

## Project Overview

A collection of interactive math visualizations served directly from GitHub Pages. No frameworks. No build step. No npm. Each page opens directly in a browser.

**Structure**
```
/                   ← hub (index.html)
  linear/           ← linear algebra visualizations
    FourierClock.html
    2d.html
    index.html
  pi/               ← roots of unity / Fourier sum playground
    fsum.html       ← main app (loads pi.css + playground.js)
    pi.css
    playground.js
    index.html
    SPEC.md
  real/             ← real analysis (placeholder, to be built)
    index.html
  CLAUDE.md         ← this file
```

**Why no framework?** Canvas-based visualizations require precise frame-by-frame control. Adding a rendering framework conflicts with the `requestAnimationFrame` loop and pointer-capture drag mechanics. Keeping everything in plain JS makes every pixel and event traceable without a build step.

---

## Tech Stack

| Concern | Tool | Notes |
|---|---|---|
| Markup | HTML5 | `<!DOCTYPE html>`, `lang="en"`, UTF-8 |
| Styles | CSS3 | Variables, grid, nesting, `backdrop-filter` |
| Logic | Vanilla JS (ES2020+) | IIFEs, no modules |
| Math rendering | MathJax 3 (CDN) | tex-chtml, configured before `<script src>` |
| Vector graphics | SVG (inline) | Used in `2d.html` for draggable arrows |
| Pixel graphics | HTML5 Canvas 2D | Used everywhere else |
| Dependencies | MathJax CDN only | No npm, no bundler |

---

## Design Philosophy

### Accessibility — Federal WCAG 2.1 AA (non-negotiable)

- Use semantic HTML: `<nav>`, `<main>`, `<section>`, `<button>`, `<label>`. Never use `<div>` or `<span>` for interactive elements.
- Custom widgets must have `tabindex="0"`, the appropriate `role=`, and matching `aria-*` attributes (`aria-valuemin`, `aria-valuemax`, `aria-valuenow` for sliders; `role="separator"` for resize handles).
- All interactive elements must be reachable via keyboard **Tab in logical top-to-bottom, left-to-right order**.
- Focus rings must be visible. Always provide `:focus-visible` styles. **Never** suppress with `outline: none` without a visible replacement.
- Color must not be the only way information is conveyed — add shape, text, or pattern as a second signal.
- Images need `alt` text; decorative images use `alt=""`.
- Minimum touch target size: 44×44 px (per WCAG 2.5.5).
- Test by tabbing through every control, then activating each with Enter/Space.

### CSS-First Principle

Always reach for a CSS solution before writing JavaScript. Modern CSS features are acceptable even if they require Chrome 105+, Firefox 121+, Safari 16.4+:

- `:has()`, `@container`, `calc()`, `clamp()`, `min()`, `max()`
- CSS custom properties, CSS nesting, `@layer`
- CSS animations and transitions
- Attribute selectors (`[data-parity="even"]`)
- `@media (pointer: coarse)`, `@media (prefers-color-scheme: light)`

Only fall back to JavaScript when an interaction is genuinely impossible in CSS (cross-element reactive state, canvas drawing, complex math).

### Color Contrast Rules

Two rules apply simultaneously:

1. **WCAG AA**: 4.5:1 contrast ratio for normal text; 3:1 for large text (18pt+ or 14pt bold).
2. **Per-channel minimum**: Any two visually adjacent colors must differ by **≥ 16 on at least one RGB channel** (1/16 of 255 ≈ 6.25%). Check nearest-neighbor pairs when defining a palette.

Palette verification (key adjacent pairs in this project):
- `--bg` `#111113` (17,17,19) vs `--surface` (42,42,48): Δ = 25 per channel ✓
- `--text` (248,248,248) vs `--text-dim` (220,220,220): Δ = 28 per channel ✓
- `--slider-fill` (200,200,205) vs `--slider-thumb-bg` (220,220,225): Δ = 20 per channel ✓

### Minimal UI

- **No borders by default.**
- If a border is natural (separates two distinct regions), use `width: 1px` in a color derived from the adjacent background: same hue, **10–20 channel units lighter** in dark mode.
  - Example: panel background `rgba(42,42,48)` → natural border `rgba(255,255,255,0.12)`.
- Tabs: active state is distinguished by font weight or a single bottom underline only — no filled box, no shadow.
- Avoid `box-shadow` except for floating elements (tooltips, modals, slider thumbs).

### Dark Mode by Default

```css
:root {
  color-scheme: dark;
  /* all palette variables assume dark */
}
@media (prefers-color-scheme: light) {
  :root {
    /* only redefine variables that change */
    --bg: #f5f5f7;
    --surface: rgba(210, 210, 215, 0.90);
    --text: rgb(20, 20, 22);
    --text-dim: rgb(90, 90, 100);
  }
}
```

Never duplicate the entire stylesheet for light mode — only redefine the variables that differ.

### Perfect Nested Resizing

- Every container must adapt cleanly when its parent resizes.
- Use `%`, `em`, `min()`, `max()`, `clamp()` — avoid hardcoded `px` for widths/heights of fluid elements.
- Font size scales with panel width: `min(calc(var(--panel-width) / 8), 24px)`.
- Use `aspect-ratio` to maintain proportions without JS.
- Canvas sizing always goes through `ResizeObserver` (never `window.resize`).

### Mobile / Tablet (Low-Effort Rule)

If a responsive change costs fewer than ~10 extra lines of CSS, add it.

```css
@media (pointer: coarse) {
  /* enlarge touch targets */
}
@media (max-width: 600px) {
  /* adjust layout breakpoints */
}
```

Touch targets must not overlap; use `gap` or `padding` to separate them.

### Reactivity-First Architecture

Before writing any code, map out all user-controllable elements and their downstream effects.

- **One source of truth per state value.** A `let` variable in the IIFE owns the value; all dependent views read from it. Never let two elements each hold a copy of the same state.
- **CSS variables as a reactive channel for visual state.** Set `--slider-pct` once on the slider root; fill width and thumb position update automatically via CSS.
- **Synchronous updates.** When a slider moves, a picker cell is clicked, or a panel resizes — all dependent text fields and canvas renders update in the same event handler. No `setTimeout`, no deferred batching.
- **Design the data flow before writing DOM code.** Sketch: what does this element own? What reads from it? How does a change propagate?

---

## Code Conventions

### HTML

**Structure first, scripts last.** Put all `<script>` tags at the end of `<body>`, or use `defer`/`async`. Exception: MathJax config object must appear *before* its `<script src>`.

```html
<!-- CORRECT: config before loader -->
<script>
MathJax = {
  tex: { inlineMath: [['\\(', '\\)']] },
  options: { skipHtmlTags: ['script','noscript','style','textarea'] }
};
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js" async></script>
```

**Data attributes are widget configuration.** Sliders read `data-min`, `data-max`, `data-step`, `data-value`, `data-scale` from their root element at startup. HTML is the source of truth. JS reads once; never passes the same info via function arguments.

**Accessible custom widgets:**
```html
<div class="pi-slider" id="sl_cycle"
     data-min="2" data-max="32" data-step="1" data-value="8"
     tabindex="0" role="slider"
     aria-valuemin="2" aria-valuemax="32" aria-valuenow="8"
     aria-label="Cycle length">
```

### CSS

**CSS variables: theme on `:root`, widget-local on component root.**
```css
:root {
  color-scheme: dark;
  --bg: #111113;
  --surface: rgba(42, 42, 48, 0.50);
  --text: rgb(248, 248, 248);
  --text-dim: rgb(220, 220, 220);
  --transition-snap: 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
/* Panel-scoped — only meaningful inside #playground */
#playground {
  --right-panel-width: min(240px, 50vw);
  --left-panel-width:  min(240px, 50vw);
}
/* Slider-scoped — only meaningful inside .pi-slider */
.pi-slider__fill  { width: var(--slider-pct, 0%); }
.pi-slider__thumb { left:  var(--slider-pct, 0%); }
```

**JS writes CSS variables only via `setProperty`:**
```js
// CORRECT
el.style.setProperty('--slider-pct', pct + '%');
// WRONG
el.style.width = pct + '%';
```

**Transitions toggled via classes, never via inline style:**
```css
.pi-slider.dragging .pi-slider__thumb { transition: none; }
```
```js
el.classList.add('dragging');    // disable during drag
el.classList.remove('dragging'); // restore on release
```

**Snap animation via `.snapping` class:**
```js
pg.classList.add('snapping');
pg.style.setProperty('--right-panel-width', nearest + 'px');
pg.addEventListener('transitionend', () => pg.classList.remove('snapping'), { once: true });
```

**`:focus-visible` always present on interactive elements:**
```css
.pi-slider:focus-visible .pi-slider__thumb {
  box-shadow: 0 0 0 2px var(--slider-fill), 0 1px 4px rgba(0,0,0,0.45);
}
.some-button:focus { outline: none; }                     /* WRONG — never do this */
.some-button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; } /* CORRECT */
```

**Responsive touch targets:**
```css
@media (pointer: coarse) {
  .resize-handle { width: 28px; height: 48px; }
  .pi-slider__thumb { padding: 0.25em 0.65em; }
}
```

### JavaScript

**One IIFE per page.** No ES modules, no `type="module"`, no global leaks.
```js
(() => {
  let state = ...;
  // everything lives here
})();
```

**State as `let` at IIFE scope:**
```js
let currentWord = [];
let hoveredVertex = null;
```

**Canvas sizing via ResizeObserver:**
```js
function sizeCanvas() {
  canvas.width  = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  redraw();
}
new ResizeObserver(sizeCanvas).observe(canvas);
```

**Guard zero-size canvas at start of every draw:**
```js
function redraw() {
  const w = canvas.width, h = canvas.height;
  if (w === 0 || h === 0) return;
  ctx.clearRect(0, 0, w, h);
}
```

**Pointer events for drag (not mouse events):**
```js
el.addEventListener('pointerdown', (e) => {
  el.setPointerCapture(e.pointerId);
});
el.addEventListener('pointermove', (e) => { /* move */ });
el.addEventListener('pointerup',   (e) => {
  try { el.releasePointerCapture(e.pointerId); } catch (_) {}
});
el.addEventListener('lostpointercapture', () => {
  dragging = false; // safety cleanup
});
```

**MathJax re-render guard:**
```js
if (window.MathJax?.typesetPromise) {
  MathJax.typesetClear([el]);
  el.innerHTML = html;
  MathJax.typesetPromise([el]);
} else {
  el.innerHTML = html;
}
```

---

## Reusable Panel System (copy-paste template for new projects)

The panel system from `pi/` is the canonical template for all future projects.

### Palette
```css
:root {
  color-scheme: dark;
  --bg:                   #111113;
  --surface:              rgba(42, 42, 48, 0.50);   /* panel + backdrop-blur */
  --surface-picker:       rgba(70, 70, 78, 0.85);   /* nested surface */
  --text:                 rgb(248, 248, 248);
  --text-dim:             rgb(220, 220, 220);
  --handle-dot:           rgba(255, 255, 255, 0.35);
  --slider-track:         rgba(255, 255, 255, 0.10);
  --slider-fill:          rgb(200, 200, 205);
  --slider-thumb-bg:      rgba(220, 220, 225, 0.92);
  --slider-thumb-bg-alt:  rgba(240, 225, 185, 0.94);
  --border-natural:       rgba(255, 255, 255, 0.12);
  --transition-snap:      0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
```

### Panel HTML skeleton
```html
<div id="playground">
  <canvas id="canvas"></canvas>
  <div id="left_handle"  class="resize-handle resize-handle--left"
       role="separator" aria-orientation="vertical"
       tabindex="0" aria-label="Resize left panel"></div>
  <div id="left_panel"   class="side-panel side-panel--left">
    <!-- content -->
  </div>
  <div id="right_handle" class="resize-handle resize-handle--right"
       role="separator" aria-orientation="vertical"
       tabindex="0" aria-label="Resize right panel"></div>
  <div id="right_panel"  class="side-panel side-panel--right">
    <!-- content -->
  </div>
</div>
```

### Panel behavior rules
- Width stored in `--right-panel-width` / `--left-panel-width` on `#playground`
- Drag: pointer events + `setPointerCapture`
- Release: snap to nearest in `[1, 120, 180, 240, 360, 480, window.innerWidth * 0.5]` px
- Snap animation: add `.snapping` → set variable → remove on `transitionend`
- Panel CSS: `backdrop-filter: blur(3px)`, `background: var(--surface)`, `z-index: 2`, `overflow-y: auto`
- Resize handle CSS: `background: rgba(52,52,58,0.9)`, `border: 1.5px solid var(--border-natural)`, `border-radius: 6px`, `z-index: 10`
- Font scales: `min(calc(var(--panel-width) / 8), 24px)`

### Tooltip pattern
```css
.tooltip {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  padding: 0.25em 0.5em;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.92);
  color: #111113;
  font-weight: 600;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.12s;
}
/* above element */ .tooltip--above { transform: translate(-50%, -120%); }
/* left of element */ .tooltip--left  { transform: translate(-110%, -50%); }
```
Visibility via `opacity` + transition — never `display: none`.

---

## Things to Avoid

- **Do not add a framework.** React/Vue/Svelte require a build step and conflict with the canvas loop.
- **Do not introduce npm or a bundler.** No `package.json`. Zero build step is intentional.
- **Do not use `window.addEventListener('resize', ...)` to size canvases.** Use `ResizeObserver`.
- **Do not use `outline: none` without a `:focus-visible` replacement.**
- **Do not allow two elements to each independently hold the same state.** One owns it; others read it.
- **Do not use `setTimeout` to defer UI updates from user interaction.** Update synchronously in the handler.
- **Do not use color as the only signal.** Pair color with shape, text, or pattern.
- **Do not skip `lostpointercapture`.** Pointer capture can be silently lost — always add the safety cleanup handler.
- **Do not set component-scoped CSS variables on `:root`.** Slider pct, panel widths etc. belong on the component root element.
- **Do not re-render MathJax more than necessary.** `typesetPromise` is expensive — call only when the formula actually changes.
- **Do not hardcode pixel sizes for canvas or fluid layout elements.** Derive from `clientWidth`/`clientHeight` in `ResizeObserver`, and from `getBoundingClientRect()` in hit-test code.

---

## Testing Checklist

Run before every commit:

**Browser basics**
- [ ] Open directly in browser (`file://` or local server)
- [ ] Resize window to 375px wide and 1440px wide — no overflow, no broken layout
- [ ] Zero errors and zero warnings in browser console

**Keyboard / accessibility**
- [ ] Tab through every interactive element — confirm logical top-to-bottom order, no skips
- [ ] Activate each interactive element with Enter or Space
- [ ] All focus rings are visible (not just `:focus`, but `:focus-visible`)
- [ ] Check color contrast with DevTools or axe extension

**Touch**
- [ ] Test with DevTools touch emulation (pointer: coarse)
- [ ] All drag handles and sliders reachable with a finger-sized target

**Canvas**
- [ ] Resize window while animation runs — no artifacts, no trails
- [ ] `clearRect` called before each redraw

**MathJax (if present)**
- [ ] Cycle through several formula values — no ghost elements left behind

---

## Reusability Notes

**Generalizes to any vanilla HTML project:**
- IIFE pattern for JS isolation
- ResizeObserver for canvas sizing
- Pointer events + `setPointerCapture` for drag
- Class-toggle for transitions during drag (`.dragging`, `.snapping`)
- CSS variable scoping (`:root` for theme, component root for widget state)
- Reactivity-first data-flow design
- `@media (pointer: coarse)` for touch sizing
- Palette + panel system (copy from the template section above)

**Specific to this project (replace for future projects):**
- CSS variable names (`--right-panel-width`, `--slider-pct`)
- Snap point values `[1, 120, 180, 240, 360, 480]`
- `PiSlider` class API and Fourier/coprimality math utilities
- File layout under `pi/`
