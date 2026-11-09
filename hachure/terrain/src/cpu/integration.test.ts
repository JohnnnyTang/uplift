import { describe, expect, it } from "vitest";
import { applyBrush, type BrushOp } from "../tools/index";
import { tiltedPlateauPreset } from "../presets/index";
import { createCpuSolver } from "./solver";
import { FACE_SOUTH, outletFace } from "./kernel";

describe("CPU shared brush and real preset integration", () => {
  it.each(["raise", "dig", "smooth", "harden"] as const)(
    "%s matches the shared brush and changes no untouched float64 cell",
    async (kind) => {
      const solver = createCpuSolver({ gridSize: 32 }, tiltedPlateauPreset);
      solver.step(100);
      const before = solver.referenceLayers();
      const snapshot = await solver.snapshot();
      const mirror = tiltedPlateauPreset.create(solver.config);
      for (const [name, layer] of Object.entries(snapshot.layers))
        mirror.layers[name as keyof typeof mirror.layers].set(layer);
      const at = { xM: 165, yM: 165 },
        radiusM = 30;
      const op: BrushOp =
        kind === "raise"
          ? { kind, at, radiusM, heightM: 2 }
          : kind === "dig"
            ? { kind, at, radiusM, depthM: 2 }
            : kind === "smooth"
              ? { kind, at, radiusM, strength: 0.5 }
              : { kind, at, radiusM, hardness: 0.8 };
      const expected = applyBrush(mirror, op, solver.config);
      const result = await solver.applyTool(op);
      const after = solver.referenceLayers();
      const actual = await solver.snapshot();
      expect(result.applied).toBe(expected.applied);
      expect(result.clamped).toEqual(expected.clamped);
      let changeM = 0,
        preservedFractional = 0;
      for (const name of ["bedrockM", "sedimentM"] as const) {
        expect(actual.layers[name]).toEqual(mirror.layers[name]);
        for (let i = 0; i < before[name].length; i++) {
          if (snapshot.layers[name]![i] === mirror.layers[name][i]) {
            expect(after[name][i]).toBe(before[name][i]);
            if (Math.fround(before[name][i]!) !== before[name][i]) preservedFractional++;
          }
          changeM += after[name][i]! - before[name][i]!;
        }
      }
      expect(preservedFractional).toBeGreaterThan(0);
      expect(actual.layers.hardness).toEqual(mirror.layers.hardness);
      expect(after.waterM).toEqual(before.waterM);
      expect(after.suspendedSedimentM).toEqual(before.suspendedSedimentM);
      expect(Math.abs(result.volumeChangeM3 - changeM * solver.config.metresPerCell ** 2)).toBeLessThan(1e-8);
      expect((await solver.budget()).toolNetM3).toBe(result.volumeChangeM3);
      solver.dispose();
    },
  );
  it("uses the south outlet and the preset's exact stored base level", () => {
    const solver = createCpuSolver({ gridSize: 128, metresPerCell: 10 }, tiltedPlateauPreset);
    const layout = tiltedPlateauPreset.layout(solver.config);
    expect(layout.outletFace).toBe("south");
    expect(outletFace(128, layout.outlet.x, layout.outlet.y)).toBe(FACE_SOUTH);
    expect(solver.outletBaseLevelM).toBe(layout.baseLevelM);
    solver.dispose();
  });
});

it.each([1, 17, 101])(
  "preset source replacement and reset are trajectory-equivalent for seed %i",
  async (seed) => {
    const once = createCpuSolver({ gridSize: 128, metresPerCell: 10, seed }, tiltedPlateauPreset);
    const repeated = createCpuSolver({ gridSize: 128, metresPerCell: 10, seed }, tiltedPlateauPreset);
    const layout = tiltedPlateauPreset.layout(once.config);
    const initial = await once.snapshot();
    const outlet = layout.outlet.y * initial.gridSize + layout.outlet.x;
    const initialGroundM = initial.layers.bedrockM![outlet]! + initial.layers.sedimentM![outlet]!;
    expect(layout.baseLevelM - initialGroundM).toBe(0);
    expect(once.outletBaseLevelM - layout.baseLevelM).toBe(0);
    await once.applyTool(layout.source);
    await repeated.applyTool(layout.source);
    await repeated.applyTool(layout.source); // same source ID replaces, never adds another source
    once.step(20);
    repeated.step(20);
    expect(await repeated.hash()).toBe(await once.hash());
    expect((await repeated.budget()).sourcedWaterM3).toBeCloseTo(
      layout.source.flowM3PerS * once.config.dtSimSeconds * 20,
      14,
    );
    repeated.reset(tiltedPlateauPreset, seed);
    await repeated.applyTool(layout.source);
    repeated.step(20);
    expect(await repeated.hash()).toBe(await once.hash());
    once.dispose();
    repeated.dispose();
  },
);
