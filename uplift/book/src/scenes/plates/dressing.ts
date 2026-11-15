/**
 * Lesson 2's dressing rules (session 7D): presentation read from the authored field, never relief logic.
 * Every rule is a pure, deterministic function of the block grid it is handed (and of fixed look options);
 * none changes the field or knows a boundary's formula. Plug them into the diorama with
 * `createValleyDiorama({ rules: platesDressingRules(options) })`.
 *
 * - **Streams** by steepest descent over the surface with its closed hollows filled (a priority flood from
 *   the block's edges), drawn where enough ground drains through a cell: the stream valleys that cross the
 *   boundary get their streams, so a transform offset reads in the streams as well as the ridges (D-W7-7R,
 *   decision 1).
 * - **Lakes** in closed hollows of ground that has dropped along faults (a negative layer offset: the rift
 *   floor), filled part-way, never to the brim (a look choice).
 * - **Fault scarps** as ink lines where the rock-layer offset steps sharply across a short distance (the
 *   rift's normal faults), so scarps that face the light still read (D-W7-7R, decision 2).
 * - **Hachures** on ground that is steep as drawn (with the vertical exaggeration), denser and longer on
 *   steeper ground: scarps and range flanks.
 * - **A fault trace** (optional): a straight ink line along one grid column, for the transform boundary,
 *   drawn as ink and never cut into the relief (D-W7-7A, decision 6).
 *
 * Illustration only (D-L2-1): these are drawn paths and marks, not a hydrology or tectonic model.
 */
import type { BlockGrid, DressingConfig, DressingRules } from "@hachure/ink/stage";

export interface PlatesDressingOptions {
  /** Vertical exaggeration the block is drawn with (unit: none); hachures follow the slope as drawn. */
  readonly reliefScale: number;
  /** Cells draining through a cell before a stream is drawn there (unit: cells). */
  readonly streamMinDrainageCells?: number;
  /** Shallowest hollow drawn as a lake (unit: metres, real). */
  readonly lakeMinDepthM?: number;
  /** Deepest water drawn in a lake, below its spill level (unit: metres, real). Look choice. */
  readonly lakeMaxDepthM?: number;
  /** Ground counts as dropped (a rift floor) below this layer offset (unit: metres, real; negative). */
  readonly droppedBelowM?: number;
  /** A fault scarp needs at least this layer-offset step between neighbouring cells (unit: metres). */
  readonly scarpMinStepM?: number;
  /** Hachures on ground steeper than this, as drawn (unit: degrees). */
  readonly hachureMinDrawnSlopeDeg?: number;
  /** Lattice spacing of the hachures (unit: cells). */
  readonly hachureSpacingCells?: number;
  /** A straight fault trace along this block-grid column (fractional), or null for none. Read per call. */
  readonly faultTraceColumn?: () => number | null;
}

const DEFAULTS = {
  streamMinDrainageCells: 140,
  lakeMinDepthM: 40,
  lakeMaxDepthM: 70,
  droppedBelowM: -150,
  scarpMinStepM: 45,
  hachureMinDrawnSlopeDeg: 38,
  hachureSpacingCells: 2,
} as const;

