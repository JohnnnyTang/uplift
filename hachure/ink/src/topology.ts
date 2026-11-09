/**
 * The shared triangulation. The 3D mesh, contour extraction, hachure placement and surface sampling all
 * call this module, so they agree on which diagonal splits each grid square and therefore on every saddle
 * (D-1C: "contour the exact mesh"). There is no second saddle rule anywhere in the package.
 *
 * Each square between samples `(x, y)`, `(x+1, y)`, `(x, y+1)`, `(x+1, y+1)` is split along one diagonal:
 *
 * - `0` (main, north-west to south-east): joins v00 and v11.
 * - `1` (anti, north-east to south-west): joins v10 and v01.
 *
 * **Rule.** Split along the diagonal whose two end samples differ least in height; a tie takes the main
 * diagonal. A diagonal ridge or valley floor therefore stays one continuous edge instead of being cut into
 * a sawtooth, which keeps channels connected. The rule compares height differences only, so it does not
 * change under the lift (a uniform vertical scale) or a datum shift. In a symmetric saddle (a tie), the
 * main diagonal joins the v00/v11 pair: contours then separate v10 and v01 from each other.
 */
import type { Heightfield } from "./heightfield";

export type Diagonal = 0 | 1;

/** Which diagonal splits a square with these corner heights (see the module comment). */
export function quadDiagonal(h00: number, h10: number, h01: number, h11: number): Diagonal {
  return Math.abs(h00 - h11) <= Math.abs(h10 - h01) ? 0 : 1;
}

/** The diagonal of square `(x, y)` in a heightfield. `x` and `y` run from 0 to `gridSize − 2`. */
export function cellDiagonal(heightfield: Heightfield, x: number, y: number): Diagonal {
  const { gridSize: n, heightsM: h } = heightfield;
  const i = y * n + x;
  return quadDiagonal(h[i]!, h[i + 1]!, h[i + n]!, h[i + n + 1]!);
}

/**
 * Writes the two triangles of square `(x, y)` as six sample indices into `out` at `offset`. Each triangle
 * winds counter-clockwise seen from above (normal pointing up in a y-up, z-south frame).
 */
export function writeQuadTriangles(
  gridSize: number,
  x: number,
  y: number,
  diagonal: Diagonal,
  out: Uint32Array | number[],
  offset: number,
): void {
  const v00 = y * gridSize + x;
  const v10 = v00 + 1;
  const v01 = v00 + gridSize;
  const v11 = v01 + 1;
  if (diagonal === 0) {
    out[offset] = v00;
    out[offset + 1] = v11;
    out[offset + 2] = v10;
    out[offset + 3] = v00;
    out[offset + 4] = v01;
    out[offset + 5] = v11;
  } else {
    out[offset] = v00;
    out[offset + 1] = v01;
    out[offset + 2] = v10;
    out[offset + 3] = v10;
    out[offset + 4] = v01;
    out[offset + 5] = v11;
  }
}

/** Number of triangle indices for a grid: two triangles of three samples per square. */
export function triangleIndexCount(gridSize: number): number {
  return (gridSize - 1) * (gridSize - 1) * 6;
}

/**
 * The full mesh index buffer, square by square in row-major order. Reuses `out` when it has the right
 * length. Contour extraction walks the same triangles in the same order.
 */
export function buildTriangleIndex(heightfield: Heightfield, out?: Uint32Array): Uint32Array {
  const n = heightfield.gridSize;
  const count = triangleIndexCount(n);
  const index = out && out.length === count ? out : new Uint32Array(count);
  let k = 0;
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      writeQuadTriangles(n, x, y, cellDiagonal(heightfield, x, y), index, k);
      k += 6;
    }
  }
  return index;
}

/** Clamps a point to the area covered by samples (unit: metres). */
export function clampToSurface(heightfield: Heightfield, xM: number, yM: number): [number, number] {
  const m = heightfield.metresPerCell;
  const lo = 0.5 * m;
  const hi = (heightfield.gridSize - 0.5) * m;
  return [Math.min(hi, Math.max(lo, xM)), Math.min(hi, Math.max(lo, yM))];
}

/**
 * Height of the triangulated surface at a point (unit: metres). Points outside the sampled area are clamped
 * to its edge. This is exactly the surface the mesh draws.
 */
export function sampleSurface(heightfield: Heightfield, xM: number, yM: number): number {
  const { gridSize: n, metresPerCell: m, heightsM: h } = heightfield;
  const [cx, cy] = clampToSurface(heightfield, xM, yM);
  const gx = cx / m - 0.5;
  const gy = cy / m - 0.5;
  const x = Math.min(n - 2, Math.floor(gx));
  const y = Math.min(n - 2, Math.floor(gy));
  const u = gx - x;
  const v = gy - y;
  const i = y * n + x;
  const h00 = h[i]!;
  const h10 = h[i + 1]!;
  const h01 = h[i + n]!;
  const h11 = h[i + n + 1]!;
  if (quadDiagonal(h00, h10, h01, h11) === 0) {
    return u >= v ? h00 + u * (h10 - h00) + v * (h11 - h10) : h00 + v * (h01 - h00) + u * (h11 - h01);
  }
  return u + v <= 1
    ? h00 + u * (h10 - h00) + v * (h01 - h00)
    : h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11);
}
