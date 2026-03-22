import { Complex } from '../math/Complex';
import { getDFTCoeffs, setVerticesFromCoeffs } from '../math/dft';
import {
  PhysicsParams,
  physicsStep,
  rigidityFromAccel,
  lambdaDefault,
  dampingDefaultFraction,
  computeCOM,
  computeDiameter,
} from '../math/physics';
import type { SimSnapshot } from './SimState';

const A_SMOOTH = 0.85;

export class Simulation {
  // --- polygon state ---
  private _dim: number;
  private _expStep: number;
  private vertices: Complex[] = [];
  private velocities: Complex[] = [];
  private restEdge: number[] = [];
  private restLap: Complex[] = [];
  private baseScale = 0.9;

  // --- spectral override ---
  private userCoeffs: Complex[] | null = null;
  private draggingDisc = -1;
  private lastDiscPointer: { x: number; y: number } | null = null;

  // --- drag state ---
  private dragging = -1;
  private mouseTarget: Complex | null = null;
  private mouseVel = new Complex(0, 0);
  private prevMouseVel = new Complex(0, 0);
  private prevMouse: Complex | null = null;
  private lastMouseTime = 0;

  // --- frozen state ---
  private isFrozen = false;
  private hardFrozen = false;

  // --- global invariants ---
  private initialCOM = new Complex(0, 0);
  private initialDiameter = 1;
  private smoothedAMag = 0;

  // --- rendering params (owned here, read by snapshot) ---
  midpointIterates = 0;
  alphaBlend = 0.5;

  // --- physics params (mutable by UI) ---
  params: PhysicsParams = {
    mass: 1.0,
    kEdge: 180,
    kBend: 24,
    damping: 10.0,
    kFollowBase: 420,
    lambda: 0.9,
    a0: 40.0,
    rho: 0.0,
    kRadial: 90.0,
  };

  constructor(dim: number, expStep: number) {
    this._dim = dim;
    this._expStep = expStep;
    this.initVertices();
    // set sensible defaults from dim
    this.params.lambda = lambdaDefault(dim);
  }

  get dim() { return this._dim; }
  get expStep() { return this._expStep; }

  // --- Public API ---

  step(dt: number): void {
    physicsStep(
      this.vertices,
      this.velocities,
      this.restEdge,
      this.restLap,
      this.params,
      {
        dragging: this.dragging,
        mouseTarget: this.mouseTarget,
        mouseVel: this.mouseVel,
        initialCOM: this.initialCOM,
        initialDiameter: this.initialDiameter,
        isFrozen: this.isFrozen,
        dim: this._dim,
        smoothedAMag: this.smoothedAMag,
      },
      dt,
    );
  }

  snapshot(): SimSnapshot {
    return {
      dim: this._dim,
      expStep: this._expStep,
      vertices: this.vertices.map(v => v.clone()),
      userCoeffs: this.userCoeffs ? this.userCoeffs.map(c => c.clone()) : null,
      baseScale: this.baseScale,
      midpointIterates: this.midpointIterates,
      alphaBlend: this.alphaBlend,
      smoothedAMag: this.smoothedAMag,
      sRigidity: rigidityFromAccel(this.smoothedAMag, this.params.a0),
      dragging: this.dragging,
      draggingDisc: this.draggingDisc,
      isFrozen: this.isFrozen,
    };
  }

  // --- Vertex drag ---

  startVertexDrag(index: number, pos: Complex, time: number): void {
    this.prevMouse = pos;
    this.mouseTarget = pos;
    this.lastMouseTime = time;
    this.mouseVel = new Complex(0, 0);
    this.prevMouseVel = new Complex(0, 0);
    this.smoothedAMag = 0;
    this.dragging = index;
    this.isFrozen = false;
    this.hardFrozen = false;
    this.userCoeffs = null;
    this.draggingDisc = -1;
  }

  moveVertexDrag(pos: Complex, time: number): void {
    if (this.dragging === -1 || !this.prevMouse) return;
    const dt = Math.max(1e-4, (time - this.lastMouseTime) / 1000);
    const v = pos.sub(this.prevMouse).divScalar(dt);
    const aVec = v.sub(this.prevMouseVel).divScalar(dt);
    const aMag = aVec.mag();
    this.smoothedAMag = A_SMOOTH * this.smoothedAMag + (1 - A_SMOOTH) * aMag;
    this.mouseTarget = pos;
    this.mouseVel = v;
    this.prevMouseVel = v;
    this.prevMouse = pos;
    this.lastMouseTime = time;
  }

