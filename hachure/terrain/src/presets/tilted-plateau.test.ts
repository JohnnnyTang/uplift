import { describe, expect, it } from "vitest";
import {
  type TerrainState,
  DEFAULT_TERRAIN_CONFIG,
  TERRAIN_LAYERS,
  cellAt,
  cellIndex,
  hashSnapshot,
  isEdgeCell,
} from "../contract/index";
import { createFakeSolver, describeTerrainSolverContract } from "../testing/index";
import {
  DEFAULT_TILTED_PLATEAU_OPTIONS,
  type PresetConfig,
  TILTED_PLATEAU_ID,
  createTiltedPlateauPreset,
  tiltedPlateauPreset,
} from "./index";

const HARDNESS_RANGE = DEFAULT_TERRAIN_CONFIG.hardnessRange;
const cfg = (gridSize: number, metresPerCell: number, seed = 1): PresetConfig => ({
  gridSize,
  metresPerCell,
  seed,
  hardnessRange: HARDNESS_RANGE,
});

const digest = (state: TerrainState) =>
  hashSnapshot({ step: 0, gridSize: state.gridSize, layers: state.layers });

const ground = (state: TerrainState, x: number, y: number) => {
  const i = cellIndex(state.gridSize, x, y);
  return state.layers.bedrockM[i]! + state.layers.sedimentM[i]!;
};

/** The noise-free surface of validation-spec.md's common protocol, at cell-centre metres. */
function specGround(state: TerrainState, x: number, y: number): number {
  const m = state.metresPerCell;
  const L = state.gridSize * m;
  const xM = (x + 0.5) * m;
  const yM = (y + 0.5) * m;
  return 150 + (L - yM) * Math.tan((5 * Math.PI) / 180) + 0.0002 * (xM - L / 2) ** 2;
}

