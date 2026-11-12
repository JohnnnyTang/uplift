/**
 * Scene dressing derived from a snapshot: where snow lies, where meadow and trees grow, where the
 * meltwater river runs, flow marks on the ice and ink hachures on the slopes. These are presentation
 * rules that read model state; none of them changes the state or stands in for a process.
 *
 * All functions are pure and deterministic: placement uses an integer hash of the cell, never
 * `Math.random()`, so the same snapshot always dresses the same way.
 */
import type { BlockGrid } from "./snapshot";

export interface DressingConfig {
  /**
   * Altitude above which ice-free gentle ground is drawn snow-covered (unit: metres). The glacier model
   * supplies this from its fixed, authored snowline so that the drawn snow agrees with the mass balance.
   */
  readonly snowlineM: number;
  /** Altitude above which no trees are drawn (unit: metres). Illustrative, not modelled. */
  readonly treelineM: number;
  /** Ground steeper than this is drawn as bare rock, not snow or meadow (unit: degrees). */
  readonly bareRockSlopeDeg: number;
  /** Trees only on ground gentler than this (unit: degrees). */
  readonly maxTreeSlopeDeg: number;
  /** Fraction of eligible cells that get a tree (unit: none, 0–1). */
  readonly treeDensity: number;
  /** Ice thinner than this is not drawn (unit: metres). */
  readonly iceThresholdM: number;
}

export const DEFAULT_DRESSING: DressingConfig = Object.freeze({
  snowlineM: 2200,
  treelineM: 1700,
  bareRockSlopeDeg: 33,
  maxTreeSlopeDeg: 30,
  treeDensity: 0.2,
  iceThresholdM: 1,
});

