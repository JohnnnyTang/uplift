/**
 * Contour extraction from a heightfield: the flat page drawing (AC5) and the 3D contour lines both come
 * from here.
 *
 * Method: marching triangles over the shared triangulation (`topology.ts`), then joining segments into
 * polylines. Each grid square is split by `cellDiagonal`, exactly as the mesh is, so every saddle is
 * resolved the way the rendered surface resolves it. The contour at level L is then the exact L-isoline of
 * the surface the mesh draws, at every exaggeration (D-1C).
 *
 * Classification is half-open: a sample is "below" when `h ≤ L` and "above" when `h > L`. A triangle
 * therefore has either zero or two crossing edges, and a level exactly equal to the maximum is not drawn.
 * Segments are joined through the mesh edge they cross, so joining is topological, not by comparing
 * floating-point coordinates.
 */
import type { Heightfield } from "./heightfield";
import { cellDiagonal, writeQuadTriangles } from "./topology";

export interface ContourOptions {
  /** Every `indexEvery`-th level (counting from 0 m) is an index contour, drawn heavier. Default 5. */
  readonly indexEvery?: number;
}

export interface ContourLine {
  /** Elevation of this line (unit: metres). */
  readonly levelM: number;
  /** Level number: `levelM = levelIndex × intervalM`. */
  readonly levelIndex: number;
  /** Is this an index contour? */
  readonly index: boolean;
  /** Closed ring (true) or an open line that ends on the grid edge (false). */
  readonly closed: boolean;
  /**
   * Vertices as `x0, y0, x1, y1, …` in metres from the north-west corner. A closed ring does not repeat its
   * first vertex.
   */
  readonly pointsM: Float64Array;
}

export interface ContourSet {
  /** Vertical distance between contour levels (unit: metres). */
  readonly intervalM: number;
  readonly indexEvery: number;
  readonly gridSize: number;
  /** Sample spacing of the source heightfield (unit: metres). */
  readonly metresPerCell: number;
  /** Lines sorted by level, then by the order they were found (deterministic). */
  readonly lines: readonly ContourLine[];
}

interface LevelBucket {
  /** Two edge keys per segment. */
  readonly keys: number[];
  /** Four coordinates per segment: the point on the first edge, then on the second. */
  readonly coords: number[];
}

/** Extracts contour polylines every `intervalM` metres. Pure: the heightfield is not modified. */
export function extractContours(
  heightfield: Heightfield,
  intervalM: number,
  options: ContourOptions = {},
): ContourSet {
  if (!(Number.isFinite(intervalM) && intervalM > 0)) {
    throw new RangeError(`contour interval must be a positive number of metres, got ${intervalM}`);
  }
  const indexEvery = options.indexEvery ?? 5;
  if (!(Number.isInteger(indexEvery) && indexEvery >= 1)) {
    throw new RangeError(`indexEvery must be a positive integer, got ${indexEvery}`);
  }
  const { gridSize: n, metresPerCell: m, heightsM: h } = heightfield;
  const vertexCount = n * n;
  const buckets = new Map<number, LevelBucket>();
  const tri = new Uint32Array(6);
  const crossKeys = [0, 0];
  const crossCoords = [0, 0, 0, 0];

  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      writeQuadTriangles(n, x, y, cellDiagonal(heightfield, x, y), tri, 0);
      for (let t = 0; t < 6; t += 3) {
        const a = tri[t]!;
        const b = tri[t + 1]!;
        const c = tri[t + 2]!;
        const ha = h[a]!;
        const hb = h[b]!;
        const hc = h[c]!;
        if (!(Number.isFinite(ha) && Number.isFinite(hb) && Number.isFinite(hc))) continue;
        const lo = Math.min(ha, hb, hc);
        const hi = Math.max(ha, hb, hc);
        // Levels L = k·interval with lo ≤ L < hi cross this triangle.
        for (let k = Math.ceil(lo / intervalM); k * intervalM < hi; k++) {
          const level = k * intervalM;
          let found = 0;
          for (let e = 0; e < 3; e++) {
            const e0 = e === 0 ? a : e === 1 ? b : c;
            const e1 = e === 0 ? b : e === 1 ? c : a;
            // Interpolate from the lower sample index, so both triangles sharing this edge compute the
            // bitwise-identical crossing point.
            const p = e0 < e1 ? e0 : e1;
            const q = e0 < e1 ? e1 : e0;
            const hp = h[p]!;
            const hq = h[q]!;
            if (hp <= level === hq <= level) continue;
            const s = (level - hp) / (hq - hp);
            const px = (p % n) + 0.5;
            const py = Math.floor(p / n) + 0.5;
            const qx = (q % n) + 0.5;
            const qy = Math.floor(q / n) + 0.5;
            crossKeys[found] = p * vertexCount + q;
            crossCoords[found * 2] = (px + s * (qx - px)) * m;
            crossCoords[found * 2 + 1] = (py + s * (qy - py)) * m;
            found++;
          }
          if (found !== 2) continue; // Unreachable with half-open classification; kept as a guard.
          let bucket = buckets.get(k);
          if (!bucket) {
            bucket = { keys: [], coords: [] };
            buckets.set(k, bucket);
          }
          bucket.keys.push(crossKeys[0]!, crossKeys[1]!);
          bucket.coords.push(crossCoords[0]!, crossCoords[1]!, crossCoords[2]!, crossCoords[3]!);
        }
      }
    }
  }

  const lines: ContourLine[] = [];
  const levels = [...buckets.keys()].sort((p, q) => p - q);
  for (const k of levels) {
    const index = ((k % indexEvery) + indexEvery) % indexEvery === 0;
    for (const line of joinSegments(buckets.get(k)!)) {
      lines.push({ levelM: k * intervalM, levelIndex: k, index, ...line });
    }
  }
  return { intervalM, indexEvery, gridSize: n, metresPerCell: m, lines };
}

