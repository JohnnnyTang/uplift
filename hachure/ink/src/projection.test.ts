import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  type TerrainFrame,
  createProjection,
  projectToViewport,
  resolveCameraPose,
  terrainFrameFromHeightfield,
  worldPosition,
} from "./projection";
import { heightfieldFromFunction } from "./heightfield";
import { cameraFromProjection as cameraFor } from "./view/camera";

const frame: TerrainFrame = { gridSize: 64, metresPerCell: 10, datumM: 20, reliefM: 80 };
const viewport = { widthPx: 800, heightPx: 560 };

describe("shared orthographic projection", () => {
  it("matches three's OrthographicCamera for every pose and exaggeration", () => {
    const poses = [
      { azimuthDeg: 0, elevationDeg: 50, zoom: 1 },
      { azimuthDeg: 45, elevationDeg: 35, zoom: 1.4 },
      { azimuthDeg: 210, elevationDeg: 80, zoom: 0.7 },
    ];
    for (const pose of poses) {
      for (const reliefScale of [1, 3]) {
        const p = createProjection(frame, pose, viewport, reliefScale);
        const camera = cameraFor(p);
        for (const [x, y, h] of [
          [5, 5, 20],
          [635, 5, 100],
          [320, 400, 60],
          [600, 630, 35],
        ] as const) {
          for (const e of [0, 0.5, 1]) {
            const [wx, wy, wz] = worldPosition(p, x, y, h, e);
            const ndc = new Vector3(wx, wy, wz).project(camera);
            const [px, py] = projectToViewport(p, x, y, h, e);
            expect(px).toBeCloseTo(((ndc.x + 1) / 2) * viewport.widthPx, 6);
            expect(py).toBeCloseTo(((1 - ndc.y) / 2) * viewport.heightPx, 6);
            // Inside the clip volume (three's WebGL convention, z in [−1, 1]).
            expect(Math.abs(ndc.z)).toBeLessThan(1);
          }
        }
      }
    }
  });

  it("ignores height at zero exaggeration (the flat drawing)", () => {
    const p = createProjection(frame, {}, viewport, 2);
    expect(projectToViewport(p, 100, 200, 20, 0)).toEqual(projectToViewport(p, 100, 200, 95, 0));
    expect(projectToViewport(p, 100, 200, 95, 1)).not.toEqual(projectToViewport(p, 100, 200, 95, 0));
  });

  it("keeps the terrain inside the viewport throughout the lift, so the camera never moves", () => {
    for (const pose of [{}, { azimuthDeg: 45, elevationDeg: 25 }, { elevationDeg: 89 }]) {
      const p = createProjection(frame, pose, viewport, 2);
      const lo = 5;
      const hi = 635;
      for (const e of [0, 0.25, 0.5, 1]) {
        for (const [x, y] of [
          [lo, lo],
          [hi, lo],
          [lo, hi],
          [hi, hi],
        ] as const) {
          for (const h of [frame.datumM, frame.datumM + frame.reliefM]) {
            const [px, py] = projectToViewport(p, x, y, h, e);
            expect(px).toBeGreaterThanOrEqual(0);
            expect(px).toBeLessThanOrEqual(viewport.widthPx);
            expect(py).toBeGreaterThanOrEqual(0);
            expect(py).toBeLessThanOrEqual(viewport.heightPx);
          }
        }
      }
    }
  });

  it("looks north by default: east is to the right, north is up the page", () => {
    const p = createProjection(frame, {}, viewport);
    const [wx] = projectToViewport(p, 10, 300, 20, 0);
    const [ex] = projectToViewport(p, 600, 300, 20, 0);
    const [, ny] = projectToViewport(p, 300, 10, 20, 0);
    const [, sy] = projectToViewport(p, 300, 600, 20, 0);
    expect(ex).toBeGreaterThan(wx);
    expect(ny).toBeLessThan(sy);
  });

  it("clamps poses and rejects empty viewports", () => {
    expect(resolveCameraPose({ elevationDeg: 120, zoom: 100, azimuthDeg: -90 })).toEqual({
      azimuthDeg: 270,
      elevationDeg: 89,
      zoom: 8,
    });
    expect(() => createProjection(frame, {}, { widthPx: 0, heightPx: 10 })).toThrow(RangeError);
  });

  it("takes its datum and relief from the heightfield", () => {
    const hf = heightfieldFromFunction(8, 2, (x) => 100 + x);
    const f = terrainFrameFromHeightfield(hf);
    expect(f.datumM).toBe(101);
    expect(f.reliefM).toBe(14);
    expect(f.gridSize).toBe(8);
  });
});
