(() => {
  /* ── Canvas sizing ─────────────────────────────────── */
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  let currentCycleForClock = 10;

  function sizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    drawUnityClock();
  }
  new ResizeObserver(sizeCanvas).observe(canvas);

  /* ── Roots of unity clock ──────────────────────────── */
  function drawUnityClock() {
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);

    const n = currentCycleForClock;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.32;
    const labelFont = Math.max(10, Math.min(16, radius / n * 2.5));

    // Real axis — thin gray horizontal line spanning full canvas width
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Fan lines from center to each root (drawn before labels so behind)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1;
    for (let k = 0; k < n; k++) {
      const angle = -(2 * Math.PI * k) / n;
      const fx = cx + (radius + labelFont) * Math.cos(angle);
      const fy = cy + (radius + labelFont) * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(fx, fy);
      ctx.stroke();
    }

    // Circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.30)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Labels at roots of unity — centered ON the circle
    // Standard complex analysis: 0 at east, proceeding counterclockwise
    ctx.font = `600 ${labelFont}px -apple-system, "SF Pro Display", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const labelPad = labelFont * 0.35;

    for (let k = 0; k < n; k++) {
      const angle = -(2 * Math.PI * k) / n;
      const lx = cx + radius * Math.cos(angle);
      const ly = cy + radius * Math.sin(angle);

      const text = String(k);
      const metrics = ctx.measureText(text);
      const tw = metrics.width + labelPad * 2;
      const th = labelFont + labelPad * 1.4;
      const cornerR = th * 0.3;

      // Rounded rectangle background
      ctx.beginPath();
      ctx.roundRect(lx - tw / 2, ly - th / 2, tw, th, cornerR);
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fill();

      // Label text
      ctx.fillStyle = "#111113";
      ctx.fillText(text, lx, ly);
    }
  }

  /* ── Sturmian Picker (coprimality) ────────────────── */
  const pickerCanvas = document.getElementById("picker_canvas");
  const pickerCtx = pickerCanvas.getContext("2d");
  const pickerTooltip = document.getElementById("picker_tooltip");
  const slopeDisplay = document.getElementById("slope_display");
  const inputPanel = document.getElementById("input_panel");
  let currentGridN = 20;
  let hoveredVertex = null;
  let currentOffset = 0; // kept in sync by offset slider onChange

  function gcd(a, b) {
    while (b) { const t = b; b = a % b; a = t; }
    return a;
  }

  function fracHTML(num, den) {
    return `<span class="vfrac"><span class="vfrac__num">${num}</span><span class="vfrac__den">${den}</span></span>`;
  }

  // Clip line y = s*x + b to canvas rectangle [0,w] x [0,h]
  function clipLine(s, b, w, h) {
    const pts = [];
    const add = (x, y) => {
      if (x >= -0.5 && x <= w + 0.5 && y >= -0.5 && y <= h + 0.5) {
        const cx = Math.max(0, Math.min(w, x));
        const cy = Math.max(0, Math.min(h, y));
        if (!pts.some(p => Math.abs(p[0] - cx) < 0.5 && Math.abs(p[1] - cy) < 0.5))
          pts.push([cx, cy]);
      }
    };
    add(0, b);
    add(w, s * w + b);
    if (Math.abs(s) > 1e-9) {
      add(-b / s, 0);
      add((h - b) / s, h);
    }
    return pts.slice(0, 2);
  }

  function drawSturmianLine(p, k) {
    const n = currentGridN;
    const w = pickerCanvas.width;
    const h = pickerCanvas.height;
    const cellW = w / n;
    const cellH = h / n;

    pickerCtx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    pickerCtx.lineWidth = 1;

    if (p === 0) {
      // Vertical line at x = 0 (left border)
      pickerCtx.beginPath();
      pickerCtx.moveTo(0, 0);
      pickerCtx.lineTo(0, h);
      pickerCtx.stroke();
      return;
    }

    // Math: y_math = (k/p)*x_math + currentOffset
    // Canvas: canvas_x = x_math*cellW, canvas_y = (n - y_math)*cellH
    // => canvas_y = h - (k/p)*(h/w)*canvas_x - currentOffset*cellH
    const s = -(k / p) * (cellH / cellW);
    const b = h - currentOffset * cellH;
    const pts = clipLine(s, b, w, h);
    if (pts.length < 2) return;
    pickerCtx.beginPath();
    pickerCtx.moveTo(pts[0][0], pts[0][1]);
    pickerCtx.lineTo(pts[1][0], pts[1][1]);
    pickerCtx.stroke();
  }

  function drawSturmianPicker() {
    const n = currentGridN;
    const w = pickerCanvas.clientWidth;
    const h = pickerCanvas.clientHeight;
    if (w === 0 || h === 0) return;
    pickerCanvas.width = w;
    pickerCanvas.height = h;

    pickerCtx.fillStyle = "#46464e";
    pickerCtx.fillRect(0, 0, w, h);

    const cellW = w / n;
    const cellH = h / n;

    // Grid lines
    pickerCtx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    pickerCtx.lineWidth = 0.5;
    pickerCtx.beginPath();
    for (let i = 0; i <= n; i++) {
      pickerCtx.moveTo(i * cellW, 0);
      pickerCtx.lineTo(i * cellW, h);
      pickerCtx.moveTo(0, i * cellH);
      pickerCtx.lineTo(w, i * cellH);
    }
    pickerCtx.stroke();

    // Coprime circles at grid vertices — same shade as grid lines
    const r = Math.min(cellW, cellH) / 2;
    pickerCtx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    pickerCtx.lineWidth = 1;
    for (let p = 0; p <= n; p++) {
      for (let k = 0; k <= n; k++) {
        if (gcd(p, k) === 1) {
          pickerCtx.beginPath();
          pickerCtx.arc(p * cellW, (n - k) * cellH, r, 0, 2 * Math.PI);
          pickerCtx.stroke();
        }
      }
    }

    // Dynamic Sturmian line when hovering a vertex
    if (hoveredVertex) drawSturmianLine(hoveredVertex.p, hoveredVertex.k);
  }

  function nearestCoprimeVertex(mouseX, mouseY, boxW, boxH) {
    const n = currentGridN;
    const cellW = boxW / n;
    const cellH = boxH / n;
    const r = Math.min(cellW, cellH) / 2;
    const p = Math.round(mouseX / cellW);
    const k = n - Math.round(mouseY / cellH);
    if (p < 0 || p > n || k < 0 || k > n) return null;
    if (gcd(p, k) !== 1) return null;
    const vx = p * cellW;
    const vy = (n - k) * cellH;
    const dx = mouseX - vx;
    const dy = mouseY - vy;
    if (dx * dx + dy * dy > r * r) return null;
    return { p, k, vx, vy };
  }

  pickerCanvas.addEventListener("mousemove", (e) => {
    const rect = pickerCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = nearestCoprimeVertex(x, y, rect.width, rect.height);

    const prevP = hoveredVertex ? hoveredVertex.p : -1;
    const prevK = hoveredVertex ? hoveredVertex.k : -1;

    if (hit) {
      hoveredVertex = hit;
      if (hit.p !== prevP || hit.k !== prevK) drawSturmianPicker();
      // Tooltip: fixed position in viewport, font from panel
      pickerTooltip.style.fontSize = getComputedStyle(inputPanel).fontSize;
      pickerTooltip.innerHTML = fracHTML(hit.k, hit.p);
      pickerTooltip.style.left = (rect.left + hit.vx) + "px";
      pickerTooltip.style.top  = (rect.top  + hit.vy) + "px";
      pickerTooltip.style.opacity = "1";
    } else {
      if (hoveredVertex) { hoveredVertex = null; drawSturmianPicker(); }
      pickerTooltip.style.opacity = "0";
    }
  });

  pickerCanvas.addEventListener("mouseleave", () => {
    if (hoveredVertex) { hoveredVertex = null; drawSturmianPicker(); }
    pickerTooltip.style.opacity = "0";
  });

  pickerCanvas.addEventListener("click", (e) => {
    const rect = pickerCanvas.getBoundingClientRect();
    const hit = nearestCoprimeVertex(
      e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height
    );
    if (hit) slopeDisplay.innerHTML = "slope\u00a0=\u00a0" + fracHTML(hit.k, hit.p);
  });

  new ResizeObserver(() => {
    hoveredVertex = null;
    drawSturmianPicker();
  }).observe(pickerCanvas);

  /* ── Panel resize ──────────────────────────────────── */
  const panel = document.getElementById("input_panel");
  const handle = document.getElementById("resize_handle");
  const pg = document.getElementById("playground");
  const snaps = [1, 120, 180, 240, 360, 480];

  let dragging = false;
  let startX, startW;

  function setPanelWidth(w) {
    pg.style.setProperty("--panel-width", w + "px");
  }

  function beginDrag(x) {
    dragging = true;
    startX = x;
    startW = panel.offsetWidth;
    pg.classList.remove("snapping");
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }

  const maxSnap = Math.max(...snaps);

  function moveDrag(x) {
    if (!dragging) return;
    const delta = startX - x;
    const w = Math.max(0, Math.min(startW + delta, maxSnap));
    setPanelWidth(w);
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    const cur = panel.offsetWidth;
    const nearest = snaps.reduce((a, b) =>
      Math.abs(b - cur) < Math.abs(a - cur) ? b : a
    );

    pg.classList.add("snapping");
    setPanelWidth(nearest);
  }

  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    beginDrag(e.clientX);
  });
  handle.addEventListener("pointermove", (e) => moveDrag(e.clientX));
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);

  pg.addEventListener("transitionend", () => {
    pg.classList.remove("snapping");
  });

  /* ── PiSlider (v2 — no DOM generation, CSS grid) ──── */
  /*
   * HTML provides the full markup:
   *   <div class="pi-slider" data-min="2" data-max="32"
   *        data-step="1" data-scale="quadratic" data-value="10"
   *        tabindex="0" role="slider">
   *     <div class="pi-slider__label">cycle</div>
   *     <div class="pi-slider__rail">
   *       <div class="pi-slider__track"></div>
   *       <div class="pi-slider__fill"></div>
   *       <div class="pi-slider__thumb"></div>
   *     </div>
   *   </div>
   */

  const SCALES = {
    lin(t, min, max) {
      return min + t * (max - min);
    },
    exp(t, min, max) {
      return ((Math.pow(10, t * 3) - 1) / 999) * (max - min) + min;
    },
    log(t, min, max) {
      const lo = Math.max(min, 1e-6);
      return Math.exp(Math.log(lo) + t * (Math.log(max) - Math.log(lo)));
    },
    quadratic(t, min, max) {
      return min + t * t * (max - min);
    },
  };

  class PiSlider {
    constructor(el) {
      this.el = el;
      this.min = Number(el.dataset.min) || 0;
      this.max = Number(el.dataset.max) || 1000;
      this.step = Number(el.dataset.step) || 1;
      this.scaleFn = SCALES[el.dataset.scale] || SCALES.lin;
      this.onChange = null;

      this._value = el.dataset.value !== undefined ? Number(el.dataset.value) : this.min;
      this._dragging = false;
      this._pointerId = null;

      this._rail = el.querySelector(".pi-slider__rail");
      this._thumb = el.querySelector(".pi-slider__thumb");

      this._bind();
      this._update();
    }

    get displayValue() {
      const raw = this.scaleFn(
        (this._value - this.min) / (this.max - this.min),
        this.min,
        this.max
      );
      return Number.isInteger(this.step) ? Math.round(raw) : +raw.toFixed(2);
    }

    setValue(v) {
      this._value = Math.max(this.min, Math.min(this.max, v));
      this._update();
    }

    setMax(newMax) {
      this.max = newMax;
      this.el.dataset.max = newMax;
      this.el.setAttribute("aria-valuemax", newMax);
      if (this._value > newMax) this._value = newMax;
      this._update();
    }

    _bind() {
      this.el.addEventListener("pointerdown", (e) => this._onDown(e));
      this.el.addEventListener("pointermove", (e) => this._onMove(e));
      this.el.addEventListener("pointerup", () => this._onUp());
      this.el.addEventListener("pointercancel", () => this._onUp());
      this.el.addEventListener("lostpointercapture", () => this._release());
      this.el.addEventListener("keydown", (e) => this._onKey(e));
    }

    _pctFromX(clientX) {
      const rect = this._rail.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    }

    _valueFromPct(pct) {
      let v = this.min + pct * (this.max - this.min);
      v = Math.round(v / this.step) * this.step;
      return Math.max(this.min, Math.min(this.max, v));
    }

    _onDown(e) {
      e.preventDefault();
      this.el.focus();
      this.el.setPointerCapture(e.pointerId);
      this._pointerId = e.pointerId;
      this._dragging = true;
      this._value = this._valueFromPct(this._pctFromX(e.clientX));
      this._update();
    }

    _onMove(e) {
      if (!this._dragging) return;
      this._value = this._valueFromPct(this._pctFromX(e.clientX));
      this._update();
    }

    _onUp() {
      if (!this._dragging) return;
      const pid = this._pointerId;
      this._release();
      if (pid !== null) {
        try { this.el.releasePointerCapture(pid); } catch (_) {}
      }
    }

    _onKey(e) {
      const big = e.shiftKey ? 10 : 1;
      let delta = 0;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") delta = this.step * big;
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") delta = -this.step * big;
      else if (e.key === "Home") { this._value = this.min; this._update(); e.preventDefault(); return; }
      else if (e.key === "End") { this._value = this.max; this._update(); e.preventDefault(); return; }
      else return;

      e.preventDefault();
      this._value = Math.max(this.min, Math.min(this.max, this._value + delta));
      this._update();
    }

    _release() {
      this._dragging = false;
      this._pointerId = null;
    }

    _update() {
      const pct = ((this._value - this.min) / (this.max - this.min)) * 100;
      this._rail.style.setProperty("--slider-pct", pct + "%");

      const display = this.displayValue;
      this._thumb.textContent = display;
      this.el.setAttribute("aria-valuenow", display);

      if (!Number.isInteger(display)) {
        this.el.dataset.parity = "frac";
      } else if (display % 2 === 0) {
        this.el.dataset.parity = "even";
      } else {
        this.el.dataset.parity = "odd";
      }

      if (this.onChange) this.onChange(display);
    }
  }

  // Auto-init
  const sliders = {};
  document.querySelectorAll(".pi-slider").forEach((el) => {
    const s = new PiSlider(el);
    if (el.id) sliders[el.id] = s;
  });

  function setPickerGridSize(n) {
    currentGridN = n;
    hoveredVertex = null;
    drawSturmianPicker();
  }

  // Wire cycle → length + picker grid
  const cycle = sliders.sl_cycle;
  const length = sliders.sl_length;
  const offsetSlider = sliders.sl_offset;

  if (offsetSlider) {
    currentOffset = offsetSlider.displayValue;
    offsetSlider.onChange = (v) => {
      currentOffset = v;
      if (hoveredVertex) drawSturmianPicker();
    };
  }

  if (cycle) {
    const gridSize = 2 * cycle.displayValue;
    currentCycleForClock = cycle.displayValue;
    setPickerGridSize(gridSize);
    drawUnityClock();
    slopeDisplay.innerHTML = "slope\u00a0=\u00a0" + fracHTML(1, cycle.displayValue);

    if (length) {
      length.setMax(gridSize);
      length.setValue(Math.floor(cycle.displayValue / 2));
    }

    cycle.onChange = (cycleVal) => {
      const gs = 2 * cycleVal;
      currentCycleForClock = cycleVal;
      setPickerGridSize(gs);
      drawUnityClock();
      if (length) {
        length.setMax(gs);
        length.setValue(Math.floor(cycleVal / 2));
      }
    };
  }

  window.PiSlider = PiSlider;

})();
