import { Complex } from '../math/Complex';
import type { Simulation } from '../sim/Simulation';

export class InteractionHandler {
  private onDown: (e: MouseEvent) => void;
  private onMove: (e: MouseEvent) => void;
  private onUp: (e: MouseEvent) => void;
  private onLeave: (e: MouseEvent) => void;
  private onDocMove: (e: MouseEvent) => void;
  private onDocUp: (e: MouseEvent) => void;

  constructor(private canvas: HTMLCanvasElement, private sim: Simulation) {
    this.onDown = this.handleDown.bind(this);
    this.onMove = this.handleMove.bind(this);
    this.onUp = this.handleUp.bind(this);
    this.onLeave = this.handleLeave.bind(this);
    this.onDocMove = this.handleDocMove.bind(this);
    this.onDocUp = this.handleDocUp.bind(this);

    canvas.addEventListener('mousedown', this.onDown);
    canvas.addEventListener('mousemove', this.onMove);
    canvas.addEventListener('mouseup', this.onUp);
    canvas.addEventListener('mouseleave', this.onLeave);
  }

  destroy(): void {
    this.canvas.removeEventListener('mousedown', this.onDown);
    this.canvas.removeEventListener('mousemove', this.onMove);
    this.canvas.removeEventListener('mouseup', this.onUp);
    this.canvas.removeEventListener('mouseleave', this.onLeave);
  }

  private getCanvasXY(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private mouseToComplex(e: MouseEvent): Complex {
    const { x: mx, y: my } = this.getCanvasXY(e);
    const w = this.canvas.width, h = this.canvas.height;
    const cx = w / 2, cy = h / 2;
    const view_r = Math.min(w, h) / 2 * 0.8;
    return new Complex((mx - cx) / view_r, (cy - my) / view_r);
  }

  private hitTestVertex(mc: Complex): { hit: boolean; closest: number } {
    const snap = this.sim.snapshot();
    const w = this.canvas.width, h = this.canvas.height;
    const view_r = Math.min(w, h) / 2 * 0.8;
    let min_dist = Infinity, closest = -1;
    for (let i = 0; i < snap.dim; i++) {
      const d = snap.vertices[i].sub(mc).mag();
      if (d < min_dist) { min_dist = d; closest = i; }
    }
    const hit = min_dist < 20 / view_r;
    return { hit, closest };
  }

  private hitTestDisc(e: MouseEvent): number {
    const { x, y } = this.getCanvasXY(e);
    return this.sim.hitTestDisc(x, y, this.canvas.width, this.canvas.height);
  }

  private handleDown(e: MouseEvent): void {
    const { x, y } = this.getCanvasXY(e);
    const w = this.canvas.width, h = this.canvas.height;
    const cx = w / 2, cy = h / 2;
    const r_outer = Math.min(w / 2, h / 2);
    const r_inner = r_outer * 0.73;
    const r = Math.hypot(x - cx, y - cy);

    // Disc interaction has priority (except disc 0 locked)
    const discIdx = this.hitTestDisc(e);
    if (discIdx >= 1) {
      this.sim.startDiscDrag(discIdx, x, y, w, h);
      return;
    }

    const mc = this.mouseToComplex(e);
    const { hit, closest } = this.hitTestVertex(mc);

    // Click on gray ring => hard freeze
    if (!hit && r >= r_inner && r <= r_outer) {
      this.sim.clickRing();
      return;
    }

    // Only unfreeze when grabbing a vertex
    if (hit) {
      this.sim.startVertexDrag(closest, mc, performance.now());
    }
  }

  private handleMove(e: MouseEvent): void {
    const snap = this.sim.snapshot();

    // Spectral drag in discs
    if (snap.draggingDisc !== -1) {
      const { x, y } = this.getCanvasXY(e);
      this.sim.moveDiscDrag(x, y, this.canvas.width, this.canvas.height);
      return;
    }

    // Vertex drag
    if (snap.dragging === -1) return;
    const mc = this.mouseToComplex(e);
    this.sim.moveVertexDrag(mc, performance.now());
  }

  private endDrag(): void {
    const snap = this.sim.snapshot();
    if (snap.draggingDisc !== -1) {
      this.sim.endDiscDrag();
      return;
    }
    if (snap.dragging !== -1) {
      this.sim.endVertexDrag();
    }
  }

  private handleUp(_e: MouseEvent): void {
    this.endDrag();
  }

  private handleLeave(_e: MouseEvent): void {
    this.endDrag();
  }

  private handleDocMove(_e: MouseEvent): void {}
  private handleDocUp(_e: MouseEvent): void {}
}
