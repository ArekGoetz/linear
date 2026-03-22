import { Complex } from './Complex';

export interface PhysicsParams {
  mass: number;
  kEdge: number;
  kBend: number;
  damping: number;
  kFollowBase: number;
  lambda: number;
  a0: number;
  rho: number;
  kRadial: number;
}

export interface PhysicsStepOpts {
  dragging: number;
  mouseTarget: Complex | null;
  mouseVel: Complex;
  initialCOM: Complex;
  initialDiameter: number;
  isFrozen: boolean;
  dim: number;
  smoothedAMag: number;
}

/** s(a) = 1 / (1 + (a/a0)^2) */
export function rigidityFromAccel(aMag: number, a0: number): number {
  const r = 1 / (1 + (aMag / a0) * (aMag / a0));
  return Math.max(0.0, Math.min(1.0, r));
}

/** default λ depends on number of vertices (smaller n → larger λ) */
export function lambdaDefault(n: number): number {
  const val = 9 / Math.max(3, n) + 0.15;
  return Math.max(0.05, Math.min(3.0, val));
}

/**
 * default damping slider position as a function of dim:
 * - at n=5 → 2.5% of scale
 * - grows linearly to 50% by n=60, then clamped at 50%
 */
export function dampingDefaultFraction(n: number): number {
  const n0 = 5, n1 = 60;
  if (n <= n0) return 0.025;
  if (n >= n1) return 0.50;
  const t = (n - n0) / (n1 - n0);
  return 0.025 + t * (0.50 - 0.025);
}

export function computeCOM(verts: Complex[], dim: number): Complex {
  let sx = 0, sy = 0;
  for (let i = 0; i < dim; i++) { sx += verts[i].re; sy += verts[i].im; }
  return new Complex(sx / dim, sy / dim);
}

export function computeDiameter(verts: Complex[], dim: number): number {
  let D = 0;
  for (let i = 0; i < dim; i++) {
    for (let j = i + 1; j < dim; j++) {
      const d = verts[i].sub(verts[j]).mag();
      if (d > D) D = d;
    }
  }
  return D;
}

function graphDistance(i: number, j: number, dim: number): number {
  let d = Math.abs(i - j);
  d = Math.min(d, dim - d);
  return d;
}

/**
 * Advance physics by dt seconds.
 * Mutates verts and vels in place.
 */
export function physicsStep(
  verts: Complex[],
  vels: Complex[],
  restEdge: number[],
  restLap: Complex[],
  params: PhysicsParams,
  opts: PhysicsStepOpts,
  dt: number
): void {
  const { dragging, mouseTarget, mouseVel, initialCOM, initialDiameter, isFrozen, dim, smoothedAMag } = opts;

  if (isFrozen || dim < 3) return;

  const s = rigidityFromAccel(smoothedAMag, params.a0);

  const acc = new Array<Complex>(dim);
  for (let i = 0; i < dim; i++) acc[i] = new Complex(0, 0);

  const comNow = computeCOM(verts, dim);

  for (let i = 0; i < dim; i++) {
    if (i === dragging) continue;

    // damping
    acc[i] = acc[i].add(vels[i].scale(-params.damping));

    const ip = (i - 1 + dim) % dim;
    const inext = (i + 1) % dim;

    // edge spring to prev
    const dPrev = verts[i].sub(verts[ip]);
    const lenPrev = dPrev.mag();
    if (lenPrev > 1e-8) {
      const stretchPrev = lenPrev - restEdge[ip];
      acc[i] = acc[i].add(dPrev.scale(-params.kEdge * (stretchPrev / lenPrev)));
    }

    // edge spring to next
    const dNext = verts[i].sub(verts[inext]);
    const lenNext = dNext.mag();
    if (lenNext > 1e-8) {
      const stretchNext = lenNext - restEdge[i];
      acc[i] = acc[i].add(dNext.scale(-params.kEdge * (stretchNext / lenNext)));
    }

    // bending / curvature force
    const lap = verts[ip].add(verts[inext]).sub(verts[i].scale(2));
    const lapDelta = lap.sub(restLap[i]);
    acc[i] = acc[i].add(lapDelta.scale(params.kBend));

    // follow force (only if dragging a vertex)
    if (dragging !== -1) {
      const d = graphDistance(i, dragging, dim);
      const w = Math.exp(-params.lambda * d);
      const follow = verts[dragging].sub(verts[i]).scale(params.kFollowBase * s * w);
      acc[i] = acc[i].add(follow);
    }

    // soft diameter keeper: global radial term
    const dir = verts[i].sub(comNow);
    const D = initialDiameter;
    const curD = computeDiameter(verts, dim);
    if (curD > 1e-9) {
      const k = params.kRadial * (curD - D) / D;
      acc[i] = acc[i].add(dir.scale(-k));
    }
  }

  // integrate
  for (let i = 0; i < dim; i++) {
    if (i === dragging) {
      if (mouseTarget) { verts[i] = mouseTarget; vels[i] = mouseVel; }
      continue;
    }
    const a = acc[i];
    vels[i] = vels[i].add(a.scale(dt));
    verts[i] = verts[i].add(vels[i].scale(dt));
  }

  // plasticity: rest edge lengths creep toward current lengths
  if (params.rho > 0) {
    for (let i = 0; i < dim; i++) {
      const j = (i + 1) % dim;
      const L = verts[j].sub(verts[i]).mag();
      restEdge[i] += params.rho * (L - restEdge[i]) * dt;
    }
  }

  // COM constraint (hard)
  const com = computeCOM(verts, dim);
  const dx = initialCOM.re - com.re;
  const dy = initialCOM.im - com.im;
  if (Math.hypot(dx, dy) > 1e-12) {
    if (dragging === -1) {
      for (let i = 0; i < dim; i++) { verts[i].re += dx; verts[i].im += dy; }
    } else {
      const tScale = dim / (dim - 1);
      const tx = dx * tScale, ty = dy * tScale;
      for (let i = 0; i < dim; i++) {
        if (i !== dragging) { verts[i].re += tx; verts[i].im += ty; }
      }
      if (mouseTarget) verts[dragging] = mouseTarget;
    }
  }
}
