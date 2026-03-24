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

  /* ── Custom slider logic ───────────────────────────── */
  function initSlider(wrap) {
    const min = Number(wrap.dataset.min) || 0;
    const max = Number(wrap.dataset.max) || 1000;
    const step = Number(wrap.dataset.step) || 1;
    const isExp = wrap.dataset.exp === "true";
    const thumb = wrap.querySelector(".slider-thumb");

    let value = Number(wrap.dataset.value) || min;
    let isDragging = false;

    function linToExp(lin) {
      const t = (lin - min) / (max - min);
      return Math.round(((Math.pow(10, t * 3) - 1) / 999) * (max - min) + min);
    }

    function pctFromX(clientX) {
      const rect = wrap.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    }

    function update() {
      const pct = ((value - min) / (max - min)) * 100;
      wrap.style.setProperty("--slider-pct", pct + "%");
      const display = isExp ? linToExp(value) : value;
      thumb.textContent = display;
    }

    wrap.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      wrap.setPointerCapture(e.pointerId);
      isDragging = true;

      const pct = pctFromX(e.clientX);
      value = Math.round((min + pct * (max - min)) / step) * step;
      update();
    });

    wrap.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      const pct = pctFromX(e.clientX);
      value = Math.round((min + pct * (max - min)) / step) * step;
      value = Math.max(min, Math.min(max, value));
      update();
    });

    wrap.addEventListener("pointerup", () => { isDragging = false; });
    wrap.addEventListener("pointercancel", () => { isDragging = false; });

    update();
  }

  document.querySelectorAll(".slider-wrap").forEach(initSlider);

})();
