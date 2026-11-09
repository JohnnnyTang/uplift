import type { Heightfield } from "../heightfield";
import type { Projection, Vec3 } from "../projection";
import { projectToViewport, worldPosition } from "../projection";
import { cellDiagonal, clampToSurface, sampleSurface, writeQuadTriangles } from "../topology";
import { INK_TOKENS } from "../palette";

/** Ray in the renderer's X-east, Y-up, Z-south world frame (metres). */
export interface TerrainRay {
  readonly origin: Vec3;
  readonly direction: Vec3;
}
export interface TerrainHit {
  readonly xM: number;
  readonly yM: number;
  /** Unexaggerated elevation (metres), even when the drawing is flat. */
  readonly heightM: number;
  readonly column: number;
  readonly row: number;
  readonly distanceM: number;
}

/** Inverse of the shared orthographic projection; pixel coordinates are canvas-local CSS pixels. */
export function rayFromViewport(p: Projection, xPx: number, yPx: number): TerrainRay {
  if (![xPx, yPx].every(Number.isFinite)) throw new RangeError("Pointer coordinates must be finite");
  const x = p.left + (xPx / p.viewport.widthPx) * (p.rightEdge - p.left);
  const y = p.top - (yPx / p.viewport.heightPx) * (p.top - p.bottom);
  return {
    origin: [0, 1, 2].map((i) => p.back[i] * p.distanceM + p.right[i] * x + p.up[i] * y) as unknown as Vec3,
    direction: [-p.back[0], -p.back[1], -p.back[2]],
  };
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Nearest forward triangle hit, using exactly the mesh's saddle rule; no water-surface picking. */
export function pickHeightfield(
  heightfield: Heightfield,
  projection: Projection,
  exaggeration: number,
  ray: TerrainRay,
): TerrainHit | null {
  const { gridSize: n, metresPerCell: m, heightsM } = heightfield;
  if (n !== projection.frame.gridSize || m !== projection.frame.metresPerCell)
    throw new RangeError("Picking needs the same grid and projection as the displayed surface");
  if (!(exaggeration >= 0 && exaggeration <= 1) || ![...ray.origin, ...ray.direction].every(Number.isFinite))
    throw new RangeError("Picking needs a finite ray and lift in [0, 1]");
  const length = Math.hypot(...ray.direction);
  if (!(length > 0)) throw new RangeError("Ray direction must not be zero");
  const direction: Vec3 = [ray.direction[0] / length, ray.direction[1] / length, ray.direction[2] / length];
  const vertices = Array.from({ length: n * n }, (_, i) =>
    worldPosition(projection, ((i % n) + 0.5) * m, (Math.floor(i / n) + 0.5) * m, heightsM[i], exaggeration),
  );
  const indices = new Uint32Array(6);
  let nearest = Infinity;
  let hit: TerrainHit | null = null;
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      writeQuadTriangles(n, x, y, cellDiagonal(heightfield, x, y), indices, 0);
      for (let k = 0; k < 6; k += 3) {
        const a = vertices[indices[k]],
          b = vertices[indices[k + 1]],
          c = vertices[indices[k + 2]];
        const edge1 = sub(b, a),
          edge2 = sub(c, a);
        const h = cross(direction, edge2);
        const det = dot(edge1, h);
        if (Math.abs(det) < 1e-12 * Math.hypot(...edge1) * Math.hypot(...edge2)) continue;
        const s = sub(ray.origin, a);
        const u = dot(s, h) / det;
        if (u < -1e-9 || u > 1 + 1e-9) continue;
        const q = cross(s, edge1);
        const v = dot(direction, q) / det;
        if (v < -1e-9 || u + v > 1 + 1e-9) continue;
        const distanceM = dot(edge2, q) / det;
        if (distanceM < 0 || distanceM >= nearest) continue;
        nearest = distanceM;
        const halfW = (n * m) / 2;
        const [xM, yM] = clampToSurface(
          heightfield,
          ray.origin[0] + direction[0] * distanceM + halfW,
          ray.origin[2] + direction[2] * distanceM + halfW,
        );
        hit = {
          xM,
          yM,
          heightM: sampleSurface(heightfield, xM, yM),
          column: Math.min(n - 1, Math.floor(xM / m)),
          row: Math.min(n - 1, Math.floor(yM / m)),
          distanceM,
        };
      }
    }
  }
  return hit;
}

/** Surface-following ink ring, projected from the same snapshot and lift as the view. */
export function brushCursorPath(
  heightfield: Heightfield,
  projection: Projection,
  exaggeration: number,
  at: { readonly xM: number; readonly yM: number },
  radiusM: number,
): string {
  if (
    ![at.xM, at.yM, radiusM, exaggeration].every(Number.isFinite) ||
    radiusM <= 0 ||
    exaggeration < 0 ||
    exaggeration > 1
  )
    throw new RangeError("Cursor needs a finite centre, positive radius and lift in [0, 1]");
  const segments = 64;
  const points: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i * Math.PI * 2) / segments;
    const [x, y] = clampToSurface(
      heightfield,
      at.xM + radiusM * Math.cos(angle),
      at.yM + radiusM * Math.sin(angle),
    );
    const [px, py] = projectToViewport(projection, x, y, sampleSurface(heightfield, x, y), exaggeration);
    points.push(`${i ? "L" : "M"}${px.toFixed(3)},${py.toFixed(3)}`);
  }
  return points.join(" ") + " Z";
}

/** Non-interactive SVG overlay. Mount over the canvas; host refreshes after view/cursor changes. */
export function createBrushCursorOverlay() {
  const ns = "http://www.w3.org/2000/svg";
  const root = document.createElementNS(ns, "svg");
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden";
  const path = document.createElementNS(ns, "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", INK_TOKENS.ink);
  path.setAttribute("stroke-width", "2");
  path.setAttribute("vector-effect", "non-scaling-stroke");
  root.append(path);
  return {
    root,
    update(
      heightfield: Heightfield,
      projection: Projection,
      exaggeration: number,
      at: { readonly xM: number; readonly yM: number },
      radiusM: number,
    ) {
      root.setAttribute("viewBox", `0 0 ${projection.viewport.widthPx} ${projection.viewport.heightPx}`);
      path.setAttribute("d", brushCursorPath(heightfield, projection, exaggeration, at, radiusM));
    },
    setVisible(visible: boolean) {
      root.style.display = visible ? "" : "none";
    },
    dispose() {
      root.remove();
    },
  };
}
