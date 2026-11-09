/**
 * The one orthographic projection shared by the flat SVG drawing and the 3D view.
 *
 * The page paints the SVG first (tension T8); the 3D canvas then crossfades in at zero exaggeration and
 * must land on the same pixels. Both sides call `createProjection` with the same frame, pose, viewport and
 * relief scale: the SVG projects points with `projectToViewport`, the 3D view builds its camera from the
 * same basis and bounds (tested against three's `OrthographicCamera`). The camera stays fixed during the
 * lift; only the vertical scale changes, so the frame is fitted to the fully lifted terrain in advance.
 *
 * World frame (metres): X east, Y up, Z south, origin at the centre of the sampled square.
 * `X = xM − W/2`, `Y = (h − datum) × reliefScale × exaggeration`, `Z = yM − W/2`, `W = gridSize × m`.
 */
import type { Heightfield } from "./heightfield";
import { heightRange } from "./heightfield";

export type Vec3 = readonly [number, number, number];

export interface CameraPose {
  /** Compass bearing the camera looks towards: 0 looks north, 90 looks east (unit: degrees). */
  readonly azimuthDeg: number;
  /** Angle of the view above the horizon: 90 looks straight down (unit: degrees). */
  readonly elevationDeg: number;
  /** Magnification relative to fitting the lifted terrain in the viewport (unit: none; 1 = fit). */
  readonly zoom: number;
}

/** Looking north from the south, 50° above the horizon, fitted. */
export const DEFAULT_CAMERA_POSE: CameraPose = Object.freeze({ azimuthDeg: 0, elevationDeg: 50, zoom: 1 });

/** Pose limits. Elevation stays below 90° so the lift remains visible; zoom stays readable. */
export const CAMERA_LIMITS = Object.freeze({
  elevationDeg: Object.freeze([15, 89] as const),
  zoom: Object.freeze([0.25, 8] as const),
});

/**
 * What the projection is fitted to. Fixed for a scene: the datum and relief come from the starting
 * heightfield, so the frame does not jump while erosion changes the surface.
 */
export interface TerrainFrame {
  /** Samples per side (unit: cells). */
  readonly gridSize: number;
  /** Sample spacing (unit: metres). */
  readonly metresPerCell: number;
  /** Elevation drawn at the base of the lift (unit: metres). */
  readonly datumM: number;
  /** Relief above the datum that the frame leaves room for at full lift (unit: metres). */
  readonly reliefM: number;
}

export interface Viewport {
  /** Width of the drawing in CSS pixels. */
  readonly widthPx: number;
  /** Height of the drawing in CSS pixels. */
  readonly heightPx: number;
}

export interface Projection {
  readonly pose: CameraPose;
  readonly frame: TerrainFrame;
  readonly viewport: Viewport;
  /** Vertical scale at full lift (unit: none; 1 = true scale). */
  readonly reliefScale: number;
  /** Camera basis in world coordinates: screen right, screen up, and towards the camera. */
  readonly right: Vec3;
  readonly up: Vec3;
  readonly back: Vec3;
  /** Orthographic bounds in view coordinates (unit: metres). */
  readonly left: number;
  readonly rightEdge: number;
  readonly top: number;
  readonly bottom: number;
  /** Camera distance from the origin along `back`, and clip planes (unit: metres). */
  readonly distanceM: number;
  readonly near: number;
  readonly far: number;
}

/** Fitting margin around the terrain (unit: none; fraction of the fitted half-extent). */
const FIT_MARGIN = 1.06;

/** A frame from a heightfield: datum at its lowest sample, room for its full relief. */
export function terrainFrameFromHeightfield(heightfield: Heightfield): TerrainFrame {
  const { minM, maxM } = heightRange(heightfield);
  return {
    gridSize: heightfield.gridSize,
    metresPerCell: heightfield.metresPerCell,
    datumM: Number.isFinite(minM) ? minM : 0,
    reliefM: Number.isFinite(maxM - minM) ? maxM - minM : 0,
  };
}