  endVertexDrag(): void {
    this.dragging = -1;
    this.prevMouse = null;
    this.mouseTarget = null;
  }

  // --- Disc (spectral) drag ---

  startDiscDrag(k: number, mx: number, my: number, canvasW: number, canvasH: number): void {
    if (!this.userCoeffs) this.userCoeffs = getDFTCoeffs(this.vertices, this._dim);
    this.userCoeffs[0] = new Complex(0, 0);
    this.draggingDisc = k;
    this.lastDiscPointer = { x: mx, y: my };
    this.isFrozen = true;
    this.hardFrozen = false;
    this.updateCoeffFromPointer(k, mx, my, canvasW, canvasH, false);
  }

  moveDiscDrag(mx: number, my: number, canvasW: number, canvasH: number): void {
    if (this.draggingDisc === -1) return;
    this.updateCoeffFromPointer(this.draggingDisc, mx, my, canvasW, canvasH, true);
    this.lastDiscPointer = { x: mx, y: my };
  }

  endDiscDrag(): void {
    this.draggingDisc = -1;
    this.lastDiscPointer = null;
    this.resetPhysicsMemory();
    this.isFrozen = false;
  }

  // --- Ring click ---

  clickRing(): void {
    this.isFrozen = true;
    this.hardFrozen = true;
    this.smoothedAMag = 0;
    this.userCoeffs = null;
    this.draggingDisc = -1;
    this.resetPhysicsMemory();
  }

  // --- Dimension change ---

  setDim(n: number, exp: number): void {
    this._dim = n;
    this._expStep = exp;
    this.initVertices();
    this.params.lambda = lambdaDefault(n);
    this.userCoeffs = null;
    this.draggingDisc = -1;
  }

  // --- Slider params ---

  setMidpointIterates(n: number): void { this.midpointIterates = n; }
  setAlphaBlend(a: number): void { this.alphaBlend = a; }

  applyStiffness(t: number): void {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    this.params.kEdge = lerp(30, 1200, t);
    this.params.kBend = lerp(3, 240, t);
    this.params.kFollowBase = lerp(75, 1800, t);
    this.params.kRadial = lerp(40, 450, t);
  }

  applyDamping(t: number): void {
    this.params.damping = t * 90.0;
  }

  applyMemory(t: number): void {
    this.params.rho = t * 18.0;
  }

  defaultDampingFraction(): number {
    return dampingDefaultFraction(this._dim);
  }

  // --- Disc geometry helpers (canvas-size-aware) ---

  discParams(canvasW: number, canvasH: number) {
    const cx = canvasW / 2, cy = canvasH / 2;
    const r_outer = Math.min(canvasW / 2, canvasH / 2);
    const r_inner = r_outer * 0.73;
    const pad = 2;
    const r_mid = (r_outer + r_inner) / 2;
    const halfThick = (r_outer - r_inner) / 2;
    const chord = 2 * r_mid * Math.sin(Math.PI / Math.max(3, this._dim));
    const R_radial = Math.max(0, halfThick - pad);
    const R_angular = Math.max(0, (chord - pad) / 2);
    const Rdisc = Math.max(0, Math.min(R_radial, R_angular));
    const rInnerDisc = Rdisc * 0.75;
    return { cx, cy, r_outer, r_inner, r_mid, Rdisc, rInnerDisc };
  }

  discCenter(k: number, canvasW: number, canvasH: number) {
    const { cx, cy, r_mid } = this.discParams(canvasW, canvasH);
    const theta = -(2 * Math.PI * k) / this._dim;
    return { x: cx + r_mid * Math.cos(theta), y: cy + r_mid * Math.sin(theta) };
  }

  hitTestDisc(mx: number, my: number, canvasW: number, canvasH: number): number {
    const { Rdisc } = this.discParams(canvasW, canvasH);
    for (let k = 0; k < this._dim; k++) {
      const c = this.discCenter(k, canvasW, canvasH);
      const dx = mx - c.x, dy = my - c.y;
      if (dx * dx + dy * dy <= Rdisc * Rdisc) return k;
    }
    return -1;
  }

  // --- Private ---

