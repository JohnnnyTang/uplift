/**
 * Production dressing rules for the glacial scene (session 5K): presentation read from model state, never a
 * process. Plug them into the diorama with `createValleyDiorama({ rules: GLACIAL_DRESSING_RULES })`.
 *
 * - The meltwater river starts just below the glacier's snout and is routed by steepest descent over the
 *   bed with its closed hollows filled to their spill level (a priority flood from the block's downstream
 *   edge). It never steps back up the valley and never runs onto ice, and where the ice has carved a basin
 *   (an overdeepening) the path crosses it at the basin's lip instead of assuming the bed drains down-valley.
 * - Flow marks trace the modelled ice surface velocity; each dash is longer where the ice moves faster, so
 *   the marks show both direction and relative speed.
 *
 * Pure and deterministic (no unseeded randomness); a drawn path only, not a hydrology or ice model.
 */
import type { DressingRules } from "../stage/diorama";
import {
  type DressingConfig,
  DEFAULT_DRESSING,
  gradient,
  iceFlowLines,
  riverCells,
  sampleField,
} from "../stage/dressing";
import type { BlockGrid } from "../stage/snapshot";

const iced = (g: BlockGrid, k: number, cfg: DressingConfig) => g.iceM[k]! > cfg.iceThresholdM;

/**
 * Block row of the glacier's snout: the most downstream row whose valley bottom (the lowest bed cell of the
 * row, ± 2 cells) carries ice. Thin ice on the ridges outside the valley does not count. −1 without ice.
 */
export function snoutRow(g: BlockGrid, cfg: DressingConfig = DEFAULT_DRESSING): number {
  for (let l = g.along - 1; l >= 0; l--) {
    let low = 0;
    for (let a = 1; a < g.across; a++) if (g.bedM[l * g.across + a]! < g.bedM[l * g.across + low]!) low = a;
    for (let a = Math.max(0, low - 2); a <= Math.min(g.across - 1, low + 2); a++)
      if (iced(g, l * g.across + a, cfg)) return l;
  }
  return -1;
}

