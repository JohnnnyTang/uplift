import { describe, expect, it } from "vitest";
import {
  type StageGeometry,
  bookTransformCss,
  cssProjectBookPoint,
  pageFrameMatrix,
  pageToWorld,
  stageCamera,
  tiltedBookFits,
  worldToStage,
} from "./camera-match";

const stage: StageGeometry = {
  widthPx: 1440,
  heightPx: 900,
  perspectivePx: 1800,
  book: { x: 158, y: 102, width: 1123, height: 693 },
  tiltDeg: 46,
};

/** Applies a column-major 4×4 matrix to a point. */
function apply(m: number[], p: [number, number, number]): [number, number, number] {
  return [
    m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!,
    m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!,
    m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2] + m[14]!,
  ];
}

describe("camera matched to a CSS-tilted page", () => {
  it("projects every page point exactly where the browser draws it", () => {
    for (const [x, y] of [
      [0, 0],
      [stage.book.width, 0],
      [0, stage.book.height],
      [stage.book.width, stage.book.height],
      [700, 300],
      [stage.book.width / 2, stage.book.height / 2],
    ] as const) {
      const css = cssProjectBookPoint(stage, x, y);
      const gl = worldToStage(stage, pageToWorld(stage, x, 0, y));
      expect(gl[0]).toBeCloseTo(css[0], 6);
      expect(gl[1]).toBeCloseTo(css[1], 6);
    }
  });

  it("matches with no tilt as the identity placement", () => {
    const flat = { ...stage, tiltDeg: 0 };
    const [sx, sy] = worldToStage(flat, pageToWorld(flat, 10, 0, 20));
    expect(sx).toBeCloseTo(stage.book.x + 10, 9);
    expect(sy).toBeCloseTo(stage.book.y + 20, 9);
  });

  it("tips the top edge away from the viewer and lifts 'up' off the paper towards the top", () => {
    const top = pageToWorld(stage, 0, 0, 0);
    const bottom = pageToWorld(stage, 0, 0, stage.book.height);
    expect(top[2]).toBeLessThan(0);
    expect(bottom[2]).toBeGreaterThan(0);
    const up = pageToWorld(stage, 100, 50, 100);
    const base = pageToWorld(stage, 100, 0, 100);
    const t = (stage.tiltDeg * Math.PI) / 180;
    expect((up[1] - base[1]) / 50).toBeCloseTo(Math.sin(t), 9);
    expect((up[2] - base[2]) / 50).toBeCloseTo(Math.cos(t), 9);
  });

  it("frame matrix equals the point mapping", () => {
    const m = pageFrameMatrix(stage);
    const p: [number, number, number] = [321, 45, 210];
    const a = apply(m, p);
    const b = pageToWorld(stage, ...p);
    for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i]!, 6);
  });

  it("camera field of view spans the stage height at the perspective distance", () => {
    const cam = stageCamera(stage);
    const halfH = Math.tan(((cam.fovDeg / 2) * Math.PI) / 180) * stage.perspectivePx;
    expect(halfH).toBeCloseTo(stage.heightPx / 2, 6);
    expect(cam.aspect).toBeCloseTo(stage.widthPx / stage.heightPx, 9);
    expect(cam.position[2]).toBe(stage.perspectivePx);
    expect(bookTransformCss(46)).toBe("rotateX(46deg)");
  });

  it("refuses the tilt when the book would leave the stage", () => {
    expect(tiltedBookFits(stage)).toBe(true);
    expect(tiltedBookFits({ ...stage, book: { x: 0, y: 0, width: 1440, height: 900 } })).toBe(false);
  });
});