/** Clamps a pose to `CAMERA_LIMITS` and fills missing fields from the default. */
export function resolveCameraPose(pose: Partial<CameraPose> = {}): CameraPose {
  const p = { ...DEFAULT_CAMERA_POSE, ...pose };
  const [eLo, eHi] = CAMERA_LIMITS.elevationDeg;
  const [zLo, zHi] = CAMERA_LIMITS.zoom;
  const finite = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
  return Object.freeze({
    azimuthDeg: ((finite(p.azimuthDeg, 0) % 360) + 360) % 360,
    elevationDeg: Math.min(eHi, Math.max(eLo, finite(p.elevationDeg, DEFAULT_CAMERA_POSE.elevationDeg))),
    zoom: Math.min(zHi, Math.max(zLo, finite(p.zoom, 1))),
  });
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Builds the shared projection. Pure; the same inputs always give the same projection. */
export function createProjection(
  frame: TerrainFrame,
  pose: Partial<CameraPose>,
  viewport: Viewport,
  reliefScale = 1,
): Projection {
  if (!(viewport.widthPx > 0 && viewport.heightPx > 0)) {
    throw new RangeError("viewport must have a positive width and height");
  }
  if (!(Number.isFinite(reliefScale) && reliefScale >= 0)) {
    throw new RangeError("reliefScale must be a non-negative number");
  }
  const resolved = resolveCameraPose(pose);
  const az = (resolved.azimuthDeg * Math.PI) / 180;
  const el = (resolved.elevationDeg * Math.PI) / 180;
  // Towards the camera; the camera looks along −back. Matches three's Matrix4.lookAt with up = +Y.
  const back: Vec3 = [-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
  const rLen = Math.hypot(back[2], back[0]);
  const right: Vec3 = [back[2] / rLen, 0, -back[0] / rLen]; // normalize(up × back)
  const up: Vec3 = [
    back[1] * right[2] - back[2] * right[1],
    back[2] * right[0] - back[0] * right[2],
    back[0] * right[1] - back[1] * right[0],
  ]; // back × right

  const halfW = (frame.gridSize * frame.metresPerCell) / 2;
  const sampleHalf = halfW - frame.metresPerCell / 2;
  const topY = Math.max(0, frame.reliefM) * reliefScale;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const cx of [-sampleHalf, sampleHalf]) {
    for (const cz of [-sampleHalf, sampleHalf]) {
      for (const cy of [0, topY]) {
        const p: Vec3 = [cx, cy, cz];
        const sx = dot(p, right);
        const sy = dot(p, up);
        minX = Math.min(minX, sx);
        maxX = Math.max(maxX, sx);
        minY = Math.min(minY, sy);
        maxY = Math.max(maxY, sy);
      }
    }
  }
  const aspect = viewport.widthPx / viewport.heightPx;
  const halfHeight = (Math.max((maxY - minY) / 2, (maxX - minX) / 2 / aspect) * FIT_MARGIN) / resolved.zoom;
  const halfWidth = halfHeight * aspect;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const radius = Math.hypot(sampleHalf * Math.SQRT2, topY) + frame.metresPerCell;
  const distanceM = 3 * radius;
  return Object.freeze({
    pose: resolved,
    frame,
    viewport: { widthPx: viewport.widthPx, heightPx: viewport.heightPx },
    reliefScale,
    right,
    up,
    back,
    left: cx - halfWidth,
    rightEdge: cx + halfWidth,
    top: cy + halfHeight,
    bottom: cy - halfHeight,
    distanceM,
    near: distanceM - 2 * radius,
    far: distanceM + 2 * radius,
  });
}

/** World position of a terrain point at a given exaggeration (0 = flat, 1 = full relief). */
export function worldPosition(
  projection: Projection,
  xM: number,
  yM: number,
  hM: number,
  exaggeration: number,
): Vec3 {
  const { frame, reliefScale } = projection;
  const halfW = (frame.gridSize * frame.metresPerCell) / 2;
  return [xM - halfW, (hM - frame.datumM) * reliefScale * exaggeration, yM - halfW];
}

/** Viewport position (CSS pixels, origin top left) of a terrain point at a given exaggeration. */
export function projectToViewport(
  projection: Projection,
  xM: number,
  yM: number,
  hM: number,
  exaggeration: number,
): [number, number] {
  const p = worldPosition(projection, xM, yM, hM, exaggeration);
  const sx = dot(p, projection.right);
  const sy = dot(p, projection.up);
  const { left, rightEdge, top, bottom, viewport } = projection;
  return [
    ((sx - left) / (rightEdge - left)) * viewport.widthPx,
    ((top - sy) / (top - bottom)) * viewport.heightPx,
  ];
}
