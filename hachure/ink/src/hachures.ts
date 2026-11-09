/**
 * Hachures, the engine's namesake: short ink strokes along the fall line (steepest descent), denser and
 * longer on steeper ground (D-1C: sparse downslope hachures on a fixed lattice).
 *
 * Placement is a fixed lattice, so it is deterministic and does not shimmer as the terrain changes. Stroke
 * end points are lifted onto the triangulated surface (`sampleSurface`), so strokes lie on the mesh at every
 * exaggeration. Slope comes from central differences of the samples, which is smoother than the gradient
 * of a single triangle.
 */
import type { Heightfield } from "./heightfield";
import { clampToSurface, sampleSurface } from "./topology";

export interface HachureOptions {
  /** Lattice spacing (unit: cells). Default 3. */
  readonly spacingCells?: number;
  /** Below this slope, no hachure (unit: degrees). Default 3. */
  readonly minSlopeDeg?: number;
  /** From this slope on, every lattice point gets a hachure; below it, every other one (unit: degrees). */
  readonly denseSlopeDeg?: number;
  /** Slope at which strokes reach their longest (unit: degrees). Default 35. */
  readonly fullSlopeDeg?: number;
  /** Stroke length at `minSlopeDeg` and at `fullSlopeDeg`, as a fraction of the spacing. */
  readonly lengthFraction?: readonly [number, number];
}

export const DEFAULT_HACHURE_OPTIONS = Object.freeze({
  spacingCells: 3,
  minSlopeDeg: 3,
  denseSlopeDeg: 10,
  fullSlopeDeg: 35,
  lengthFraction: Object.freeze([0.6, 1] as const),
});

/** Stroke list: six numbers per stroke, `x0, y0, h0, x1, y1, h1` (unit: metres), upslope end first. */
export interface HachureSet {
  readonly strokesM: Float64Array;
  readonly count: number;
}

/** Slope of the samples at `(x, y)` by central differences, one-sided at the grid edge (unit: m per m). */
export function sampleGradient(heightfield: Heightfield, x: number, y: number): [number, number] {
  const { gridSize: n, metresPerCell: m, heightsM: h } = heightfield;
  const x0 = Math.max(0, x - 1);
  const x1 = Math.min(n - 1, x + 1);
  const y0 = Math.max(0, y - 1);
  const y1 = Math.min(n - 1, y + 1);
  const gx = (h[y * n + x1]! - h[y * n + x0]!) / ((x1 - x0) * m);
  const gy = (h[y1 * n + x]! - h[y0 * n + x]!) / ((y1 - y0) * m);
  return [gx, gy];
}

/** Places hachures on a heightfield. Pure and deterministic. */
export function extractHachures(heightfield: Heightfield, options: HachureOptions = {}): HachureSet {
  const o = { ...DEFAULT_HACHURE_OPTIONS, ...options };
  const spacing = Math.max(1, Math.round(o.spacingCells));
  const { gridSize: n, metresPerCell: m } = heightfield;
  const tanMin = Math.tan((o.minSlopeDeg * Math.PI) / 180);
  const tanDense = Math.tan((o.denseSlopeDeg * Math.PI) / 180);
  const [fracLo, fracHi] = o.lengthFraction;
  const out: number[] = [];
  const offset = Math.floor(spacing / 2);
  for (let j = 0, y = offset; y < n; j++, y += spacing) {
    for (let i = 0, x = offset; x < n; i++, x += spacing) {
      const [gx, gy] = sampleGradient(heightfield, x, y);
      const tan = Math.hypot(gx, gy);
      if (!(tan >= tanMin)) continue;
      if (tan < tanDense && (i + j) % 2 === 1) continue;
      const slopeDeg = (Math.atan(tan) * 180) / Math.PI;
      const t = Math.min(1, Math.max(0, (slopeDeg - o.minSlopeDeg) / (o.fullSlopeDeg - o.minSlopeDeg)));
      const half = (spacing * m * (fracLo + (fracHi - fracLo) * t)) / 2;
      const dx = -gx / tan;
      const dy = -gy / tan;
      const cx = (x + 0.5) * m;
      const cy = (y + 0.5) * m;
      const [ax, ay] = clampToSurface(heightfield, cx - dx * half, cy - dy * half);
      const [bx, by] = clampToSurface(heightfield, cx + dx * half, cy + dy * half);
      out.push(ax, ay, sampleSurface(heightfield, ax, ay), bx, by, sampleSurface(heightfield, bx, by));
    }
  }
  return { strokesM: Float64Array.from(out), count: out.length / 6 };
}
