/** Renderer-only fixture. No simulated time, erosion, or evolving landforms. */
export const config = { gridSize: 65, metresPerCell: 10, contourIntervalM: 12, indexEvery: 5 };
export type Point = [number, number, number];
export type Segment = { a: Point; b: Point; index: boolean };
export function makeFixture() {
  const n = config.gridSize;
  const heights = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = x / (n - 1),
        v = y / (n - 1);
      heights[y * n + x] =
        35 +
        155 * Math.exp(-((u - 0.4) ** 2 / 0.065 + (v - 0.45) ** 2 / 0.12)) +
        70 * Math.exp(-((u - 0.8) ** 2 / 0.03 + (v - 0.7) ** 2 / 0.06)) +
        15 * v;
    }
  return heights;
}
export function point(h: Float32Array, x: number, y: number): Point {
  return [x / (config.gridSize - 1), y / (config.gridSize - 1), h[y * config.gridSize + x]];
}
/** Contour the exact piecewise-linear mesh; triangle splits resolve saddle ambiguity. */
export function buildGeometry(h: Float32Array) {
  const triangles: number[] = [],
    segments: Segment[] = [];
  const n = config.gridSize;
  for (let y = 0; y < n - 1; y++)
    for (let x = 0; x < n - 1; x++) {
      const a = point(h, x, y),
        b = point(h, x + 1, y),
        c = point(h, x + 1, y + 1),
        d = point(h, x, y + 1);
      for (const tri of [
        [a, b, c],
        [a, c, d],
      ]) {
        triangles.push(...tri.flat());
        const lo = Math.min(...tri.map((p) => p[2])),
          hi = Math.max(...tri.map((p) => p[2]));
        for (
          let level = Math.ceil(lo / config.contourIntervalM) * config.contourIntervalM;
          level < hi;
          level += config.contourIntervalM
        ) {
          const hits: Point[] = [];
          for (let e = 0; e < 3; e++) {
            const p = tri[e],
              q = tri[(e + 1) % 3];
            if ((p[2] <= level && q[2] > level) || (q[2] <= level && p[2] > level)) {
              const t = (level - p[2]) / (q[2] - p[2]);
              hits.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]), level]);
            }
          }
          if (hits.length === 2)
            segments.push({
              a: hits[0],
              b: hits[1],
              index: Math.round(level / config.contourIntervalM) % config.indexEvery === 0,
            });
        }
      }
    }
  return { triangles, segments };
}
/** Shared CPU/GLSL orthographic projection in normalised device coordinates. */
export function project(p: Point, lift: number): [number, number] {
  return [(p[0] - p[1]) * 0.82, (p[0] + p[1] - 1) * 0.44 - 0.2 + (p[2] / 220) * 0.9 * lift];
}
export function svgContours(segments: Segment[]) {
  const paths = segments
    .map(({ a, b, index }) => {
      const p = project(a, 0),
        q = project(b, 0);
      return `<path d="M${(p[0] + 1) * 500} ${(1 - p[1]) * 400}L${(q[0] + 1) * 500} ${(1 - q[1]) * 400}" stroke-width="${index ? 1.65 : 0.9}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 800" role="img" aria-label="Flat contour drawing of a static test surface"><g fill="none" stroke="#292b2c">${paths}</g></svg>`;
}
