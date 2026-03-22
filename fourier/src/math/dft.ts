import { Complex } from './Complex';

/**
 * Forward DFT: c_k = (1/dim) * sum_m P_m * exp(-i 2π k m/dim)
 */
export function getDFTCoeffs(vertices: readonly Complex[], dim: number): Complex[] {
  const coeffs = new Array<Complex>(dim);
  for (let k = 0; k < dim; k++) {
    let re = 0, im = 0;
    for (let m = 0; m < dim; m++) {
      const theta = -2 * Math.PI * k * m / dim;
      const cs = Math.cos(theta), sn = Math.sin(theta);
      const x = vertices[m].re, y = vertices[m].im;
      re += x * cs - y * sn;
      im += x * sn + y * cs;
    }
    coeffs[k] = new Complex(re / dim, im / dim);
  }
  return coeffs;
}

/**
 * Inverse DFT: reconstruct vertices from coefficients
 * P_m = sum_k c_k * exp(i 2π k m/dim)
 */
export function setVerticesFromCoeffs(coeffs: Complex[], dim: number): Complex[] {
  const out = new Array<Complex>(dim);
  for (let m = 0; m < dim; m++) {
    let re = 0, im = 0;
    for (let k = 0; k < dim; k++) {
      const theta = 2 * Math.PI * k * m / dim;
      const cs = Math.cos(theta), sn = Math.sin(theta);
      const ck = coeffs[k] || new Complex(0, 0);
      re += ck.re * cs - ck.im * sn;
      im += ck.re * sn + ck.im * cs;
    }
    out[m] = new Complex(re, im);
  }
  return out;
}
