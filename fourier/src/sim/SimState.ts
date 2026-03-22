import type { Complex } from '../math/Complex';
import type { PhysicsParams } from '../math/physics';

export type { PhysicsParams };

/** Immutable snapshot the renderer and UI consume */
export interface SimSnapshot {
  dim: number;
  expStep: number;
  vertices: Complex[];         // fresh copy each snapshot
  userCoeffs: Complex[] | null;
  baseScale: number;
  midpointIterates: number;
  alphaBlend: number;
  smoothedAMag: number;
  sRigidity: number;           // pre-computed s(a)
  dragging: number;
  draggingDisc: number;
  isFrozen: boolean;
}
