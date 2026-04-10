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

  // Current Mechanical word for clock coloring (set from wiring section)
  let currentWord = [];
  let currentLengthForClock = 1;

  // Cyclotomic lattice — integer combos in power basis {1, ζ, …, ζ^{φ(n)-1}}
  let cycloPhi = 0;
  let cycloBasis = [];
  let cycloGinv = null;
  let cycloLatticeDots = [];
  let hoveredLatticePoint = null;
  let latticeAlpha = 0;
  let fadeRAF = null;
  let currentLatticeMax = 0;

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
    const period = currentWord.length || 1;

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

    // Labels at roots of unity — colored by Mechanical word (repeating)
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

      // Color by Mechanical word: -1 → blue, 1 → green
      // Use clockwise index so ε_j matches e^{-2πij/n} (CW on screen)
      // Only color indices 0..L-1 (sum length); rest stay white
      const cwIdx = ((n - k) % n);
      const L = currentLengthForClock;
      const wordVal = (currentWord.length > 0 && cwIdx < L)
        ? currentWord[cwIdx % period] : 0;
      let bgColor;
      if (wordVal === -1) bgColor = "rgba(80, 140, 255, 0.85)";
      else if (wordVal === 1) bgColor = "rgba(80, 220, 80, 0.85)";
      else bgColor = "rgba(255, 255, 255, 0.9)";

      // Rounded rectangle background
      ctx.beginPath();
      ctx.roundRect(lx - tw / 2, ly - th / 2, tw, th, cornerR);
      ctx.fillStyle = bgColor;
      ctx.fill();

      // Label text
      ctx.fillStyle = "#111113";
      ctx.fillText(text, lx, ly);
    }

    // Fourier sum vector: S = sum_{j=0}^{L-1} epsilon_j * e^{-2*pi*i*j/n}
    // Use positive canvas angle so the y-flip renders the negative-exponent sum correctly
    if (currentWord.length > 0) {
      const L = currentLengthForClock;
      let re = 0, im = 0;
      for (let j = 0; j < L; j++) {
        const eps = currentWord[j % period];
        const angle = (2 * Math.PI * j) / n;
        re += eps * Math.cos(angle);
        im += eps * Math.sin(angle);
      }
      // Scale: radius = 1 unit in the complex plane (the drawn circle is the unit circle)
      const scale = radius;
      const tipX = cx + re * scale;
      const tipY = cy + im * scale;

      // Draw vector
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Arrowhead
      const mag = Math.sqrt(re * re + im * im) * scale;
      if (mag > 5) {
        const headLen = Math.min(10, mag * 0.25);
        const vecAngle = Math.atan2(tipY - cy, tipX - cx);
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
          tipX - headLen * Math.cos(vecAngle - 0.35),
          tipY - headLen * Math.sin(vecAngle - 0.35)
        );
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
          tipX - headLen * Math.cos(vecAngle + 0.35),
          tipY - headLen * Math.sin(vecAngle + 0.35)
        );
        ctx.stroke();
      }

      // Small circle at tip
      ctx.beginPath();
      ctx.arc(tipX, tipY, 3, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fill();
    }

    // Lattice dots — yellow 2×2 pixels
    if (cycloLatticeDots.length > 0) {
      ctx.fillStyle = "rgba(255, 220, 50, 0.7)";
      for (let i = 0; i < cycloLatticeDots.length; i++) {
        const d = cycloLatticeDots[i];
        ctx.fillRect(cx + d.re * radius - 1, cy + d.im * radius - 1, 2, 2);
      }
    }

    // Hovered lattice point — thin unfilled yellow circle (with fade)
    if (hoveredLatticePoint && latticeAlpha > 0) {
      const px = cx + hoveredLatticePoint.re * radius;
      const py = cy + hoveredLatticePoint.im * radius;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(255, 220, 50, " + latticeAlpha + ")";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /* ── Cyclotomic lattice (pseudoinverse detection) ── */
  function eulerTotient(n) {
    let result = n, temp = n;
    for (let p = 2; p * p <= temp; p++) {
      if (temp % p === 0) {
        while (temp % p === 0) temp /= p;
        result -= result / p;
      }
    }
    if (temp > 1) result -= result / temp;
    return result;
  }

  function precomputeCycloBasis(n) {
    cycloPhi = eulerTotient(n);
    cycloBasis = [];
    for (let k = 0; k < cycloPhi; k++) {
      const angle = -(2 * Math.PI * k) / n;
      cycloBasis.push({ re: Math.cos(angle), im: Math.sin(angle) });
    }
    // Gram matrix G = M M^T (2×2)
    let g00 = 0, g01 = 0, g11 = 0;
    for (let k = 0; k < cycloPhi; k++) {
      g00 += cycloBasis[k].re * cycloBasis[k].re;
      g01 += cycloBasis[k].re * cycloBasis[k].im;
      g11 += cycloBasis[k].im * cycloBasis[k].im;
    }
    const det = g00 * g11 - g01 * g01;
    cycloGinv = Math.abs(det) > 1e-12
      ? [g11 / det, -g01 / det, -g01 / det, g00 / det]
      : null;
  }

  function computeLatticeDots(n, maxCoeff) {
    if (maxCoeff <= 0) { cycloLatticeDots = []; return; }
    const phi = cycloPhi;
    const side = 2 * maxCoeff + 1;
    const total = Math.pow(side, phi);
    if (total > 10000) { cycloLatticeDots = []; return; }
    const lo = -maxCoeff, hi = maxCoeff;
    const a = new Array(phi).fill(lo);
    const dots = [];
    for (let i = 0; i < total; i++) {
      let re = 0, im = 0;
      for (let k = 0; k < phi; k++) {
        re += a[k] * cycloBasis[k].re;
        im += a[k] * cycloBasis[k].im;
      }
      let last = phi - 1;
      while (last >= 0 && a[last] === 0) last--;
      dots.push({ re, im, label: last >= 0 ? a.slice(0, last + 1).join(", ") : "0" });
      for (let k = phi - 1; k >= 0; k--) {
        a[k]++;
        if (a[k] > hi) a[k] = lo; else break;
      }
    }
    cycloLatticeDots = dots;
  }

  // Canvas tooltip for lattice points (CSS handles fade transition)
  const canvasTooltip = document.createElement("div");
  canvasTooltip.style.cssText =
    "position:fixed;pointer-events:none;z-index:9999;" +
    "padding:0.25em 0.5em;border-radius:4px;" +
    "background:rgba(255,235,140,0.94);color:#111113;" +
    "font:600 13px/1 -apple-system,'SF Pro Display',system-ui,sans-serif;" +
    "font-variant-numeric:tabular-nums;white-space:nowrap;" +
    "opacity:0;transition:opacity 0.8s ease-out;transform:translate(-50%,-120%)";
  document.getElementById("playground").appendChild(canvasTooltip);

  function beginLatticeFade() {
    canvasTooltip.style.opacity = "0";
    if (fadeRAF) clearTimeout(fadeRAF);
    fadeRAF = setTimeout(() => {
      hoveredLatticePoint = null;
      latticeAlpha = 0;
      drawUnityClock();
      fadeRAF = null;
    }, 800);
  }

  canvas.addEventListener("mousemove", (e) => {
    if (cycloLatticeDots.length === 0) {
      if (hoveredLatticePoint) {
        hoveredLatticePoint = null; latticeAlpha = 0; drawUnityClock();
      }
      canvasTooltip.style.opacity = "0";
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const w = canvas.width, h = canvas.height;
    const cxC = w / 2, cyC = h / 2;
    const radius = Math.min(w, h) * 0.32;
    const cRe = (mx - cxC) / radius;
    const cIm = (my - cyC) / radius;

    // 1% of canvas size in complex-plane units
    const thresh = 0.01 * Math.min(w, h) / radius;
    const thresh2 = thresh * thresh;

    let best = null, bestD2 = thresh2;
    for (let i = 0; i < cycloLatticeDots.length; i++) {
      const d = cycloLatticeDots[i];
      const dx = d.re - cRe, dy = d.im - cIm;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; best = d; }
    }

    if (best) {
      if (fadeRAF) { clearTimeout(fadeRAF); fadeRAF = null; }
      const changed = !hoveredLatticePoint ||
        Math.abs(best.re - hoveredLatticePoint.re) > 1e-9 ||
        Math.abs(best.im - hoveredLatticePoint.im) > 1e-9;
      hoveredLatticePoint = best;
      latticeAlpha = 1;
      if (changed) drawUnityClock();
      const px = cxC + best.re * radius;
      const py = cyC + best.im * radius;
      canvasTooltip.textContent = best.label;
      canvasTooltip.style.left = (rect.left + px) + "px";
      canvasTooltip.style.top = (rect.top + py) + "px";
      canvasTooltip.style.opacity = "1";
    } else if (hoveredLatticePoint && !fadeRAF) {
      beginLatticeFade();
    }
  });

  canvas.addEventListener("mouseleave", () => {
    if (hoveredLatticePoint && !fadeRAF) beginLatticeFade();
  });

  /* ── Mechanical Picker (coprimality) ────────────────── */
  const pickerCanvas = document.getElementById("picker_canvas");
  const pickerCtx = pickerCanvas.getContext("2d");
  const pickerTooltip = document.getElementById("picker_tooltip");
  const slopeDisplay = document.getElementById("slope_display");
  const wordDisplay = document.getElementById("word_display");
  const rightPanel = document.getElementById("right_panel");
  let currentGridN = 20;
  let hoveredVertex = null;
  let lockedVertex = null;
  let currentOffset = 0;

  function gcd(a, b) {
    while (b) { const t = b; b = a % b; a = t; }
    return a;
  }

  // Farey parents of k/p (coprime): find a/b, c/d such that
  // a+c = k, b+d = p, b*k - a*p = 1 (mediant property)
  function fareyParents(k, p) {
    if (p <= 0 || k <= 0) return null;
    if (p === 1 && k === 1) return null; // 1/1 has no proper parents
    // Extended GCD to find b such that b*k ≡ 1 (mod p)
    let old_r = k, r = p;
    let old_s = 1, s = 0;
    while (r !== 0) {
      const q = Math.floor(old_r / r);
      [old_r, r] = [r, old_r - q * r];
      [old_s, s] = [s, old_s - q * s];
    }
    let b = ((old_s % p) + p) % p;
    if (b === 0) b = p;
    const a = (b * k - 1) / p;
    return { a, b, c: k - a, d: p - b };
  }

  // Grid-to-pixel helpers (grid ranges from -1 to currentGridN - 2)
  function gpx(p) {
    return (p + 1) * (pickerCanvas.width / currentGridN);
  }
  function gpy(k) {
    return (currentGridN - 1 - k) * (pickerCanvas.height / currentGridN);
  }

  function drawParallelogram(p, k) {
    const parents = fareyParents(k, p);
    if (!parents) return;
    const { a, b, c, d } = parents;
    const off = currentOffset;

    // Parallelogram: long diagonal = slope line, short diagonal = Farey parents
    // Vertices: (0,off), (b,a+off), (p,k+off), (d,c+off)
    pickerCtx.fillStyle = "rgba(255, 255, 255, 0.05)";
    pickerCtx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    pickerCtx.lineWidth = 1;
    pickerCtx.beginPath();
    pickerCtx.moveTo(gpx(0), gpy(off));
    pickerCtx.lineTo(gpx(b), gpy(a + off));
    pickerCtx.lineTo(gpx(p), gpy(k + off));
    pickerCtx.lineTo(gpx(d), gpy(c + off));
    pickerCtx.closePath();
    pickerCtx.fill();
    pickerCtx.stroke();
  }

  function fracHTML(num, den) {
    return `<span class="vfrac"><span class="vfrac__num">${num}</span><span class="vfrac__den">${den}</span></span>`;
  }

  // Closest fraction to x with denominator ≤ maxDen (Stern-Brocot mediants)
  function close_frac(x, maxDen) {
    if (maxDen < 1) return { num: Math.round(x), den: 1 };
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    // lower mediant a/b, upper mediant c/d
    let a = Math.floor(ax), b = 1;
    let c = a + 1, d = 1;
    let bestNum = a, bestDen = 1, bestErr = Math.abs(ax - a);
    if (Math.abs(ax - c) < bestErr) { bestNum = c; bestErr = Math.abs(ax - c); }
    while (true) {
      const mn = a + c, md = b + d;
      if (md > maxDen) break;
      const mv = mn / md;
      const err = Math.abs(ax - mv);
      if (err < bestErr) { bestErr = err; bestNum = mn; bestDen = md; }
      if (err === 0) break;
      if (mv < ax) { a = mn; b = md; }
      else { c = mn; d = md; }
    }
    return { num: sign * bestNum, den: bestDen };
  }

  // Effective start of slope line: intersection with nonneg axes.
  // offset >= 0 → (0, offset) on y-axis; offset < 0 → (-offset*p/k, 0) on x-axis.
  function slopeLineStart(p, k) {
    if (currentOffset < -1e-9 && k > 0) {
      return { x: -currentOffset * p / k, y: 0 };
    }
    return { x: 0, y: Math.max(0, currentOffset) };
  }

  // Draw colored markers at grid-line crossing points of the slope line.
  // Exactly p+k = period markers: p blue (vertical crossings) + k green (horizontal).
  // Half-open intervals [startX, startX+p) and [startY, startY+k).
  // Initial lattice point forced blue.
  // When offset≈0, green at origin is relocated to slope line endpoint.
  function drawWordDots(p, k) {
    if (p === 0) return;
    const cellW = pickerCanvas.width / currentGridN;
    const cellH = pickerCanvas.height / currentGridN;
    const dotR = Math.min(cellW, cellH) * 0.10;
    const eps = 1e-9;

    const s = slopeLineStart(p, k);

    // p vertical crossings at integer x in [startX, startX+p)
    const discs = [];
    const firstX = Math.abs(s.x - Math.round(s.x)) < eps
      ? Math.round(s.x) : Math.ceil(s.x);
    for (let x = firstX; x < s.x + p - eps; x++) {
      discs.push({ gx: x, gy: (k / p) * x + currentOffset, color: 'blue' });
    }

    // k horizontal crossings at integer y in [startY, startY+k)
    const firstY = Math.abs(s.y - Math.round(s.y)) < eps
      ? Math.round(s.y) : Math.ceil(s.y);
    for (let y = firstY; y < s.y + k - eps; y++) {
      const x = k > 0 ? (y - currentOffset) * p / k : s.x;
      discs.push({ gx: x, gy: y, color: 'green' });
    }

    // Sort by position along the line (by gx, blue before green at ties)
    discs.sort((a, b) => (a.gx - b.gx) || (a.color === 'blue' ? -1 : 1));

    // Force initial lattice point to blue
    if (discs.length > 0) {
      const f = discs[0];
      if (Math.abs(f.gx - Math.round(f.gx)) < eps &&
          Math.abs(f.gy - Math.round(f.gy)) < eps) {
        f.color = 'blue';
      }
    }

    // When offset≈0, relocate green at origin to the slope line endpoint
    if (Math.abs(currentOffset) < eps) {
      for (const d of discs) {
        if (d.color === 'green' &&
            Math.abs(d.gx) < eps && Math.abs(d.gy) < eps) {
          d.gx = s.x + p;
          d.gy = s.y + k;
          break;
        }
      }
    }

    // Draw all markers as rounded rectangles (blue: vertical, green: horizontal, 1:2 ratio)
    for (const d of discs) {
      let w, h;
      if (d.color === 'blue') {
        pickerCtx.fillStyle = "rgba(80, 140, 255, 0.85)";
        pickerCtx.strokeStyle = "rgba(40, 80, 180, 1)";
        w = dotR; h = dotR * 2;
      } else {
        pickerCtx.fillStyle = "rgba(80, 220, 80, 0.85)";
        pickerCtx.strokeStyle = "rgba(30, 130, 30, 1)";
        w = dotR * 2; h = dotR;
      }
      const cx = gpx(d.gx), cy = gpy(d.gy);
      const r = Math.min(w, h) * 0.35;
      pickerCtx.lineWidth = 1.5;
      pickerCtx.beginPath();
      pickerCtx.roundRect(cx - w, cy - h, w * 2, h * 2, r);
      pickerCtx.fill();
      pickerCtx.stroke();
    }
  }

  // Mechanical word from geometric crossing order of slope line y = (k/p)x + offset.
  // For each integer x = 0..p-1, emit blue (vertical crossing), then
  // floor((x+1)*k/p + offset) - floor(x*k/p + offset) greens (horizontal crossings).
  // Always produces exactly p blues + k greens = period.
  function computeMechanicalWord(p, k, offset) {
    if (p === 0 && k === 0) return [];
    if (p === 0) return Array(k).fill(1);
    const word = [];
    for (let n = 0; n < p; n++) {
      word.push(-1);
      const h = Math.floor((n + 1) * k / p + offset) - Math.floor(n * k / p + offset);
      for (let i = 0; i < h; i++) word.push(1);
    }
    return word;
  }

  // Recursive Farey decomposition of a mechanical word into nested HTML.
  // depth controls increasing padding per nesting level.
  function decomposeWordHTML(word, k, p, depth) {
    if (word.length === 0) return '';
    depth = depth || 0;

    // Base case: no further decomposition
    const parents = (k > 0 && p > 0 && !(k === 1 && p === 1))
      ? fareyParents(k, p) : null;

    if (!parents) {
      return word.map(v =>
        v === -1
          ? '<span class="word-nest-a"><span class="word-h">1</span></span>'
          : '<span class="word-nest-b"><span class="word-v">1</span></span>'
      ).join('');
    }

    const { a, b, c, d } = parents;
    const lenA = a + b; // period of closest Farey parent
    const lenB = c + d; // period of the other parent

    const wordA = word.slice(0, lenA);
    const wordB = word.slice(lenA);

    const innerA = decomposeWordHTML(wordA, a, b, depth + 1);
    const innerB = decomposeWordHTML(wordB, c, d, depth + 1);

    return '<span class="word-nest-a">' + innerA + '</span>' +
           '<span class="word-nest-b">' + innerB + '</span>';
  }

  function updateSlopeAndWord(k, p) {
    slopeDisplay.innerHTML = "slope\u00a0=\u00a0" + fracHTML(k, p) +
      '<span style="margin-left:1em">period\u00a0=\u00a0' + (k + p) + '</span>';
    if (p === 0) { wordDisplay.innerHTML = ""; currentWord = []; drawUnityClock(); return; }
    const word = computeMechanicalWord(p, k, currentOffset);
    currentWord = word;
    wordDisplay.innerHTML = decomposeWordHTML(word, k, p);
    drawUnityClock();
  }

  function drawMechanicalLine(p, k) {
    pickerCtx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    pickerCtx.lineWidth = 1;

    if (p === 0) {
      pickerCtx.beginPath();
      pickerCtx.moveTo(gpx(0), 0);
      pickerCtx.lineTo(gpx(0), pickerCanvas.height);
      pickerCtx.stroke();
      return;
    }

    const s = slopeLineStart(p, k);
    pickerCtx.beginPath();
    pickerCtx.moveTo(gpx(s.x), gpy(s.y));
    pickerCtx.lineTo(gpx(s.x + p), gpy(s.y + k));
    pickerCtx.stroke();
  }

  function drawOverlay(v) {
    drawParallelogram(v.p, v.k);
    drawMechanicalLine(v.p, v.k);
  }

  function drawMechanicalPicker() {
    const n = currentGridN;   // = 2*cycle + 1 cells; grid from -1 to 2*cycle
    const w = pickerCanvas.clientWidth;
    const h = pickerCanvas.clientHeight;
    if (w === 0 || h === 0) return;
    pickerCanvas.width = w;
    pickerCanvas.height = h;

    pickerCtx.fillStyle = "rgba(70, 70, 78, 0.85)";
    pickerCtx.fillRect(0, 0, w, h);

    const cellW = w / n;
    const cellH = h / n;

    // Word dots (lowest z — drawn before grid and lines)
    if (lockedVertex) drawWordDots(lockedVertex.p, lockedVertex.k);
    if (hoveredVertex && (!lockedVertex ||
        hoveredVertex.p !== lockedVertex.p || hoveredVertex.k !== lockedVertex.k)) {
      drawWordDots(hoveredVertex.p, hoveredVertex.k);
    }

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

    // Axes — thin white lines at p=0 and k=0, arrows at positive ends
    const axisColor = "rgba(255, 255, 255, 0.45)";
    const fontSize = parseFloat(getComputedStyle(pickerCanvas.parentElement).fontSize) || 14;
    const arrow = Math.max(4, fontSize * 0.45);
    pickerCtx.strokeStyle = axisColor;
    pickerCtx.fillStyle = axisColor;
    pickerCtx.lineWidth = 1;

    // y-axis (vertical) with arrow at top (positive k direction)
    const ax = gpx(0);
    pickerCtx.beginPath();
    pickerCtx.moveTo(ax, h);
    pickerCtx.lineTo(ax, 0);
    pickerCtx.stroke();
    pickerCtx.beginPath();
    pickerCtx.moveTo(ax, 0);
    pickerCtx.lineTo(ax - arrow * 0.3, arrow);
    pickerCtx.lineTo(ax + arrow * 0.3, arrow);
    pickerCtx.closePath();
    pickerCtx.fill();

    // x-axis (horizontal) with arrow at right (positive p direction)
    const ay = gpy(0);
    pickerCtx.beginPath();
    pickerCtx.moveTo(0, ay);
    pickerCtx.lineTo(w, ay);
    pickerCtx.stroke();
    pickerCtx.beginPath();
    pickerCtx.moveTo(w, ay);
    pickerCtx.lineTo(w - arrow, ay - arrow * 0.3);
    pickerCtx.lineTo(w - arrow, ay + arrow * 0.3);
    pickerCtx.closePath();
    pickerCtx.fill();

    // Coprime circles at grid vertices (diameter = 1/3 mesh)
    const maxCoord = n - 2; // = 2*cycle - 1, but we go up to 2*cycle = n-1
    const r = Math.min(cellW, cellH) / 6;
    pickerCtx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    pickerCtx.lineWidth = 1;
    for (let p = 0; p <= n - 1; p++) {
      for (let k = 0; k <= n - 1; k++) {
        if (gcd(p, k) === 1) {
          pickerCtx.beginPath();
          pickerCtx.arc(gpx(p), gpy(k), r, 0, 2 * Math.PI);
          pickerCtx.stroke();
        }
      }
    }

    // Locked overlay (persistent)
    if (lockedVertex) drawOverlay(lockedVertex);
    // Hovered overlay (temporary, skip if same as locked)
    if (hoveredVertex && (!lockedVertex ||
        hoveredVertex.p !== lockedVertex.p || hoveredVertex.k !== lockedVertex.k)) {
      drawOverlay(hoveredVertex);
    }
  }

  function nearestCoprimeVertex(mouseX, mouseY, boxW, boxH) {
    const n = currentGridN;
    const cellW = boxW / n;
    const cellH = boxH / n;
    const r = Math.min(cellW, cellH) / 2;
    // Grid from -1 to n-2; mouse → grid: p = round(mouseX/cellW) - 1
    const p = Math.round(mouseX / cellW) - 1;
    const k = (n - 1) - Math.round(mouseY / cellH);
    const maxCoord = n - 1; // = 2*cycle
    if (p < 0 || p > maxCoord || k < 0 || k > maxCoord) return null;
    if (gcd(p, k) !== 1) return null;
    const vx = (p + 1) * cellW;
    const vy = (n - 1 - k) * cellH;
    const dx = mouseX - vx;
    const dy = mouseY - vy;
    if (dx * dx + dy * dy > r * r) return null;
    return { p, k, vx, vy };
  }

  // Hover: draw line/staircase on canvas + tooltip, but NO slope/word text update
  pickerCanvas.addEventListener("mousemove", (e) => {
    const rect = pickerCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = nearestCoprimeVertex(x, y, rect.width, rect.height);

    const prevP = hoveredVertex ? hoveredVertex.p : -1;
    const prevK = hoveredVertex ? hoveredVertex.k : -1;

    if (hit) {
      hoveredVertex = hit;
      if (hit.p !== prevP || hit.k !== prevK) drawMechanicalPicker();
      pickerTooltip.style.fontSize = getComputedStyle(rightPanel).fontSize;
      pickerTooltip.innerHTML = fracHTML(hit.k, hit.p);
      pickerTooltip.style.left = (rect.left + hit.vx) + "px";
      pickerTooltip.style.top  = (rect.top  + hit.vy) + "px";
      pickerTooltip.style.opacity = "1";
    } else {
      if (hoveredVertex) { hoveredVertex = null; drawMechanicalPicker(); }
      pickerTooltip.style.opacity = "0";
    }
  });

  pickerCanvas.addEventListener("mouseleave", () => {
    if (hoveredVertex) { hoveredVertex = null; drawMechanicalPicker(); }
    pickerTooltip.style.opacity = "0";
  });

  // Click: lock line/staircase + update slope, period, and word
  pickerCanvas.addEventListener("click", (e) => {
    const rect = pickerCanvas.getBoundingClientRect();
    const hit = nearestCoprimeVertex(
      e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height
    );
    if (hit) {
      lockedVertex = hit;
      updateOffsetRange();
      updateSlopeAndWord(hit.k, hit.p);
      drawMechanicalPicker();
    }
  });

  new ResizeObserver(() => {
    hoveredVertex = null;
    drawMechanicalPicker();
  }).observe(pickerCanvas);

  /* ── Panel resize (generic for both sides) ──────── */
  const pg = document.getElementById("playground");
  const snaps = [1, 120, 180, 240, 360, 480];

  function maxPanelWidth() {
    return Math.floor(window.innerWidth / 2);
  }

  function setupPanelResize(handleEl, panelEl, cssVar, direction) {
    // direction: 'right' = panel on right (drag left to widen)
    //            'left'  = panel on left  (drag right to widen)
    let dragging = false;
    let startX, startW, pid = null;

    function setWidth(w) {
      pg.style.setProperty(cssVar, w + "px");
    }

    function beginDrag(x) {
      dragging = true;
      startX = x;
      startW = panelEl.offsetWidth;
      pg.classList.remove("snapping");
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    }

    function moveDrag(x) {
      if (!dragging) return;
      const delta = direction === "right" ? startX - x : x - startX;
      const maxW = maxPanelWidth();
      const w = Math.max(0, Math.min(startW + delta, maxW));
      setWidth(w);
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      const cur = panelEl.offsetWidth;
      const maxW = maxPanelWidth();
      // Fixed snaps below max, plus maxW (= 50vw) as a dynamic half-window snap
      const allSnaps = [...snaps.filter(s => s < maxW), maxW];
      const nearest = allSnaps.reduce((a, b) =>
        Math.abs(b - cur) < Math.abs(a - cur) ? b : a
      );

      pg.classList.add("snapping");
      if (nearest === maxW) {
        // Use viewport unit so the panel tracks window width on resize
        pg.style.setProperty(cssVar, "50vw");
      } else {
        setWidth(nearest);
      }
    }

    handleEl.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      handleEl.setPointerCapture(e.pointerId);
      pid = e.pointerId;
      beginDrag(e.clientX);
    });
    handleEl.addEventListener("pointermove", (e) => moveDrag(e.clientX));
    handleEl.addEventListener("pointerup", () => {
      if (pid !== null) {
        try { handleEl.releasePointerCapture(pid); } catch (_) {}
      }
      endDrag();
      pid = null;
    });
    handleEl.addEventListener("pointercancel", () => {
      endDrag();
      pid = null;
    });
    handleEl.addEventListener("lostpointercapture", () => {
      dragging = false;
      pid = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    });
  }

  // Right panel resize
  setupPanelResize(
    document.getElementById("right_handle"),
    document.getElementById("right_panel"),
    "--right-panel-width",
    "right"
  );

  // Left panel resize
  setupPanelResize(
    document.getElementById("left_handle"),
    document.getElementById("left_panel"),
    "--left-panel-width",
    "left"
  );

  pg.addEventListener("transitionend", () => {
    pg.classList.remove("snapping");
  });

  /* ── MathJax formula (left panel) ───────────────── */
  const formulaDisplay = document.getElementById("formula_display");

  function updateFormula(cycleVal, lengthVal) {
    if (!formulaDisplay) return;
    const n = cycleVal || 10;
    const L = lengthVal || 1;
    const g = gcd(2, n);
    const a = 2 / g;
    const b = n / g;

    // ζ = e^{2πi/n} simplified
    let zetaExp;
    if (b === 1 && a === 1) zetaExp = "\\pi i";
    else if (b === 1) zetaExp = a + "\\pi i";
    else if (a === 1) zetaExp = "\\frac{\\pi i}{" + b + "}";
    else zetaExp = "\\frac{" + a + "\\pi i}{" + b + "}";

    const upper = L - 1;
    const tex1 = "\\zeta = e^{" + zetaExp + "}";
    const tex2 = "\\displaystyle\\sum_{j=0}^{" + upper + "} \\epsilon_j \\, \\zeta^{-j}";
    const html = "\\(" + tex1 + "\\)<br>\\(" + tex2 + "\\)";

    if (window.MathJax && window.MathJax.typesetPromise) {
      MathJax.typesetClear([formulaDisplay]);
      formulaDisplay.innerHTML = html;
      MathJax.typesetPromise([formulaDisplay]);
    } else {
      formulaDisplay.innerHTML = html;
    }
  }

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
      this._rawPct = null;
      this.onRelease = null;

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

    setMin(newMin) {
      this.min = newMin;
      this.el.dataset.min = newMin;
      this.el.setAttribute("aria-valuemin", newMin);
      if (this._value < newMin) this._value = newMin;
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
      this.el.addEventListener("lostpointercapture", () => this._onUp());
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
      this.el.classList.add("dragging");
      const pct = this._pctFromX(e.clientX);
      this._rawPct = pct;
      this._value = this._valueFromPct(pct);
      this._update();
    }

    _onMove(e) {
      if (!this._dragging) return;
      const pct = this._pctFromX(e.clientX);
      this._rawPct = pct;
      this._value = this._valueFromPct(pct);
      this._update();
    }

    _onUp() {
      if (!this._dragging) return;
      const pid = this._pointerId;
      // Clear drag state
      this._dragging = false;
      this._pointerId = null;
      this._rawPct = null;
      this.el.classList.remove("dragging");
      // Magnetic snap before visual update
      if (this.onRelease) this.onRelease(this.displayValue);
      // Final visual update with snapped value
      this._update();
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
      if (this.onKeyStep) {
        const next = this.onKeyStep(delta > 0 ? 1 : -1);
        if (next !== null) {
          this._value = Math.max(this.min, Math.min(this.max, next));
          this._update();
        }
      } else {
        this._value = Math.max(this.min, Math.min(this.max, this._value + delta));
        this._update();
      }
    }


    _update() {
      const pct = (this._rawPct != null)
        ? this._rawPct * 100
        : ((this._value - this.min) / (this.max - this.min)) * 100;
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
    lockedVertex = null;
    drawMechanicalPicker();
  }

  // Wire cycle → length + picker grid
  const cycle = sliders.sl_cycle;
  const length = sliders.sl_length;
  const offsetSlider = sliders.sl_offset;

  function updateOffsetThumb() {
    if (!offsetSlider) return;
    const val = offsetSlider.displayValue;
    const maxDen = cycle ? 2 * cycle.displayValue : 20;
    const f = close_frac(val, maxDen);
    offsetSlider._thumb.textContent =
      f.den === 1 ? String(f.num) : f.num + "/" + f.den;
  }

  function updateOffsetRange() {
    if (!offsetSlider) return;
    offsetSlider.setMin(0);
    offsetSlider.setMax(0.99);
    offsetSlider.step = 0.01;
    currentOffset = offsetSlider.displayValue;
    updateOffsetThumb();
  }

  const offsetTooltip = document.getElementById("offset_tooltip");
  let _offsetTipTimer = null;

  function showOffsetTooltip() {
    if (!offsetTooltip || !pickerCanvas) return;
    const rect = pickerCanvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const n = currentGridN;
    const px = (0 + 1) * (rect.width / n);
    const py = (n - 1 - currentOffset) * (rect.height / n);
    offsetTooltip.style.left = (rect.left + px) + "px";
    offsetTooltip.style.top = (rect.top + py) + "px";
    const maxDen = cycle ? 2 * cycle.displayValue : 20;
    const f = close_frac(currentOffset, maxDen);
    offsetTooltip.textContent = f.den === 1 ? String(f.num) : f.num + "/" + f.den;
    offsetTooltip.style.opacity = "1";
    if (_offsetTipTimer) clearTimeout(_offsetTipTimer);
    _offsetTipTimer = setTimeout(() => { offsetTooltip.style.opacity = "0"; }, 1200);
  }

  if (offsetSlider) {
    currentOffset = offsetSlider.displayValue;
    offsetSlider.onChange = (v) => {
      currentOffset = v;
      updateOffsetThumb();
      showOffsetTooltip();
      if (lockedVertex) {
        updateSlopeAndWord(lockedVertex.k, lockedVertex.p);
      }
      if (hoveredVertex || lockedVertex) drawMechanicalPicker();
    };
    // Keyboard: step through exact fractions
    offsetSlider.onKeyStep = (dir) => {
      const maxDen = cycle ? 2 * cycle.displayValue : 20;
      // Build sorted list of unique fractions in [min, max]
      const seen = new Set();
      const fracs = [];
      for (let d = 1; d <= maxDen; d++) {
        const lo = Math.ceil(offsetSlider.min * d);
        const hi = Math.floor(offsetSlider.max * d);
        for (let n = lo; n <= hi; n++) {
          const key = Math.round((n / d) * 1e9);
          if (!seen.has(key)) { seen.add(key); fracs.push(n / d); }
        }
      }
      fracs.sort((a, b) => a - b);
      const cur = offsetSlider._value;
      const eps = 1e-9;
      if (dir > 0) {
        const nxt = fracs.find(f => f > cur + eps);
        return nxt !== undefined ? nxt : null;
      } else {
        let prev = null;
        for (let i = fracs.length - 1; i >= 0; i--) {
          if (fracs[i] < cur - eps) { prev = fracs[i]; break; }
        }
        return prev;
      }
    };
    // Magnetic snap to nearest fraction on release
    // Modifies _value; _update() is called after this in _onUp
    offsetSlider.onRelease = (v) => {
      const maxDen = cycle ? 2 * cycle.displayValue : 20;
      const f = close_frac(v, maxDen);
      const target = f.num / f.den;
      if (Math.abs(v - target) < 0.03) {
        offsetSlider._value = Math.max(offsetSlider.min, Math.min(offsetSlider.max, target));
      }
    };
  }

  if (length) {
    length.onChange = (v) => {
      currentLengthForClock = v;
      updateFormula(
        cycle ? cycle.displayValue : 10,
        v
      );
      drawUnityClock();
    };
  }

  const latticeSlider = sliders.sl_lattice;

  if (latticeSlider) {
    latticeSlider.onChange = (v) => {
      currentLatticeMax = v;
      computeLatticeDots(currentCycleForClock, v);
      hoveredLatticePoint = null;
      latticeAlpha = 0;
      if (fadeRAF) { clearTimeout(fadeRAF); fadeRAF = null; }
      canvasTooltip.style.opacity = "0";
      drawUnityClock();
    };
  }

  if (cycle) {
    const cv = cycle.displayValue;
    currentCycleForClock = cv;
    precomputeCycloBasis(cv);
    setPickerGridSize(2 * cv + 1);
    drawUnityClock();
    lockedVertex = { p: cv, k: 1, vx: 0, vy: 0 };
    updateOffsetRange();
    updateSlopeAndWord(1, cv);
    drawMechanicalPicker();

    if (length) {
      length.setMax(2 * cv);
      length.setValue(Math.floor(cv / 2));
      currentLengthForClock = length.displayValue;
    }
    if (latticeSlider) {
      latticeSlider.setMax(cycle.displayValue < 11 ? 2 : 1);
    }
    updateFormula(cycle.displayValue, length ? length.displayValue : 1);

    cycle.onChange = (cycleVal) => {
      currentCycleForClock = cycleVal;
      precomputeCycloBasis(cycleVal);
      setPickerGridSize(2 * cycleVal + 1);
      drawUnityClock();
      lockedVertex = { p: cycleVal, k: 1, vx: 0, vy: 0 };
      updateOffsetRange();
      updateSlopeAndWord(1, cycleVal);
      drawMechanicalPicker();
      if (length) {
        length.setMax(2 * cycleVal);
        length.setValue(Math.floor(cycleVal / 2));
        currentLengthForClock = length.displayValue;
      }
      // Reset cyclotomic lattice slider to 0 on cycle change
      if (latticeSlider) {
        latticeSlider.setMax(cycleVal < 11 ? 2 : 1);
        latticeSlider.setValue(0);
        currentLatticeMax = 0;
        cycloLatticeDots = [];
        hoveredLatticePoint = null;
        latticeAlpha = 0;
        if (fadeRAF) { clearTimeout(fadeRAF); fadeRAF = null; }
      }
      updateFormula(cycleVal, length ? length.displayValue : 1);
    };
  }

  window.PiSlider = PiSlider;

})();
