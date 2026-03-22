import { Complex } from './Complex';

/**
 * One step of the averaging polygon transform:
 * each vertex i maps to (1-alpha)*v[i] + alpha*v[(i+1)%n]
 */
export function computeAveragingPolygon(verts: readonly Complex[], alpha: number): Complex[] {
  const n = verts.length;
  const result = new Array<Complex>(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const vi = verts[i], vj = verts[j];
    result[i] = new Complex(
      (1 - alpha) * vi.re + alpha * vj.re,
      (1 - alpha) * vi.im + alpha * vj.im
    );
  }
  return result;
}
