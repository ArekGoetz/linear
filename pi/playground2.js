(() => {
  /* ── Canvas sizing ─────────────────────────────────── */
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  function sizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
  new ResizeObserver(sizeCanvas).observe(canvas);

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

  // Picker grid — CSS-only via --grid-n custom property
  const pickerBox = document.getElementById("picker_box");

  function setPickerGridSize(n) {
    if (pickerBox) pickerBox.style.setProperty("--grid-n", n);
  }

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

  window.PiSlider = PiSlider;

})();
