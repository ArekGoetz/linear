# Pi Playground — Compact Reproducing Specification

Single-page app: `button.html` loads `pi.css` + `playground.js`. Dark theme (#111113 bg). Three-panel layout: left panel (MathJax formula), full-screen canvas (center), right panel (sliders + mechanical picker).

## Layout

`#playground` div, 100% viewport. Left/right panels are absolutely positioned `side-panel` divs with CSS-variable widths (`--left-panel-width`, `--right-panel-width`), resizable via drag handles that snap to [1, 120, 180, 240, 360, 480, 50vw] px on release. Panels have frosted-glass effect (`backdrop-filter: blur(3px)`). A snapping CSS transition (0.28s cubic-bezier) is toggled by class `snapping`. Fullscreen `#canvas` sits behind panels at z-index 0.

## Main Canvas — Roots of Unity Clock

Draws n-th roots of unity (n = cycle slider value) on a unit circle (radius = 0.32 × min(w,h)), centered. Each root ζ^k at angle −2πk/n gets a rounded-rect label showing index k. Labels colored by the mechanical word: blue (#508CFF) for −1, green (#50DC50) for +1, white for uncolored. Only the first L indices (sum length slider) are colored, using clockwise indexing `(n−k) mod n`.

**Fourier sum vector**: S = Σ_{j=0}^{L−1} ε_j · ζ^{−j} drawn as a white arrow from center to tip, with arrowhead and small circle at tip. Uses positive canvas angles so the y-flip renders the negative-exponent sum correctly.

**Cyclotomic lattice dots**: When lattice slider > 0, enumerate all integer-coefficient combinations in the power basis {1, ζ, …, ζ^{φ(n)−1}} with coefficients in [−max, max]. Drawn as yellow 2×2px dots. Hovering shows a tooltip with the coefficient tuple, with 0.8s fade-out on leave. Detection uses pseudoinverse of the 2×φ(n) basis matrix (Gram matrix G = MᵀM, invert 2×2).

Fan lines from center to each root, horizontal real-axis line, unit circle stroke — all drawn before labels.

## Right Panel — Sliders

**PiSlider class**: Custom slider built from existing HTML markup (no DOM generation). Structure: `.pi-slider > .pi-slider__label + .pi-slider__rail > (.pi-slider__track + .pi-slider__fill + .pi-slider__thumb)`. Thumb position and fill width driven by CSS variable `--slider-pct`.

- `data-min`, `data-max`, `data-step`, `data-scale` (lin/exp/log/quadratic), `data-value`
- During drag: `_rawPct` tracks raw pointer position for instant visual following (no `left` transition via `.dragging` class). On release (`_onUp`): clear drag state → call `onRelease` (magnetic snap) → call `_update` (CSS + thumb text + onChange) → release pointer capture. `lostpointercapture` routes through `_onUp` to avoid missed snaps.
- Keyboard: arrows step ±1 (±10 with shift). Custom `onKeyStep` callback for fraction stepping.
- Thumb color: `data-parity` attribute set to "even"/"odd"/"frac", drives CSS background via attribute selectors. Thumb backgrounds: gray (odd), gold (even), muted (frac).

**Four sliders**:
1. **cycle** (2–32, step 1): Sets n for roots of unity. Changes picker grid to (2n+1)×(2n+1), locks initial vertex at (p=n, k=1).
2. **offset** (−1 to 1, step 0.01): Phase shift for mechanical word. Keyboard steps through exact fractions with denominator ≤ 2·cycle. Magnetic snap on drag release via `close_frac` (Stern-Brocot mediant search), tolerance 0.03. Thumb shows fraction notation.
3. **sum length** (1 to 2·cycle, step 1): L for partial Fourier sum.
4. **cyclotomic lattice** (0–2, step 1): Controls `maxCoeff` for lattice dot enumeration (capped at 10000 points).

## Right Panel — Mechanical Picker

Square canvas (`#picker_canvas`, aspect-ratio 1) in a `.picker-box`. Grid of (2·cycle+1) cells spanning coordinates −1 to 2·cycle on each axis.

**Grid-to-pixel**: `gpx(p) = (p+1) × (w/n)`, `gpy(k) = (n−1−k) × (h/n)` — origin at grid (0,0), y-axis up.

**Drawing order** (z-index lowest to highest):
1. Background fill (rgba 70,70,78,0.85)
2. **Word dots** (colored discs on the slope line) — lowest z
3. Grid lines (0.5px, 14% white)
4. Axes (45% white, arrows at positive ends)
5. Coprime vertex circles (diameter = ⅓ mesh, 14% white stroke, no fill) at all (p,k) where gcd(p,k)=1
6. Locked/hovered overlays (parallelogram + slope line)

**Coprime vertex interaction**: `nearestCoprimeVertex` maps mouse to nearest grid vertex with gcd=1 within ½-cell radius. Hover draws overlay + tooltip (fraction k/p in vertical-fraction HTML). Click locks the vertex → updates slope display, mechanical word, and redraws the unity clock.

**Slope line**: White 1px line from (0, offset) to (p, k+offset). For p=0, draws vertical line at x=0.

**Parallelogram**: Farey parents of k/p give vertices (0,off), (b,a+off), (p,k+off), (d,c+off). Filled at 5% white, stroked at 12%. Farey parents computed via extended GCD: find b such that b·k ≡ 1 (mod p), then a = (b·k−1)/p, c = k−a, d = p−b.

### Word Dots on the Slope Line

Filled discs (radius = 0.15 × cell size) with dark borders, placed at **grid-line crossing points** of the slope line y = (k/p)x + offset:

- **Blue disc** (vertical crossing): at (rx, (k/p)·rx + offset) for rx = 0, 1, …, p−1
- **Green disc** (horizontal crossing): at ((yEdge−offset)·p/k, yEdge) where yEdge = ⌈offset⌉ + ry
- **Endpoint**: always included at (p, k+offset), forced green. If the last word-generated disc already covers it, recolor that disc green.
- **Initial lattice point**: if the first disc has integer y-coordinate, forced blue.
- **Domain**: x ≥ 0, any y (first and second quadrant). No y<0 filter.
- Colors: blue fill rgba(80,140,255,0.85) / stroke rgba(40,80,180), green fill rgba(80,220,80,0.85) / stroke rgba(30,130,30).

### Mechanical Word

`computeMechanicalWord(p, k, offset)`: Standard floor formula. Period = k+p, density t = k/(k+p), phase c = offset/(k+p). For j = 1…period: s_j = ⌊(j+c)·t⌋ − ⌊(j−1+c)·t⌋. s_j=1 → green (+1), s_j=0 → blue (−1).

**Recursive Farey decomposition** (`decomposeWordHTML`): Splits the word at the Farey mediant boundary. For k/p with parents a/b and c/d: wordA = first (a+b) characters, wordB = rest. Recursively decompose each, wrap in `<span class="word-nest-a">` (gray) / `word-nest-b` (beige). Base case (k=1, p=1 or no parents): each digit wrapped in its own nest span — blue digits in `word-nest-a`, green in `word-nest-b`.

## Mechanical Word Display CSS

`.word-display`: 0.6em font, tabular-nums, break-all, max-height 5em scrollable.

**Leaf digit spans**:
- `.word-h` (blue/horizontal): dark blue (#1E3CA0), bold 700, overline decoration
- `.word-v` (green/vertical): dark green (#146E1E), bold 700

**Nesting spans** (`.word-nest-a`, `.word-nest-b`): `display: inline-block; vertical-align: middle; border-radius: 4px`. Backgrounds match slider thumb brightness:
- `.word-nest-a`: rgba(220,220,225,0.92), border rgb(190,190,200)
- `.word-nest-b`: rgba(240,225,185,0.94), border rgb(210,195,150)

**Recursive padding via CSS native nesting** — each depth gets more padding via specificity cascade:
- Depth 1: 0.2em 0.33em
- Depth 2: 0.3em 0.44em
- Depth 3: 0.4em 0.55em
- Depth 4: 0.5em 0.66em
- Depth 5: 0.6em 0.77em
- Depth 6: 0.7em 0.88em

Uses `& :is(.word-nest-a, .word-nest-b)` nested selectors (CSS Nesting spec).

## Left Panel — Formula Display

MathJax-rendered LaTeX: `ζ = e^{2πi/n}` (simplified fraction) and `Σ_{j=0}^{L-1} ε_j ζ^{-j}`. Updated on cycle or length change. Uses `MathJax.typesetPromise` with `typesetClear` for re-rendering.

## Utility Functions

- `gcd(a,b)`: Euclidean algorithm
- `close_frac(x, maxDen)`: Stern-Brocot mediant search for best rational approximation
- `fracHTML(num, den)`: Vertical fraction display using `.vfrac` flexbox spans
- `eulerTotient(n)`: Standard trial-division Euler's totient

## CSS Architecture

Dark theme variables in `:root`. System font stack. Full reset (`box-sizing: border-box`, zero margin/padding). Responsive: `@media (pointer: coarse)` enlarges touch targets; `@media (max-width: 600px)` shrinks panels. Slider thumb transitions disabled during drag via `.dragging` class. Panel resize transitions via `.snapping` class. Picker tooltip is `position: fixed` with `transform: translate(-50%, -120%)` for above-point positioning.

## File Structure

```
pi/
  button.html  — Single page: playground div + 4 sliders + picker + left formula panel
  pi.css       — All styles (~420 lines)
  playground.js — All logic (~1170 lines, single IIFE)
  index.html   — Nav page linking to button.html
```

## HTML Structure (button.html)

```html
#playground
  #canvas                          (fullscreen, z:0)
  #left_handle.resize-handle       (drag handle)
  #left_panel.side-panel            (formula display)
  #right_handle.resize-handle       (drag handle)
  #picker_tooltip                   (fixed tooltip)
  #right_panel.side-panel
    #sl_cycle.pi-slider              (cycle 2–32)
    .mechanical-group
      #slope_display                 (slope = k/p, period)
      .picker-box > #picker_canvas   (coprime picker)
      #word_display                  (decomposed word)
    #sl_offset.pi-slider             (offset −1…1)
    #sl_length.pi-slider             (sum length)
    #sl_lattice.pi-slider            (lattice coeffs)
```

MathJax loaded from CDN (tex-chtml, async). No other dependencies.