/**
 * Joins segments that share a mesh edge into polylines. Every interior edge is crossed by exactly two
 * segments (one per adjacent triangle) and every grid-boundary edge by one, so walks from boundary ends
 * give the open lines and the remaining segments form closed rings.
 */
function joinSegments(bucket: LevelBucket): { closed: boolean; pointsM: Float64Array }[] {
  const { keys, coords } = bucket;
  const segmentCount = keys.length / 2;
  // Edge key → up to two segment ends, encoded as segment × 2 + end.
  const first = new Map<number, number>();
  const second = new Map<number, number>();
  for (let end = 0; end < keys.length; end++) {
    const key = keys[end]!;
    if (first.has(key)) second.set(key, end);
    else first.set(key, end);
  }
  const partner = (end: number): number => {
    const key = keys[end]!;
    const f = first.get(key)!;
    return f === end ? (second.get(key) ?? -1) : f;
  };
  const used = new Uint8Array(segmentCount);
  const out: { closed: boolean; pointsM: Float64Array }[] = [];

  const walk = (startEnd: number, closed: boolean): void => {
    const points: number[] = [];
    const push = (end: number): void => {
      const x = coords[end * 2]!;
      const y = coords[end * 2 + 1]!;
      const len = points.length;
      if (len >= 2 && points[len - 2] === x && points[len - 1] === y) return;
      points.push(x, y);
    };
    let end = startEnd;
    push(end);
    for (;;) {
      const segment = end >> 1;
      used[segment] = 1;
      const exit = end ^ 1;
      const next = partner(exit);
      if (next < 0) {
        push(exit); // Open line reaches the grid edge.
        break;
      }
      if (used[next >> 1]) {
        if (!closed) push(exit);
        break; // A ring has come back to its start.
      }
      push(exit);
      end = next;
    }
    if (closed && points.length >= 4) {
      const len = points.length;
      if (points[0] === points[len - 2] && points[1] === points[len - 1]) points.length = len - 2;
    }
    if (points.length >= 4) out.push({ closed, pointsM: Float64Array.from(points) });
  };

  for (let end = 0; end < keys.length; end++) {
    if (!used[end >> 1] && partner(end) < 0) walk(end, false);
  }
  for (let segment = 0; segment < segmentCount; segment++) {
    if (!used[segment]) walk(segment * 2, true);
  }
  return out;
}

/**
 * Smallest gap between drawn vertices (unit: cells). Crossings close to a sample produce vertices a few
 * thousandths of a cell apart; these segments are far below a pixel, and their screen direction is
 * dominated by float32 rounding in the stroke shader. Both the SVG and the 3D strokes drop them, so the
 * two drawings keep identical vertices.
 */
export const DRAW_MIN_SPACING_CELLS = 0.05;

/**
 * The vertices of a contour line as drawn: consecutive vertices closer than `minSpacingM` are merged into
 * the earlier one. Open lines keep both end points (they sit on the grid edge). Every kept vertex is an
 * exact contour vertex, so it still lies on the mesh at the line's level.
 */
export function drawnPoints(line: ContourLine, minSpacingM: number): Float64Array {
  const p = line.pointsM;
  const count = p.length / 2;
  if (count <= 2 || !(minSpacingM > 0)) return p;
  const min2 = minSpacingM * minSpacingM;
  const out: number[] = [p[0]!, p[1]!];
  const last = count - 1;
  for (let i = 1; i < count; i++) {
    const x = p[i * 2]!;
    const y = p[i * 2 + 1]!;
    const k = out.length;
    const near = (x - out[k - 2]!) ** 2 + (y - out[k - 1]!) ** 2 < min2;
    if (!near) out.push(x, y);
    else if (i === last && !line.closed) {
      // Keep the true end point on the grid edge; drop the interior vertex it replaces.
      if (k > 2) out.length = k - 2;
      out.push(x, y);
    }
  }
  if (line.closed && out.length > 6) {
    const k = out.length;
    if ((out[k - 2]! - out[0]!) ** 2 + (out[k - 1]! - out[1]!) ** 2 < min2) out.length = k - 2;
  }
  return Float64Array.from(out);
}

/** Total number of line segments in a contour set (an open line of p points has p − 1). */
export function contourSegmentCount(contours: ContourSet): number {
  let count = 0;
  for (const line of contours.lines) {
    const points = line.pointsM.length / 2;
    count += line.closed ? points : points - 1;
  }
  return count;
}
