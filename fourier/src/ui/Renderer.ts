import { Complex } from '../math/Complex';
import { getDFTCoeffs } from '../math/dft';
import { computeAveragingPolygon } from '../math/polygon';
import type { SimSnapshot } from '../sim/SimState';
import { Theme } from './theme';

export class Renderer {
  constructor(private canvas: HTMLCanvasElement) {}

  render(snap: SimSnapshot): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const w = this.canvas.width, h = this.canvas.height;
    const cx = w / 2, cy = h / 2;
    const view_r = Math.min(w, h) / 2 * 0.8;
    ctx.clearRect(0, 0, w, h);

    const { dim, vertices, userCoeffs, baseScale, midpointIterates, alphaBlend } = snap;

    // background ring
    const r_outer = Math.min(w / 2, h / 2);
    const r_inner = r_outer * 0.73;
    ctx.beginPath();
    ctx.arc(cx, cy, r_outer, 0, Math.PI * 2, false);
    ctx.moveTo(cx + r_inner, cy);
    ctx.arc(cx, cy, r_inner, 0, Math.PI * 2, true);
    ctx.fillStyle = Theme.ring.fill;
    ctx.fill();

    // coefficients for current polygon P (or spectral override if active)
    const coeffs = userCoeffs || getDFTCoeffs(vertices, dim);

    // compute dominant-mode highlighting set (exclude k=0)
    const mags = new Array(dim).fill(0);
    let maxMag = 0;
    for (let kk = 1; kk < dim; kk++) {
      const c = coeffs[kk] || new Complex(0, 0);
      mags[kk] = Math.hypot(c.re, c.im);
      if (mags[kk] > maxMag) { maxMag = mags[kk]; }
    }
    const highlight = new Set<number>();
    if (maxMag > 0) {
      const thresh = maxMag * 0.96;
      for (let kk = 1; kk < dim; kk++) if (mags[kk] >= thresh) highlight.add(kk);
    }

    // disc geometry
    const pad = 2;
    const r_mid = (r_outer + r_inner) / 2;
    const halfThick = (r_outer - r_inner) / 2;
    const chord = 2 * r_mid * Math.sin(Math.PI / Math.max(3, dim));
    const R_radial = Math.max(0, halfThick - pad);
    const R_angular = Math.max(0, (chord - pad) / 2);
    const Rdisc = Math.max(0, Math.min(R_radial, R_angular));
    const rInnerDisc = Rdisc * 0.75;