  private initVertices(): void {
    const dim = this._dim;
    this.vertices = [];
    this.velocities = [];
    this.restEdge = [];
    this.baseScale = 0.9;
    for (let m = 0; m < dim; m++) {
      const k = (m * this._expStep) % dim;
      const theta = (2 * Math.PI * k) / dim;
      this.vertices.push(new Complex(this.baseScale * Math.cos(theta), this.baseScale * Math.sin(theta)));
      this.velocities.push(new Complex(0, 0));
    }
    for (let i = 0; i < dim; i++) {
      const j = (i + 1) % dim;
      this.restEdge[i] = this.vertices[j].sub(this.vertices[i]).mag();
    }
    this.restLap = new Array(dim);
    for (let i = 0; i < dim; i++) {
      const ip = (i - 1 + dim) % dim, inext = (i + 1) % dim;
      const lap = this.vertices[ip].add(this.vertices[inext]).sub(this.vertices[i].scale(2));
      this.restLap[i] = new Complex(lap.re, lap.im);
    }
    this.initialCOM = computeCOM(this.vertices, dim);
    this.initialDiameter = computeDiameter(this.vertices, dim);
    this.dragging = -1;
    this.prevMouse = null;
    this.mouseTarget = null;
    this.mouseVel = new Complex(0, 0);
    this.prevMouseVel = new Complex(0, 0);
    this.smoothedAMag = 0;
    this.isFrozen = false;
    this.hardFrozen = false;
  }

  private resetPhysicsMemory(): void {
    const dim = this._dim;
    for (let i = 0; i < dim; i++) this.velocities[i] = new Complex(0, 0);
    for (let i = 0; i < dim; i++) {
      const j = (i + 1) % dim;
      this.restEdge[i] = this.vertices[j].sub(this.vertices[i]).mag();
    }
    for (let i = 0; i < dim; i++) {
      const ip = (i - 1 + dim) % dim, inext = (i + 1) % dim;
      const lap = this.vertices[ip].add(this.vertices[inext]).sub(this.vertices[i].scale(2));
      this.restLap[i] = new Complex(lap.re, lap.im);
    }
    this.initialCOM = computeCOM(this.vertices, dim);
    this.initialDiameter = computeDiameter(this.vertices, dim);
    this.smoothedAMag = 0;
    this.prevMouseVel = new Complex(0, 0);
    this.mouseVel = new Complex(0, 0);
  }

  private updateCoeffFromPointer(
    k: number, mx: number, my: number,
    canvasW: number, canvasH: number,
    classifyByDelta: boolean,
  ): void {
    if (k <= 0 || k >= this._dim) return;
    const { rInnerDisc, Rdisc } = this.discParams(canvasW, canvasH);
    if (!this.userCoeffs) this.userCoeffs = getDFTCoeffs(this.vertices, this._dim);
    this.userCoeffs[0] = new Complex(0, 0);

    const center = this.discCenter(k, canvasW, canvasH);
    const dx = mx - center.x, dy = my - center.y;
    const r = Math.hypot(dx, dy);

    const zeroTol = 0.05 * Rdisc;
    if (r <= zeroTol) {
      this.userCoeffs[k] = new Complex(0, 0);
      this.vertices = setVerticesFromCoeffs(this.userCoeffs, this._dim);
      return;
    }

    const ux = dx / r, uy = dy / r;
    const tx = -uy, ty = ux;
    let radialDominant = true;
    if (classifyByDelta && this.lastDiscPointer) {
      const ddx = mx - this.lastDiscPointer.x, ddy = my - this.lastDiscPointer.y;
      const pr = Math.abs(ddx * ux + ddy * uy);
      const pt = Math.abs(ddx * tx + ddy * ty);
      radialDominant = pr >= pt;
    }

    const ck0 = this.userCoeffs[k] || new Complex(0, 0);
    let amp = Math.hypot(ck0.re, ck0.im);
    let phase = Math.atan2(ck0.im, ck0.re);

    const cap = 1.25;
    if (radialDominant) {
      const ampNorm = r / Math.max(1e-6, rInnerDisc);
      amp = Math.max(0, Math.min(cap, ampNorm * this.baseScale));
    } else {
      phase = Math.atan2(-dy, dx);
    }
    this.userCoeffs[k] = new Complex(amp * Math.cos(phase), amp * Math.sin(phase));
    this.vertices = setVerticesFromCoeffs(this.userCoeffs, this._dim);
  }
}
