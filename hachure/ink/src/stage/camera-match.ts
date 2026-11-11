/**
 * Matching a WebGL camera to a DOM page under a CSS 3D tilt.
 *
 * The book element is laid out flat, then tilted with `transform: rotateX(tiltDeg)` about its centre, inside
 * a stage element with `perspective: perspectivePx` and `perspective-origin: 50% 50%`. One canvas covers the
 * stage exactly. A perspective camera at distance `perspectivePx` in front of the stage centre, with the
 * vertical field of view that spans the stage height at that distance, then projects every point exactly
 * as the browser projects the page. So a model standing on the page lines up with the paper under it, and
 * its contact shadow lands on the right words.
 *
 * World units are CSS pixels. World axes: x right, y up, z towards the viewer; the screen plane is z = 0
 * and the stage's top-left corner is the origin (so world y = −CSS y).
 *
 * Page-local axes (used for everything that stands on the page): X right along the page, Y up out of the
 * paper, Z down the page (towards the reader), origin at the book's top-left corner.
 *
 * Pure math; no DOM or three.js, so it is tested in Node against the CSS formula.
 */

export type Vec3 = [number, number, number];

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface StageGeometry {
  /** Stage (and canvas) size (unit: CSS pixels). */
  readonly widthPx: number;
  readonly heightPx: number;
  /** CSS `perspective` of the stage (unit: CSS pixels). */
  readonly perspectivePx: number;
  /** Untransformed layout box of the book in stage coordinates (unit: CSS pixels). */
  readonly book: Rect;
  /** CSS `rotateX` of the book about its centre (unit: degrees). Positive tips the top edge away. */
  readonly tiltDeg: number;
}

/** CSS for the book element; pair with `transform-origin: 50% 50%`. */
export function bookTransformCss(tiltDeg: number): string {
  return `rotateX(${tiltDeg}deg)`;
}

/** A page-local point (X, Y above the paper, Z down the page) in world coordinates. */
export function pageToWorld(g: StageGeometry, X: number, Y: number, Z: number): Vec3 {
  const t = (g.tiltDeg * Math.PI) / 180;
  const cx = g.book.x + g.book.width / 2;
  const cy = -(g.book.y + g.book.height / 2);
  // Untilted world position, relative to the book centre.
  const vx = g.book.x + X - cx;
  const vy = -(g.book.y + Z) - cy;
  const vz = Y;
  // Rotation about the world x axis by −tilt (the same physical rotation as CSS rotateX(+tilt)).
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [cx + vx, cy + vy * c + vz * s, -vy * s + vz * c];
}

/** Column-major 4×4 matrix (three.js `Matrix4.fromArray` order) taking page-local points to world. */
export function pageFrameMatrix(g: StageGeometry): number[] {
  const o = pageToWorld(g, 0, 0, 0);
  const ex = sub(pageToWorld(g, 1, 0, 0), o);
  const ey = sub(pageToWorld(g, 0, 1, 0), o);
  const ez = sub(pageToWorld(g, 0, 0, 1), o);
  return [...ex, 0, ...ey, 0, ...ez, 0, ...o, 1];
}

/** Projects a world point to stage CSS pixels, the way the camera from `stageCamera` does. */
export function worldToStage(g: StageGeometry, w: Vec3): [number, number] {
  const ox = g.widthPx / 2;
  const oy = g.heightPx / 2;
  const k = g.perspectivePx / (g.perspectivePx - w[2]);
  return [ox + (w[0] - ox) * k, oy + (-w[1] - oy) * k];
}

/**
 * Where the browser draws the book point (px, py) (book-local CSS pixels), from the CSS transform and
 * perspective rules alone. Independent of `pageToWorld`; used to test the match.
 */
export function cssProjectBookPoint(g: StageGeometry, px: number, py: number): [number, number] {
  const t = (g.tiltDeg * Math.PI) / 180;
  const oy = g.book.y + g.book.height / 2;
  const vy = g.book.y + py - oy;
  // CSS rotateX matrix (y down, z towards the viewer): y' = y cos t − z sin t, z' = y sin t + z cos t.
  const qx = g.book.x + px;
  const qy = oy + vy * Math.cos(t);
  const qz = vy * Math.sin(t);
  const ex = g.widthPx / 2;
  const ey = g.heightPx / 2;
  const k = g.perspectivePx / (g.perspectivePx - qz);
  return [ex + (qx - ex) * k, ey + (qy - ey) * k];
}

export interface StageCamera {
  readonly position: Vec3;
  readonly target: Vec3;
  /** Vertical field of view (unit: degrees). */
  readonly fovDeg: number;
  readonly aspect: number;
  readonly near: number;
  readonly far: number;
}

/** The perspective camera that sees the stage as the browser does. */
export function stageCamera(g: StageGeometry): StageCamera {
  const P = g.perspectivePx;
  const cx = g.widthPx / 2;
  const cy = -g.heightPx / 2;
  return {
    position: [cx, cy, P],
    target: [cx, cy, 0],
    fovDeg: (2 * Math.atan(g.heightPx / 2 / P) * 180) / Math.PI,
    aspect: g.widthPx / g.heightPx,
    near: P * 0.2,
    far: P * 3,
  };
}

/**
 * Whether a tilted book of this size reads well: the projected book must fit inside the stage with a
 * margin, and text must not be foreshortened below `minScale` at the top edge. Used to choose the flat
 * fallback on short or narrow viewports.
 */
export function tiltedBookFits(g: StageGeometry, marginPx = 8, minScale = 0.72): boolean {
  const corners: [number, number][] = [
    [0, 0],
    [g.book.width, 0],
    [0, g.book.height],
    [g.book.width, g.book.height],
  ];
  for (const [x, y] of corners) {
    const [sx, sy] = cssProjectBookPoint(g, x, y);
    if (sx < marginPx || sy < marginPx || sx > g.widthPx - marginPx || sy > g.heightPx - marginPx)
      return false;
  }
  const [l] = cssProjectBookPoint(g, 0, 0);
  const [r] = cssProjectBookPoint(g, g.book.width, 0);
  return (r - l) / g.book.width >= minScale;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