    for (let k = 0; k < dim; k++) {
      const theta = -(2 * Math.PI * k) / dim;
      const x = cx + r_mid * Math.cos(theta);
      const y = cy + r_mid * Math.sin(theta);

      // white disc
      ctx.beginPath();
      ctx.arc(x, y, Rdisc, 0, Math.PI * 2);
      ctx.fillStyle = highlight.has(k) ? Theme.disc.highlight : Theme.disc.fill;
      ctx.fill();
      ctx.strokeStyle = Theme.disc.border;
      ctx.lineWidth = Theme.disc.borderWidth;
      ctx.stroke();

      // thin gray inner circle at 75%
      ctx.beginPath();
      ctx.arc(x, y, rInnerDisc, 0, Math.PI * 2);
      ctx.strokeStyle = Theme.disc.inner;
      ctx.lineWidth = Theme.disc.innerWidth;
      ctx.stroke();

      // Eigenpolygon inside each disc
      const ck = coeffs[k] || new Complex(0, 0);
      const ampFactor = Math.min(1.25, Math.max(0, (Math.hypot(ck.re, ck.im) + 1e-12) / Math.max(1e-12, baseScale)));
      const phase = Math.atan2(ck.im, ck.re);
      const step = k % dim;

      const pts: { x: number; y: number }[] = new Array(dim);
      for (let m = 0; m < dim; m++) {
        const idx = (m * step) % dim;
        const ang = (2 * Math.PI * idx) / dim + phase;
        pts[m] = {
          x: x + (rInnerDisc * ampFactor) * Math.cos(ang),
          y: y - (rInnerDisc * ampFactor) * Math.sin(ang),
        };
      }

      // edges (last edge dashed)
      for (let i = 0; i < dim; i++) {
        const j = (i + 1) % dim;
        if (i === dim - 1) ctx.setLineDash([10, 3]); else ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.strokeStyle = Theme.disc.edgeColor;
        ctx.lineWidth = Theme.disc.edgeWidth;
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // vertices (black circles, vertex 0 with blue ring)
      const vR = Theme.disc.vertexRadius;
      for (let i = 0; i < dim; i++) {
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, vR, 0, Math.PI * 2);
        ctx.strokeStyle = Theme.disc.vertexColor;
        ctx.lineWidth = 1;
        ctx.stroke();
        if (i === 0) {
          ctx.strokeStyle = Theme.disc.vertex0;
          ctx.lineWidth = Theme.disc.vertex0Width;
          ctx.stroke();
        }
      }

      // arrowheads on non-dashed edges
      for (let i = 0; i < dim - 1; i++) {
        const j = (i + 1) % dim;
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const ang = Math.atan2(dy, dx);
        const headlen = Theme.disc.arrowHead;
        ctx.beginPath();
        ctx.moveTo(pts[j].x - headlen * Math.cos(ang - Math.PI / 6), pts[j].y - headlen * Math.sin(ang - Math.PI / 6));
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.lineTo(pts[j].x - headlen * Math.cos(ang + Math.PI / 6), pts[j].y - headlen * Math.sin(ang + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = Theme.disc.arrowFill;
        ctx.fill();
      }
    }

    // labels 0..dim-1 along the outer boundary
    ctx.save();
    ctx.fillStyle = Theme.label.color;
    const labelPx = (dim <= 50 ? 15 : 10);
    ctx.font = `${labelPx}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const r_lab = r_outer - 4;
    for (let k = 0; k < dim; k++) {
      const theta = -(2 * Math.PI * k) / dim;
      const lx = cx + r_lab * Math.cos(theta);
      const ly = cy + r_lab * Math.sin(theta);
      ctx.fillText(String(k), lx, ly);
    }
    ctx.restore();

    // polygon edges UNDER vertices
    ctx.lineWidth = Theme.polygon.edgeWidth;
    ctx.strokeStyle = Theme.polygon.edge;
    for (let i = 0; i < dim; i++) {
      const j = (i + 1) % dim;
      const x1 = cx + vertices[i].re * view_r;
      const y1 = cy - vertices[i].im * view_r;
      const x2 = cx + vertices[j].re * view_r;
      const y2 = cy - vertices[j].im * view_r;
      if (i === dim - 1) ctx.setLineDash([20, 5]); else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // vertices ON TOP of edges
    const disc_r = Theme.polygon.vertexRadius;
    for (let i = 0; i < dim; i++) {
      const x = cx + vertices[i].re * view_r;
      const y = cy - vertices[i].im * view_r;
      ctx.beginPath();
      ctx.arc(x, y, disc_r, 0, 2 * Math.PI);
      ctx.strokeStyle = Theme.polygon.vertex;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (i === 0) {
        ctx.strokeStyle = Theme.polygon.vertex0;
        ctx.lineWidth = Theme.polygon.vertex0Width;
        ctx.stroke();
      }
    }

    // arrowheads LAST
    for (let i = 0; i < dim - 1; i++) {
      const j = (i + 1) % dim;
      const x1 = cx + vertices[i].re * view_r;
      const y1 = cy - vertices[i].im * view_r;
      const x2 = cx + vertices[j].re * view_r;
      const y2 = cy - vertices[j].im * view_r;
      const dx = x2 - x1, dy = y2 - y1;
      const angle = Math.atan2(dy, dx);
      const headlen = Theme.polygon.arrowHead;
      ctx.beginPath();
      ctx.moveTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = Theme.polygon.arrowFill;
      ctx.fill();
    }

    // averaging polygon iterates (blue)
    if (midpointIterates > 0) {
      let avgVerts = vertices.map(v => new Complex(v.re, v.im));
      ctx.setLineDash([]);
      ctx.strokeStyle = Theme.averaging.stroke;
      ctx.lineWidth = Theme.averaging.lineWidth;
      for (let iter = 0; iter < midpointIterates; iter++) {
        avgVerts = computeAveragingPolygon(avgVerts, alphaBlend);
        ctx.beginPath();
        for (let i = 0; i < dim; i++) {
          const px = cx + avgVerts[i].re * view_r;
          const py = cy - avgVerts[i].im * view_r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }
}