/** Integer hash of a cell to [0, 1). Deterministic and well mixed (a 32-bit avalanche hash). */
export function cellHash(a: number, l: number, salt = 0): number {
  let h =
    (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(l | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/** Surface slope of the bed at a cell by central differences (unit: degrees). */
export function bedSlopeDeg(g: BlockGrid, a: number, l: number): number {
  const [gx, gy] = gradient(g.bedM, g, a, l);
  return (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI;
}

/** Central-difference gradient of a field at a cell, one-sided at the edge (unit: m per m). */
export function gradient(f: Float32Array, g: BlockGrid, a: number, l: number): [number, number] {
  const at = (x: number, y: number) => f[y * g.across + x]!;
  const a0 = Math.max(0, a - 1);
  const a1 = Math.min(g.across - 1, a + 1);
  const l0 = Math.max(0, l - 1);
  const l1 = Math.min(g.along - 1, l + 1);
  const m = g.metresPerCell;
  return [(at(a1, l) - at(a0, l)) / ((a1 - a0) * m), (at(a, l1) - at(a, l0)) / ((l1 - l0) * m)];
}

/** Bilinear sample of a field at fractional cell coordinates, clamped to the grid. */
export function sampleField(f: Float32Array, g: BlockGrid, a: number, l: number): number {
  const x = Math.min(g.across - 1, Math.max(0, a));
  const y = Math.min(g.along - 1, Math.max(0, l));
  const x0 = Math.min(g.across - 2, Math.floor(x));
  const y0 = Math.min(g.along - 2, Math.floor(y));
  const tx = x - x0;
  const ty = y - y0;
  const at = (i: number, j: number) => f[j * g.across + i]!;
  const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
  const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

export interface SurfaceCover {
  /** 1 where ice-free ground is drawn snow-covered, else 0 (per cell). */
  readonly snow: Float32Array;
  /** 1 where ice-free ground is drawn as meadow, else 0 (per cell). Bare rock elsewhere. */
  readonly meadow: Float32Array;
  /** 1 where the cell carries visible ice. */
  readonly ice: Uint8Array;
}

/** Ground cover per cell from altitude, slope and ice. */
export function surfaceCover(g: BlockGrid, cfg: DressingConfig = DEFAULT_DRESSING): SurfaceCover {
  const n = g.across * g.along;
  const snow = new Float32Array(n);
  const meadow = new Float32Array(n);
  const ice = new Uint8Array(n);
  const sat = (v: number) => Math.min(1, Math.max(0, v));
  // Weights are continuous; the material thresholds them at one half, so cover edges follow smooth
  // iso-lines of altitude and slope instead of stepping from cell to cell.
  for (let l = 0; l < g.along; l++) {
    for (let a = 0; a < g.across; a++) {
      const k = l * g.across + a;
      if (g.iceM[k]! > cfg.iceThresholdM) {
        ice[k] = 1;
        continue;
      }
      const h = g.bedM[k]!;
      const gentle = sat((cfg.bareRockSlopeDeg - smoothSlopeDeg(g, a, l)) / 10 + 0.5);
      snow[k] = sat((h - cfg.snowlineM) / 120 + 0.5) * gentle;
      meadow[k] = sat((cfg.treelineM + 250 - h) / 120 + 0.5) * gentle;
    }
  }
  return { snow, meadow, ice };
}

/** Bed slope averaged over the 3 × 3 neighbourhood: steadier than one cell (unit: degrees). */
export function smoothSlopeDeg(g: BlockGrid, a: number, l: number): number {
  let sum = 0;
  let count = 0;
  for (let dl = -1; dl <= 1; dl++)
    for (let da = -1; da <= 1; da++) {
      const x = a + da;
      const y = l + dl;
      if (x < 0 || y < 0 || x >= g.across || y >= g.along) continue;
      sum += bedSlopeDeg(g, x, y);
      count++;
    }
  return sum / count;
}

export interface TreeSite {
  /** Fractional cell coordinates. */
  readonly a: number;
  readonly l: number;
  /** Ground elevation under the tree (unit: metres). */
  readonly groundM: number;
  /** Relative size (unit: none, about 0.75–1.25). */
  readonly size: number;
}

/**
 * Trees on ice-free, gentle, low ground, away from the ice margin and the river. Rows beyond `lastRow` are
 * skipped (the cut face hides them).
 */
export function treeSites(
  g: BlockGrid,
  cfg: DressingConfig = DEFAULT_DRESSING,
  river: ReadonlySet<number> = new Set(),
  lastRow = g.along - 1,
): TreeSite[] {
  const out: TreeSite[] = [];
  const nearIce = (a: number, l: number) => {
    for (let dl = -2; dl <= 2; dl++)
      for (let da = -2; da <= 2; da++) {
        const x = a + da;
        const y = l + dl;
        if (x < 0 || y < 0 || x >= g.across || y >= g.along) continue;
        if (g.iceM[y * g.across + x]! > cfg.iceThresholdM) return true;
      }
    return false;
  };
  for (let l = 1; l < Math.min(lastRow, g.along - 1); l++) {
    for (let a = 1; a < g.across - 1; a++) {
      const k = l * g.across + a;
      const h = g.bedM[k]!;
      if (h >= cfg.treelineM || river.has(k)) continue;
      // Thin out towards the treeline so the forest edge is ragged rather than a contour line.
      const edge = Math.min(1, (cfg.treelineM - h) / 200);
      if (cellHash(a, l, 1) > cfg.treeDensity * edge) continue;
      if (bedSlopeDeg(g, a, l) > cfg.maxTreeSlopeDeg || nearIce(a, l)) continue;
      const ja = a + (cellHash(a, l, 2) - 0.5) * 0.8;
      const jl = l + (cellHash(a, l, 3) - 0.5) * 0.8;
      out.push({
        a: ja,
        l: jl,
        groundM: sampleField(g.bedM, g, ja, jl),
        size: 0.75 + cellHash(a, l, 4) * 0.5,
      });
    }
  }
  return out;
}

/**
 * The meltwater river: from the cell just below the glacier snout (or from the valley head when there is
 * no ice), follow steepest descent of the bed down the valley to the edge of the grid. Returns cell indices
 * in order. A drawn path only: it routes no water and is not a hydrology model.
 */
export function riverCells(g: BlockGrid, cfg: DressingConfig = DEFAULT_DRESSING): number[] {
  const idx = (a: number, l: number) => l * g.across + a;
  let start = -1;
  // Snout: the most downstream row that still carries ice; start one row below its lowest cell.
  for (let l = g.along - 1; l >= 0 && start < 0; l--) {
    let best = -1;
    for (let a = 0; a < g.across; a++)
      if (g.iceM[idx(a, l)]! > cfg.iceThresholdM && (best < 0 || g.bedM[idx(a, l)]! < g.bedM[idx(best, l)]!))
        best = a;
    if (best >= 0) start = l + 1 < g.along ? idx(best, l + 1) : -2;
  }
  if (start === -2) return [];
  if (start < 0) {
    // No ice: begin at the lowest cell of the second row.
    let best = 0;
    for (let a = 0; a < g.across; a++) if (g.bedM[idx(a, 1)]! < g.bedM[idx(best, 1)]!) best = a;
    start = idx(best, 1);
  }
  const path = [start];
  const seen = new Set(path);
  let k = start;
  for (let guard = 0; guard < g.across * g.along; guard++) {
    const a = k % g.across;
    const l = Math.floor(k / g.across);
    if (l >= g.along - 1 || a <= 0 || a >= g.across - 1) break;
    // Steepest descent among the side and downstream neighbours (never back up the valley, never onto
    // ice). Where nothing descends (a flat, or an overdeepened basin below the snout), take the lowest of
    // the three downstream cells, so the river always leaves the block at its front.
    let next = -1;
    let drop = 0;
    let lowest = -1;
    for (let dl = 0; dl <= 1; dl++)
      for (let da = -1; da <= 1; da++) {
        if (!da && !dl) continue;
        const n = idx(a + da, l + dl);
        if (seen.has(n) || g.iceM[n]! > cfg.iceThresholdM) continue;
        const d = (g.bedM[k]! - g.bedM[n]!) / Math.hypot(da, dl);
        if (d > drop) {
          drop = d;
          next = n;
        }
        if (dl === 1 && (lowest < 0 || g.bedM[n]! < g.bedM[lowest]!)) lowest = n;
      }
    if (next < 0) next = lowest >= 0 ? lowest : idx(a, l + 1);
    if (seen.has(next)) break;
    path.push(next);
    seen.add(next);
    k = next;
  }
  return path;
}

/** Chaikin corner cutting on an open polyline of 2D points (`x0, y0, x1, y1, …`). */
export function smoothPolyline(points: readonly number[], iterations = 2): number[] {
  let p = points.slice();
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
 * Flow marks on the ice: short streaks traced along the modelled ice surface velocity, or, when the
 * snapshot has no velocity, down the ice surface slope (the direction shallow-ice flow takes). Returns
 * polylines in fractional cell coordinates (`a0, l0, a1, l1, …`).
 */
export function iceFlowLines(
  g: BlockGrid,
  cfg: DressingConfig = DEFAULT_DRESSING,
  lastRow = g.along - 1,
): number[][] {
  const surface = new Float32Array(g.bedM.length);
  for (let k = 0; k < surface.length; k++) surface[k] = g.bedM[k]! + g.iceM[k]!;
  const dir = (a: number, l: number): [number, number] | null => {
    if (sampleField(g.iceM, g, a, l) <= cfg.iceThresholdM * 2) return null;
    let vx: number;
    let vy: number;
    if (g.velocity) {
      vx = sampleField(g.velocity.across, g, a, l);
      vy = sampleField(g.velocity.along, g, a, l);
    } else {
      const [gx, gy] = gradient(surface, g, Math.round(a), Math.round(l));
      vx = -gx;
      vy = -gy;
    }
    const len = Math.hypot(vx, vy);
    return len > 1e-9 ? [vx / len, vy / len] : null;
  };
  // Seed one row near the head where the glacier is already wide, at fixed fractions of its width, and
  // trace each streamline to the snout. Long lines that converge and bend with the valley read as flow;
  // breaking them into dashes reads as marks carried by the ice.
  const iceWidth = (l: number) => {
    let lo = -1;
    let hi = -1;
    for (let a = 0; a < g.across; a++)
      if (g.iceM[l * g.across + a]! > cfg.iceThresholdM * 2) {
        if (lo < 0) lo = a;
        hi = a;
      }
    return lo < 0 ? null : ([lo, hi] as const);
  };
  let maxWidth = 0;
  for (let l = 0; l <= lastRow; l++) {
    const w = iceWidth(l);
    if (w) maxWidth = Math.max(maxWidth, w[1] - w[0]);
  }
  let seedRow = -1;
  for (let l = 1; l <= lastRow && seedRow < 0; l++) {
    const w = iceWidth(l);
    if (w && w[1] - w[0] >= maxWidth * 0.55) seedRow = l;
  }
  const lines: number[][] = [];
  if (seedRow < 0 || maxWidth < 2) return lines;
  const [lo, hi] = iceWidth(seedRow)!;
  const stepCells = 0.5;
  const dashOn = 7;
  const dashOff = 4;
  for (const f of [-0.66, -0.33, 0, 0.33, 0.66]) {
    let x = (lo + hi) / 2 + ((hi - lo) / 2) * f;
    let y = seedRow;
    let dash: number[] = [x, y];
    for (let s = 0; s < 1000; s++) {
      const d = dir(x, y);
      if (!d) break;
      x += d[0] * stepCells;
      y += d[1] * stepCells;
      if (y > lastRow) break;
      const phase = s % (dashOn + dashOff);
      if (phase < dashOn) dash.push(x, y);
      else if (dash.length) {
        if (dash.length >= 4) lines.push(dash);
        dash = [];
      }
    }
    if (dash.length >= 4) lines.push(dash);
  }
  return lines;
}

/**
 * Ink hachures on ice-free slopes: on a fixed lattice, a short stroke pointing downslope, longer on
 * steeper ground. Returns segments in fractional cell coordinates (`a0, l0, a1, l1` per stroke).
 */
export function slopeHachures(
  g: BlockGrid,
  cfg: DressingConfig = DEFAULT_DRESSING,
  lastRow = g.along - 1,
  spacing = 3,
): number[] {
  const out: number[] = [];
  for (let l = 1; l < lastRow; l += spacing) {
    for (let a = 1 + (l % (2 * spacing) ? 1 : 0); a < g.across - 1; a += spacing) {
      const k = l * g.across + a;
      if (g.iceM[k]! > cfg.iceThresholdM) continue;
      const [gx, gy] = gradient(g.bedM, g, a, l);
      const s = Math.hypot(gx, gy);
      const deg = (Math.atan(s) * 180) / Math.PI;
      if (deg < 22) continue;
      const len = Math.min(1.5, 0.5 + (deg - 22) / 25) * spacing * 0.5;
      const ux = -gx / s;
      const uy = -gy / s;
      out.push(a, l, a + ux * len, l + uy * len);
    }
  }
  return out;
}
