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

  function moveDrag(x) {
    if (!dragging) return;
    const delta = startX - x;
    const w = Math.max(0, startW + delta);
    const maxW = pg.clientWidth * 0.85;
    setPanelWidth(Math.min(w, maxW));
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
   *        data-name="MyVar"
   *        data-min="0" data-max="1000"
   *        data-step="1"
   *        data-scale="exp">
   *   </div>
   *
   * data-scale: "lin" (default) | "exp" | "log" | "quadratic"
   * data-name:  variable label (displayed above slider)
   * data-min / data-max / data-step: range config
   *
   * The slider auto-generates its inner DOM and manages all
   * interaction. Read the current display value via .displayValue.
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

      this._value = Number(el.dataset.value) || this.min;
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

    _buildDOM() {
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

    _onUp(e) {
      if (!this._dragging) return;
      this._release();
      if (this._pointerId !== null) {
        try { this.el.releasePointerCapture(this._pointerId); } catch (_) {}
      }
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

      // Set parity attribute — CSS handles the background color
      if (!Number.isInteger(display)) {
        this.el.dataset.parity = "frac";
      } else if (display % 2 === 0) {
        this.el.dataset.parity = "even";
      } else {
        this.el.dataset.parity = "odd";
      }
    }
  }

  // Auto-init all .pi-slider elements
  document.querySelectorAll(".pi-slider").forEach((el) => new PiSlider(el));

  // Expose for programmatic creation
  window.PiSlider = PiSlider;

})();
