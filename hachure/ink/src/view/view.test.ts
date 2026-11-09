import { createFakeSolver } from "@hachure/terrain/testing";
import type { InstancedBufferAttribute } from "three";
import { describe, expect, it } from "vitest";
import { extractContours } from "../contours";
import { heightfieldFromFunction } from "../heightfield";
import { FLAT_STATE, LIFTED_STATE } from "../lift";
import { buildTriangleIndex } from "../topology";
import { INK_VIEW_LAYERS, createInkView } from "./ink-view";
import { StrokeBuffer, StrokeLayer, TerrainMesh } from "./layers";
import { createInkUniforms, createStrokeMaterial, createTerrainMaterial } from "./materials";
import { DEFAULT_CHANNELS } from "../palette";

describe("stroke packing", () => {
  it("gives closed rings wrapped neighbours and open lines their own ends as neighbours", () => {
    const strokes = new StrokeBuffer();
    // A closed square and an open three-point line.
    strokes.pushPolyline([0, 0, 1, 10, 0, 1, 10, 10, 1, 0, 10, 1], true, 1);
    strokes.pushPolyline([0, 0, 2, 5, 0, 2, 9, 3, 2], false, 2);
    expect(strokes.count).toBe(4 + 2);
    const v = (name: keyof StrokeBuffer["data"], i: number) =>
      Array.from(strokes.data[name].subarray(i * 3, i * 3 + 3));
    // Ring segment 0 runs (0,0)→(10,0); its neighbours wrap to (0,10) and (10,10).
    expect(v("segPrev", 0)).toEqual([0, 10, 1]);
    expect(v("segNext", 0)).toEqual([10, 10, 1]);
    // Open line: the first segment's previous point is its own start; the last segment's next is its end.
    expect(v("segPrev", 4)).toEqual(v("segStart", 4));
    expect(v("segNext", 5)).toEqual(v("segEnd", 5));
    expect(v("segNext", 4)).toEqual([9, 3, 2]);
    expect(Array.from(strokes.data.segWidth.subarray(0, 6))).toEqual([1, 1, 1, 1, 2, 2]);
  });

  it("packs every drawn contour segment at its level", () => {
    const hf = heightfieldFromFunction(20, 5, (x, y) => 40 - Math.hypot(x - 50, y - 50) * 0.4);
    const contours = extractContours(hf, 4);
    const strokes = new StrokeBuffer();
    strokes.pushContours(contours);
    expect(strokes.count).toBeGreaterThan(contours.lines.length);
    for (let i = 0; i < strokes.count; i++) {
      expect(strokes.data.segStart[i * 3 + 2]).toBe(strokes.data.segEnd[i * 3 + 2]);
    }
  });

  it("uploads into a layer and grows its buffers when needed", () => {
    const material = createStrokeMaterial(createInkUniforms());
    const layer = new StrokeLayer(material);
    const strokes = new StrokeBuffer();
    for (let i = 0; i < 1500; i++) strokes.pushStrokes(Float64Array.from([i, 0, 1, i, 1, 0]), 0.85);
    layer.update(strokes);
    expect(layer.count).toBe(1500);
    const attr = layer.mesh.geometry.getAttribute("segEnd") as InstancedBufferAttribute;
    expect(attr.array.length).toBeGreaterThanOrEqual(1500 * 3);
    expect(attr.array[1499 * 3]).toBe(1499);
    layer.dispose();
    material.dispose();
  });
});

describe("terrain mesh", () => {
  it("uploads the same triangle index that contour extraction walks", () => {
    const hf = heightfieldFromFunction(12, 10, (x, y) => Math.sin(x / 20) * 10 + Math.cos(y / 15) * 8);
    const mesh = new TerrainMesh(createTerrainMaterial(createInkUniforms(), DEFAULT_CHANNELS));
    mesh.update(hf, undefined, undefined);
    const index = mesh.mesh.geometry.getIndex()!.array as Uint32Array;
    expect(Array.from(index)).toEqual(Array.from(buildTriangleIndex(hf)));
    expect(Array.from(mesh.mesh.geometry.getAttribute("heightM").array)).toEqual(Array.from(hf.heightsM));
    expect(mesh.mesh.geometry.getAttribute("waterM").array.every((v) => v === 0)).toBe(true);
    mesh.dispose();
  });
});

describe("InkView without a GPU", () => {
  it("draws nothing before mount but computes contours, frame and stats from a snapshot", async () => {
    const solver = createFakeSolver({ gridSize: 32 });
    solver.step(50);
    const view = createInkView({ contourIntervalM: 2, reliefScale: 3 });
    view.setState(await solver.snapshot({ layers: INK_VIEW_LAYERS }));
    expect(view.backend).toBeNull();
    expect(view.contours!.lines.length).toBeGreaterThan(0);
    expect(view.stats).toMatchObject({ gridSize: 32 });
    expect(view.stats.contourSegments).toBeGreaterThan(0);
    expect(view.frame!.gridSize).toBe(32);
    expect(view.projection()).toBeNull(); // no canvas, no viewport
    view.dispose();
    solver.dispose();
  });

  it("clamps exaggeration, reports the vertical scale shown, and applies lift states", () => {
    const view = createInkView({ contourIntervalM: 2, reliefScale: 3 });
    view.setExaggeration(2);
    expect(view.exaggeration).toBe(1);
    expect(view.verticalExaggeration).toBe(3);
    view.setExaggeration(-1);
    expect(view.verticalExaggeration).toBe(0);
    view.applyLiftState(FLAT_STATE);
    expect(view.layers).toMatchObject({ contours: true, hachures: false, water: false, sediment: false });
    view.applyLiftState({ ...LIFTED_STATE, exaggeration: 0.5 });
    expect(view.layers).toMatchObject({ hachures: true, water: true, sediment: true });
    expect(view.exaggeration).toBe(0.5);
    view.setCamera({ elevationDeg: 200 });
    expect(view.camera.elevationDeg).toBe(89);
    expect(view.legend().map((t) => t.id)).toEqual(["water", "sediment"]);
    view.dispose();
    expect(() => view.setExaggeration(0)).toThrow(/disposed/);
  });

  it("never touches the solver it draws: hash unchanged after drawing", async () => {
    const solver = createFakeSolver({ gridSize: 16 });
    solver.step(5);
    const before = await solver.hash();
    const view = createInkView({ contourIntervalM: 1 });
    view.setState(await solver.snapshot());
    view.setExaggeration(1);
    expect(await solver.hash()).toBe(before);
    view.dispose();
    solver.dispose();
  });
});
