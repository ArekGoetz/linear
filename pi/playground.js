(() => {
  /* ── Canvas sizing ─────────────────────────────────── */
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  function sizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
  new ResizeObserver(sizeCanvas).observe(canvas);

  /* ── Picker canvas + grid ───────────────────────────── */
  const pickerCanvas = document.getElementById("picker_canvas");
  let pickerCtx = null;
  let currentGridSize = 20; // 2 * cycle default (10)

  if (pickerCanvas) {
    pickerCtx = pickerCanvas.getContext("2d");

    function sizePickerCanvas() {
      pickerCanvas.width = pickerCanvas.clientWidth;
      pickerCanvas.height = pickerCanvas.clientHeight;
      drawPickerGrid();
    }
    new ResizeObserver(sizePickerCanvas).observe(pickerCanvas);
  }

  function drawPickerGrid() {
    if (!pickerCtx) return;
    const w = pickerCanvas.width;
    const h = pickerCanvas.height;
    if (w === 0 || h === 0) return;

    pickerCtx.clearRect(0, 0, w, h);
    pickerCtx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    pickerCtx.lineWidth = 1;

    const cellW = w / currentGridSize;
    const cellH = h / currentGridSize;

    pickerCtx.beginPath();
    for (let i = 0; i <= currentGridSize; i++) {
      const x = Math.round(i * cellW) + 0.5;
      pickerCtx.moveTo(x, 0);
      pickerCtx.lineTo(x, h);
    }
    for (let i = 0; i <= currentGridSize; i++) {
      const y = Math.round(i * cellH) + 0.5;
      pickerCtx.moveTo(0, y);
      pickerCtx.lineTo(w, y);
    }
    pickerCtx.stroke();
  }

  function setPickerGridSize(n) {
    currentGridSize = n;
    drawPickerGrid();
  }

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

  /* ── PiSlider ──────────────────────────────────────── */
  /*
   * Reusable slider component.
   *
   * HTML usage:
   *   <div class="pi-slider"
   *        data-name="cycle"
   *        data-min="2" data-max="32"
   *        data-step="1"
   *        data-scale="quadratic">
   *   </div>
   *
   * data-scale: "lin" (default) | "exp" | "log" | "quadratic"
   * data-name:  variable name (shown as label above the slider)
   * data-min / data-max / data-step: range config
   * data-value: optional initial value (defaults to min)
   *
   * API:
   *   slider.displayValue  — current mapped display value
   *   slider.setValue(v)    — set raw internal value, triggers update
   *   slider.onChange       — callback(displayValue) on every change
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
      this.name = el.dataset.name || "";
      this.onChange = null;

      this._value = el.dataset.value !== undefined ? Number(el.dataset.value) : this.min;
      this._dragging = false;
      this._pointerId = null;

      this._buildDOM();
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

    _buildDOM() {
      this.el.tabIndex = 0;
      this.el.setAttribute("role", "slider");
      this.el.setAttribute("aria-valuemin", this.min);
      this.el.setAttribute("aria-valuemax", this.max);

      if (this.name) {
        const label = document.createElement("div");
        label.className = "pi-slider__label";
        label.textContent = this.name;
        this.el.appendChild(label);
      }

      const rail = document.createElement("div");
      rail.className = "pi-slider__rail";

      const track = document.createElement("div");
      track.className = "pi-slider__track";

      const fill = document.createElement("div");
      fill.className = "pi-slider__fill";

      const thumb = document.createElement("div");
      thumb.className = "pi-slider__thumb";

      rail.append(track, fill, thumb);
      this.el.appendChild(rail);

      this._rail = rail;
      this._thumb = thumb;
    }

    _bind() {
      this.el.addEventListener("pointerdown", (e) => this._onDown(e));
      this.el.addEventListener("pointermove", (e) => this._onMove(e));
      this.el.addEventListener("pointerup", (e) => this._onUp(e));
      this.el.addEventListener("pointercancel", (e) => this._onUp(e));
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

      // Set parity attribute — CSS handles the background color
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

  // Auto-init all .pi-slider elements, store by id for wiring
  const sliders = {};
  document.querySelectorAll(".pi-slider").forEach((el) => {
    const s = new PiSlider(el);
    if (el.id) sliders[el.id] = s;
  });

  // Wire cycle → length + picker grid
  const cycle = sliders.sl_cycle;
  const length = sliders.sl_length;

  if (cycle) {
    const gridSize = 2 * cycle.displayValue;
    setPickerGridSize(gridSize);

    if (length) {
      length.setMax(gridSize);
      length.setValue(Math.floor(cycle.displayValue / 2));
    }

    cycle.onChange = (cycleVal) => {
      const gs = 2 * cycleVal;
      setPickerGridSize(gs);
      if (length) {
        length.setMax(gs);
        length.setValue(Math.floor(cycleVal / 2));
      }
    };
  }

  // Expose for programmatic creation
  window.PiSlider = PiSlider;

})();