describe("tilted-plateau preset", () => {
  it("has a stable id that does not depend on grid size or options", () => {
    expect(tiltedPlateauPreset.id).toBe(TILTED_PLATEAU_ID);
    expect(createTiltedPlateauPreset({ slopeDeg: 3 }).id).toBe("tilted-plateau");
  });

  it("gives a bitwise-identical state for the same seed, and a different one for another seed", () => {
    const a = tiltedPlateauPreset.create(cfg(128, 10, 17));
    const b = createTiltedPlateauPreset().create(cfg(128, 10, 17));
    expect(new Uint8Array(a.buffer)).toEqual(new Uint8Array(b.buffer));
    expect(digest(a)).toBe(digest(b));
    expect(digest(tiltedPlateauPreset.create(cfg(128, 10, 18)))).not.toBe(digest(a));
  });

  it.each([2, 8, 17, 32, 64, 128, 256])("builds a valid state at %i² cells", (n) => {
    const state = tiltedPlateauPreset.create(cfg(n, 10));
    expect(state.gridSize).toBe(n);
    expect(state.outlet).toEqual({ x: Math.floor(n / 2), y: n - 1 });
    expect(isEdgeCell(n, state.outlet)).toBe(true);
    for (const name of TERRAIN_LAYERS) {
      expect(state.layers[name].length).toBe(n * n);
      expect(state.layers[name].every(Number.isFinite), name).toBe(true);
    }
    // Starts with zero water, flux, velocity and suspension (validation-spec.md, common protocol).
    for (const name of TERRAIN_LAYERS.filter((l) => !["bedrockM", "sedimentM", "hardness"].includes(l))) {
      expect(
        state.layers[name].every((v) => v === 0),
        name,
      ).toBe(true);
    }
    expect(state.layers.sedimentM.every((v) => v === 1)).toBe(true);
    expect(state.layers.hardness.every((v) => v === Math.fround(0.2))).toBe(true);
  });

  it("follows the common-protocol surface to within the noise bound", () => {
    const state = tiltedPlateauPreset.create(cfg(128, 10));
    const bound = DEFAULT_TILTED_PLATEAU_OPTIONS.noiseAmplitudeM + 1e-4; // plus float32 rounding near 260 m
    let maxNoise = 0;
    let sumNoise = 0;
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const noise = ground(state, x, y) - specGround(state, x, y);
        maxNoise = Math.max(maxNoise, Math.abs(noise));
        sumNoise += noise;
      }
    }
    expect(maxNoise).toBeLessThanOrEqual(bound);
    expect(maxNoise).toBeGreaterThan(0.001); // the seeded perturbation is really there
    expect(Math.abs(sumNoise / (128 * 128))).toBeLessThan(0.001); // and roughly zero-mean
  });

  it("falls to the south and is lowest along the centre line", () => {
    const state = tiltedPlateauPreset.create(cfg(64, 10));
    expect(ground(state, 32, 0)).toBeGreaterThan(ground(state, 32, 63));
    expect(ground(state, 0, 32)).toBeGreaterThan(ground(state, 32, 32));
    expect(ground(state, 63, 32)).toBeGreaterThan(ground(state, 32, 32));
  });

  it("samples one landscape at 128² × 10 m and 256² × 5 m", () => {
    const coarse = tiltedPlateauPreset.create(cfg(128, 10));
    const fine = tiltedPlateauPreset.create(cfg(256, 5));
    let maxDiff = 0;
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const mean =
          (ground(fine, 2 * x, 2 * y) +
            ground(fine, 2 * x + 1, 2 * y) +
            ground(fine, 2 * x, 2 * y + 1) +
            ground(fine, 2 * x + 1, 2 * y + 1)) /
          4;
        maxDiff = Math.max(maxDiff, Math.abs(mean - ground(coarse, x, y)));
      }
    }
    // Plane and bilinear noise average exactly; the curvature term adds 0.0002 × (2.5 m)² = 1.25 mm.
    expect(maxDiff).toBeLessThan(0.002);

    const lc = tiltedPlateauPreset.layout(cfg(128, 10));
    const lf = tiltedPlateauPreset.layout(cfg(256, 5));
    expect(lf.source.at).toEqual(lc.source.at);
    expect(lc.outletFace).toBe("south");
    expect(lf.outletFace).toBe("south");
    // The outlet cell centre differs with resolution, so each base level sits on the shared surface.
    const bound = DEFAULT_TILTED_PLATEAU_OPTIONS.noiseAmplitudeM + 1e-4;
    expect(Math.abs(lc.baseLevelM - specGround(coarse, lc.outlet.x, lc.outlet.y))).toBeLessThan(bound);
    expect(Math.abs(lf.baseLevelM - specGround(fine, lf.outlet.x, lf.outlet.y))).toBeLessThan(bound);
  });

  it("declares the river source, outlet and base level consistently with the state", () => {
    const config = cfg(128, 10, 101);
    const state = tiltedPlateauPreset.create(config);
    const layout = tiltedPlateauPreset.layout(config);
    expect(layout.outlet).toEqual(state.outlet);
    const o = cellIndex(128, state.outlet.x, state.outlet.y);
    expect(layout.baseLevelM).toBe(state.layers.bedrockM[o]! + state.layers.sedimentM[o]!);
    // Validation-spec reference grid: a 0.1 m³/s spring in the centre cell of row 8.
    expect(layout.sourceCell).toEqual({ x: 64, y: 8 });
    expect(cellAt(128, 10, layout.source.at)).toEqual(layout.sourceCell);
    expect(layout.source).toMatchObject({ kind: "spring", flowM3PerS: 0.1 });
    expect(layout.source.id).toBe("tilted-plateau/source");
    expect(tiltedPlateauPreset.layout(cfg(256, 5)).sourceCell).toEqual({ x: 128, y: 17 });
  });

  it("puts hard bands at the same metres at every grid size, clamped to the hardness range", () => {
    // AC3b geometry: hardness 0.8 across rows 72–75 of the 128² reference grid.
    const preset = createTiltedPlateauPreset({
      hardBands: [{ fromYFraction: 72 / 128, toYFraction: 76 / 128, hardness: 0.8 }],
    });
    const rowsWith = (state: TerrainState, h: number) => {
      const rows: number[] = [];
      for (let y = 0; y < state.gridSize; y++) {
        if (state.layers.hardness[cellIndex(state.gridSize, 0, y)] === Math.fround(h)) rows.push(y);
      }
      return rows;
    };
    expect(rowsWith(preset.create(cfg(128, 10)), 0.8)).toEqual([72, 73, 74, 75]);
    expect(rowsWith(preset.create(cfg(256, 5)), 0.8)).toEqual([144, 145, 146, 147, 148, 149, 150, 151]);

    const narrow = preset.create({ ...cfg(128, 10), hardnessRange: [0.3, 0.6] });
    expect(rowsWith(narrow, 0.6)).toEqual([72, 73, 74, 75]);
    expect(narrow.layers.hardness[0]).toBe(Math.fround(0.3));
  });

  it("uses the slope option, and rejects slopes outside the reader range", () => {
    const steep = createTiltedPlateauPreset({ slopeDeg: 10, noiseAmplitudeM: 0 }).create(cfg(32, 10));
    const dropM = ground(steep, 16, 0) - ground(steep, 16, 31);
    expect(dropM).toBeCloseTo(31 * 10 * Math.tan((10 * Math.PI) / 180), 3);
    expect(() => createTiltedPlateauPreset({ slopeDeg: 11 })).toThrow(RangeError);
    expect(() => createTiltedPlateauPreset({ slopeDeg: 0.5 })).toThrow(RangeError);
    expect(() => createTiltedPlateauPreset({ noiseAmplitudeM: Number.NaN })).toThrow(RangeError);
    expect(() =>
      createTiltedPlateauPreset({ hardBands: [{ fromYFraction: 0.5, toYFraction: 0.4, hardness: 0.8 }] }),
    ).toThrow(RangeError);
  });

  it("rejects invalid configs", () => {
    expect(() => tiltedPlateauPreset.create(cfg(1, 10))).toThrow(RangeError);
    expect(() => tiltedPlateauPreset.create(cfg(16, 0))).toThrow(RangeError);
    expect(() => tiltedPlateauPreset.create(cfg(16, 10, -1))).toThrow(RangeError);
    expect(() => tiltedPlateauPreset.create({ ...cfg(16, 10), hardnessRange: [0.9, 0.1] })).toThrow(
      RangeError,
    );
  });
});

// The preset drives a solver through the shared contract suite (with the fixture solver until 2A lands).
describeTerrainSolverContract(
  "fake solver on tilted-plateau",
  (config, preset) => createFakeSolver(config, preset),
  tiltedPlateauPreset,
);