/** A binary min-heap of cells by level, ties by insertion order (deterministic). Fixed capacity. */
class Heap {
  private readonly cells: Int32Array;
  private readonly levels: Float64Array;
  private readonly order: Int32Array;
  private n = 0;
  private seq = 0;
  constructor(capacity: number) {
    this.cells = new Int32Array(capacity);
    this.levels = new Float64Array(capacity);
    this.order = new Int32Array(capacity);
  }
  get size() {
    return this.n;
  }
  private less(i: number, j: number) {
    const a = this.levels[i]!;
    const b = this.levels[j]!;
    return a < b || (a === b && this.order[i]! < this.order[j]!);
  }
  private swap(i: number, j: number) {
    const { cells, levels, order } = this;
    const c = cells[i]!;
    cells[i] = cells[j]!;
    cells[j] = c;
    const l = levels[i]!;
    levels[i] = levels[j]!;
    levels[j] = l;
    const o = order[i]!;
    order[i] = order[j]!;
    order[j] = o;
  }
  push(cell: number, level: number) {
    let i = this.n++;
    this.cells[i] = cell;
    this.levels[i] = level;
    this.order[i] = this.seq++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.cells[0]!;
    this.n--;
    if (this.n > 0) this.swap(0, this.n);
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < this.n && this.less(l, m)) m = l;
      if (r < this.n && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
}

export interface Drainage {
  /** Surface raised to the spill level of each closed hollow (unit: metres). */
  readonly filledM: Float32Array;
  /** Next cell downstream; −1 on the block's edge (water leaves the block there). */
  readonly receiver: Int32Array;
  /** Cells draining through each cell, itself included (unit: cells). */
  readonly drainage: Float32Array;
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/**
 * Routes every cell to the block's edge over the filled surface (priority flood from all four edges) and
 * counts the cells draining through each. Pure and deterministic (ties broken by visiting order).
 */
export function drainage(g: BlockGrid): Drainage {
  const { across, along } = g;
  const n = across * along;
  const filledM = new Float32Array(n);
  const receiver = new Int32Array(n).fill(-2);
  const order = new Int32Array(n);
  const heap = new Heap(n);
  for (let l = 0; l < along; l++)
    for (let a = 0; a < across; a++) {
      if (a > 0 && a < across - 1 && l > 0 && l < along - 1) continue;
      const k = l * across + a;
      filledM[k] = g.bedM[k]!;
      receiver[k] = -1;
      heap.push(k, filledM[k]!);
    }
  let visited = 0;
  while (heap.size) {
    const c = heap.pop();
    order[visited++] = c;
    const a = c % across;
    const l = (c - a) / across;
    for (const [da, dl] of NEIGHBOURS) {
      const x = a + da;
      const y = l + dl;
      if (x < 0 || y < 0 || x >= across || y >= along) continue;
      const k = y * across + x;
      if (receiver[k] !== -2) continue;
      // A tiny rise per step across a filled flat keeps every path draining (unit: metres).
      filledM[k] = Math.max(g.bedM[k]!, filledM[c]! + 1e-3);
      receiver[k] = c;
      heap.push(k, filledM[k]!);
    }
  }
  const area = new Float32Array(n).fill(1);
  for (let i = visited - 1; i >= 0; i--) {
    const k = order[i]!;
    const r = receiver[k]!;
    if (r >= 0) area[r]! += area[k]!;
  }
  return { filledM, receiver, drainage: area };
}

/** Chaikin corner cutting on an open polyline (`x0, y0, …`); the ends stay put. */
function smooth(points: readonly number[], iterations = 2): number[] {
  let p = [...points];
  for (let it = 0; it < iterations && p.length >= 6; it++) {
    const out = [p[0]!, p[1]!];
    for (let i = 0; i + 3 < p.length; i += 2) {
      const [x0, y0, x1, y1] = [p[i]!, p[i + 1]!, p[i + 2]!, p[i + 3]!];
      out.push(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1, 0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1);
    }
    out.push(p[p.length - 2]!, p[p.length - 1]!);
    p = out;
  }
  return p;
}

/**
 * Streams: from each channel head (a cell with enough drainage and no channel above it), down the
 * receivers to the block's edge or to a stream already drawn (the junction cell is included, so tributaries
 * meet their stream). Polylines in fractional cell coordinates, smoothed.
 */
export function streamPaths(
  g: BlockGrid,
  d: Drainage,
  minDrainageCells: number,
  lastRow: number,
): number[][] {
  const { across } = g;
  const n = d.drainage.length;
  const channel = (k: number) => d.drainage[k]! >= minDrainageCells;
  const hasChannelAbove = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const r = d.receiver[k]!;
    if (r >= 0 && channel(k)) hasChannelAbove[r] = 1;
  }
  const drawn = new Uint8Array(n);
  const heads: number[] = [];
  for (let k = 0; k < n; k++) if (channel(k) && !hasChannelAbove[k]) heads.push(k);
  // Larger catchments first, so a main stream is traced whole and tributaries end on it.
  heads.sort((p, q) => d.drainage[q]! - d.drainage[p]! || p - q);
  const paths: number[][] = [];
  for (const head of heads) {
    const cells: number[] = [];
    let k = head;
    for (let guard = 0; guard < n && k >= 0; guard++) {
      cells.push(k);
      if (drawn[k]) break;
      drawn[k] = 1;
      k = d.receiver[k]!;
    }
    const pts: number[] = [];
    for (const c of cells) {
      const a = c % across;
      const l = (c - a) / across;
      if (l > lastRow) break;
      pts.push(a, l);
    }
    if (pts.length >= 6) paths.push(smooth(pts, 2));
  }
  return paths;
}

/**
 * Lake levels: closed hollows (filled surface above the ground by at least `minDepthM`) on dropped ground,
 * each filled to at most `maxDepthM` above its deepest cell and never above its spill level. Not finite
 * where dry. Rows past `lastRow − 1` stay dry, so no water stands open at the cut face.
 */
export function lakeLevels(
  g: BlockGrid,
  d: Drainage,
  o: { minDepthM: number; maxDepthM: number; droppedBelowM: number },
  lastRow: number,
): Float32Array | null {
  const offset = g.layerOffsetM;
  if (!offset) return null;
  const { across, along } = g;
  const n = across * along;
  const rows = Math.min(along, lastRow);
  const hollow = (k: number) =>
    d.filledM[k]! - g.bedM[k]! >= o.minDepthM && offset[k]! < o.droppedBelowM && k < rows * across;
  const levels = new Float32Array(n).fill(NaN);
  const seen = new Uint8Array(n);
  let any = false;
  for (let s = 0; s < n; s++) {
    if (seen[s] || !hollow(s)) continue;
    // One hollow: the connected cells sharing (about) one spill level.
    const cells: number[] = [];
    const stack = [s];
    seen[s] = 1;
    let deepest = Infinity;
    let spill = -Infinity;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      deepest = Math.min(deepest, g.bedM[c]!);
      spill = Math.max(spill, d.filledM[c]!);
      const a = c % across;
      const l = (c - a) / across;
      for (const [da, dl] of NEIGHBOURS) {
        const x = a + da;
        const y = l + dl;
        if (x < 0 || y < 0 || x >= across || y >= along) continue;
        const k = y * across + x;
        if (!seen[k] && hollow(k)) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
    const level = Math.min(spill, deepest + o.maxDepthM);
    for (const c of cells)
      if (g.bedM[c]! < level) {
        levels[c] = level;
        any = true;
      }
  }
  return any ? levels : null;
}

/**
 * Fault scarps: per row, the columns where the layer offset steps by at least `minStepM` between
 * neighbouring cells, and the step stands out from the offset's slope a few cells away (a fault, not the
 * broad bend under a range). Points in consecutive rows within 1.5 cells are joined into lines.
 */
export function scarpLines(g: BlockGrid, minStepM: number, lastRow: number): number[][] {
  const offset = g.layerOffsetM;
  if (!offset) return [];
  const { across } = g;
  const rows = Math.min(g.along - 1, lastRow);
  const lines: { points: number[]; lastA: number; lastL: number }[] = [];
  for (let l = 0; l <= rows; l++) {
    const step = (a: number) => offset[l * across + a + 1]! - offset[l * across + a]!;
    for (let a = 3; a < across - 4; a++) {
      const s = Math.abs(step(a));
      if (s < minStepM || s < Math.abs(step(a - 1)) || s <= Math.abs(step(a + 1))) continue;
      const far = Math.max(Math.abs(step(a - 3)), Math.abs(step(a + 3)));
      if (s < 2.5 * far) continue;
      // The step lies between columns a and a + 1.
      const x = a + 0.5;
      const line = lines.find((ln) => ln.lastL === l - 1 && Math.abs(ln.lastA - x) <= 1.5);
      if (line) {
        line.points.push(x, l);
        line.lastA = x;
        line.lastL = l;
      } else lines.push({ points: [x, l], lastA: x, lastL: l });
    }
  }
  return lines.filter((ln) => ln.points.length >= 6).map((ln) => ln.points);
}

/**
 * Hachures on ground steep as drawn: on a lattice of `spacing` cells, a stroke pointing downslope, longer
 * on steeper ground. Segments `a0, l0, a1, l1` in fractional cells.
 */
export function drawnSlopeHachures(
  g: BlockGrid,
  reliefScale: number,
  minDrawnSlopeDeg: number,
  spacing: number,
  lastRow: number,
): number[] {
  const out: number[] = [];
  const { across, along } = g;
  const m = g.metresPerCell;
  const at = (a: number, l: number) => g.bedM[l * across + a]!;
  for (let l = 1; l < Math.min(lastRow, along - 1); l += spacing) {
    for (let a = 1 + (l % (2 * spacing) ? 1 : 0); a < across - 1; a += spacing) {
      const gx = ((at(a + 1, l) - at(a - 1, l)) / (2 * m)) * reliefScale;
      const gy = ((at(a, l + 1) - at(a, l - 1)) / (2 * m)) * reliefScale;
      const s = Math.hypot(gx, gy);
      const deg = (Math.atan(s) * 180) / Math.PI;
      if (deg < minDrawnSlopeDeg) continue;
      const len = Math.min(1.6, 0.6 + (deg - minDrawnSlopeDeg) / 20) * spacing * 0.55;
      out.push(a, l, a - (gx / s) * len, l - (gy / s) * len);
    }
  }
  return out;
}

/** The dressing rule set for `createValleyDiorama({ rules })`. Streams and lakes share one routing. */
export function platesDressingRules(options: PlatesDressingOptions): DressingRules {
  const o = { ...DEFAULTS, ...options };
  let cache: { grid: BlockGrid; d: Drainage } | null = null;
  const routed = (g: BlockGrid) => {
    if (cache?.grid !== g) cache = { grid: g, d: drainage(g) };
    return cache.d;
  };
  return Object.freeze({
    // The lesson-1 meltwater river does not apply here.
    river: () => [],
    streams: (g: BlockGrid, _cfg: DressingConfig, lastRow: number) =>
      streamPaths(g, routed(g), o.streamMinDrainageCells, lastRow),
    lakes: (g: BlockGrid, _cfg: DressingConfig, lastRow: number) =>
      lakeLevels(
        g,
        routed(g),
        { minDepthM: o.lakeMinDepthM, maxDepthM: o.lakeMaxDepthM, droppedBelowM: o.droppedBelowM },
        lastRow,
      ),
    hachures: (g: BlockGrid, _cfg: DressingConfig, lastRow: number) =>
      drawnSlopeHachures(g, o.reliefScale, o.hachureMinDrawnSlopeDeg, o.hachureSpacingCells, lastRow),
    inkLines: (g: BlockGrid, _cfg: DressingConfig, lastRow: number) => {
      const lines = scarpLines(g, o.scarpMinStepM, lastRow).map((points) => ({ points, widthPx: 1.6 }));
      const trace = o.faultTraceColumn?.() ?? null;
      if (trace !== null) {
        const points: number[] = [];
        for (let l = 0; l <= Math.min(lastRow, g.along - 1); l++) points.push(trace, l);
        lines.push({ points, widthPx: 1.8 });
      }
      return lines;
    },
  });
}