/** A binary min-heap of cells ordered by level, ties by insertion order (deterministic). */
class CellHeap {
  private readonly level: number[] = [];
  private readonly order: number[] = [];
  private readonly cell: number[] = [];
  private seq = 0;
  get size() {
    return this.cell.length;
  }
  private less(i: number, j: number) {
    return (
      this.level[i]! < this.level[j]! || (this.level[i] === this.level[j] && this.order[i]! < this.order[j]!)
    );
  }
  private swap(i: number, j: number) {
    for (const arr of [this.level, this.order, this.cell]) [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  push(cell: number, level: number) {
    this.level.push(level);
    this.order.push(this.seq++);
    this.cell.push(cell);
    let i = this.cell.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.cell[0]!;
    const last = this.cell.length - 1;
    this.swap(0, last);
    this.level.pop();
    this.order.pop();
    this.cell.pop();
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < this.cell.length && this.less(l, m)) m = l;
      if (r < this.cell.length && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
}

export interface FilledRouting {
  /** Bed raised to the spill level of each closed hollow (unit: metres); Infinity where unreachable. */
  readonly filledM: Float32Array;
  /** Next cell towards the block's downstream edge; −2 on that edge, −1 where unreachable (ice). */
  readonly receiver: Int32Array;
}

/**
 * Routes every ice-free cell to the downstream edge of the block (the last block row) over the bed with its
 * hollows filled (priority flood). A cell's receiver is always beside it or one row downstream, so no path
 * ever climbs back up the valley; ice cells are never entered.
 */
export function routeFilledBed(g: BlockGrid, cfg: DressingConfig = DEFAULT_DRESSING): FilledRouting {
  const n = g.across * g.along;
  const filledM = new Float32Array(n).fill(Infinity);
  const receiver = new Int32Array(n).fill(-1);
  const heap = new CellHeap();
  const last = g.along - 1;
  for (let a = 0; a < g.across; a++) {
    const k = last * g.across + a;
    if (iced(g, k, cfg)) continue;
    filledM[k] = g.bedM[k]!;
    receiver[k] = -2;
    heap.push(k, filledM[k]!);
  }
  while (heap.size) {
    const c = heap.pop();
    const a = c % g.across;
    const l = Math.floor(c / g.across);
    // Cells that may drain into c: beside it, or one row up the valley (so c lies beside or downstream).
    for (let dl = -1; dl <= 0; dl++)
      for (let da = -1; da <= 1; da++) {
        if (!da && !dl) continue;
        const x = a + da;
        const y = l + dl;
        if (x < 0 || y < 0 || x >= g.across) continue;
        const k = y * g.across + x;
        if (receiver[k] !== -1 || iced(g, k, cfg)) continue;
        filledM[k] = Math.max(g.bedM[k]!, filledM[c]!);
        receiver[k] = c;
        heap.push(k, filledM[k]!);
      }
  }
  return { filledM, receiver };
}

/**
 * The meltwater river: from the lowest cell of the row just below the snout, follow the filled-bed routing to
 * the downstream edge. Without ice, it starts in the second row. Falls back to the 5H steepest-descent rule
 * if the source cannot reach the edge. Returns block-grid cell indices in order.
 */
export function riverOnFilledBed(g: BlockGrid, cfg: DressingConfig = DEFAULT_DRESSING): number[] {
  const snout = snoutRow(g, cfg);
  const row = snout < 0 ? 1 : snout + 1;
  if (row >= g.along - 1) return [];
  let source = -1;
  for (let a = 1; a < g.across - 1; a++) {
    const k = row * g.across + a;
    if (iced(g, k, cfg)) continue;
    if (source < 0 || g.bedM[k]! < g.bedM[source]!) source = k;
  }
  if (source < 0) return [];
  const { receiver } = routeFilledBed(g, cfg);
  if (receiver[source] === -1) return riverCells(g, cfg);
  const path = [source];
  for (let k = source; receiver[k]! >= 0 && path.length <= g.across * g.along;) {
    k = receiver[k]!;
    path.push(k);
  }
  return path;
}

/**
 * Flow marks along the modelled ice surface velocity: streamlines seeded across the glacier where it is
 * wide, broken into dashes whose length grows with the local speed (relative to the fastest ice in view).
 * Falls back to the 5H rule (down the ice-surface slope) when the snapshot carries no velocity.
 */
export function speedFlowLines(
  g: BlockGrid,
  cfg: DressingConfig = DEFAULT_DRESSING,
  lastRow = g.along - 1,
): number[][] {
  const vel = g.velocity;
  if (!vel) return iceFlowLines(g, cfg, lastRow);
  const minIce = cfg.iceThresholdM * 2;
  let maxSpeed = 0;
  for (let l = 0; l <= lastRow; l++)
    for (let a = 0; a < g.across; a++) {
      const k = l * g.across + a;
      if (g.iceM[k]! > minIce) maxSpeed = Math.max(maxSpeed, Math.hypot(vel.across[k]!, vel.along[k]!));
    }
  if (!(maxSpeed > 0)) return [];
  const surface = new Float32Array(g.bedM.length);
  for (let k = 0; k < surface.length; k++) surface[k] = g.bedM[k]! + g.iceM[k]!;
  const iceWidth = (l: number) => {
    let lo = -1;
    let hi = -1;
    for (let a = 0; a < g.across; a++)
      if (g.iceM[l * g.across + a]! > minIce) {
        if (lo < 0) lo = a;
        hi = a;
      }
    return lo < 0 ? null : ([lo, hi] as const);
  };
  let widest = 0;
  for (let l = 0; l <= lastRow; l++) {
    const w = iceWidth(l);
    if (w) widest = Math.max(widest, w[1] - w[0]);
  }
  let seedRow = -1;
  // Seed where the glacier is wide and already flows down the valley (near the headwall the modelled ice
  // can flow back into the head basin).
  const downValley = (l: number, lo: number, hi: number) => {
    let sum = 0;
    for (let a = lo; a <= hi; a++) sum += vel.along[l * g.across + a]!;
    return sum > 0;
  };
  for (let l = 1; l <= lastRow && seedRow < 0; l++) {
    const w = iceWidth(l);
    if (w && w[1] - w[0] >= widest * 0.55 && downValley(l, w[0], w[1])) seedRow = l;
  }
  const lines: number[][] = [];
  if (seedRow < 0 || widest < 2) return lines;
  const [lo, hi] = iceWidth(seedRow)!;
  const step = 0.5;
  for (const f of [-0.66, -0.33, 0, 0.33, 0.66]) {
    let x = (lo + hi) / 2 + ((hi - lo) / 2) * f;
    let y = seedRow;
    let dash: number[] = [];
    let on = false;
    let left = 0;
    for (let s = 0; s < 1200; s++) {
      if (sampleField(g.iceM, g, x, y) <= minIce) break;
      const vx = sampleField(vel.across, g, x, y);
      const vy = sampleField(vel.along, g, x, y);
      const speed = Math.hypot(vx, vy);
      // Where the recorded speed is ~0 (slow ice near the head), steer down the ice-surface slope.
      let ux = vx / speed;
      let uy = vy / speed;
      if (!(speed > maxSpeed * 1e-3)) {
        const [gx, gy] = gradient(surface, g, Math.round(x), Math.round(y));
        const len = Math.hypot(gx, gy);
        if (!(len > 1e-9)) break;
        ux = -gx / len;
        uy = -gy / len;
      }
      if (left <= 0) {
        // A dash covers 1.5–6 cells, by local speed; gaps stay 2 cells, so faster ice reads as longer marks.
        on = !on;
        left = on ? 1.5 + 4.5 * Math.min(1, speed / maxSpeed) : 2;
        if (!on && dash.length >= 4) lines.push(dash);
        if (on) dash = [x, y];
      }
      x += ux * step;
      y += uy * step;
      left -= step;
      if (y > lastRow) break;
      if (on) dash.push(x, y);
    }
    if (on && dash.length >= 4) lines.push(dash);
  }
  return lines;
}

/** The production rule set for `createValleyDiorama({ rules })`. */
export const GLACIAL_DRESSING_RULES: DressingRules = Object.freeze({
  river: riverOnFilledBed,
  flowLines: speedFlowLines,
});
