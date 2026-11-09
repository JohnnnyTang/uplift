import { describe, expect, it } from "vitest";
import {
  type TerrainState,
  DEFAULT_TERRAIN_CONFIG,
  cellIndex,
  cloneTerrainState,
  createTerrainState,
  layerVolumeM3,
} from "../contract/index";
import { createRng } from "../rng/index";
import { tiltedPlateauPreset } from "../presets/index";
import { type BrushLimits, applyBrush, brushRadiusRangeM, isBrushOp } from "./index";

const LIMITS: BrushLimits = DEFAULT_TERRAIN_CONFIG; // 5 m height and depth, 200 m radius, 60°, [0, 0.9]

/** A flat grid: bedrock at `bedrockM`, uniform loose layer `sedimentM`. */
function flat(n = 32, metresPerCell = 10, bedrockM = 100, sedimentM = 1): TerrainState {
  const state = createTerrainState(n, metresPerCell, { x: n / 2, y: n - 1 });
  state.layers.bedrockM.fill(bedrockM);
  state.layers.sedimentM.fill(sedimentM);
  state.layers.hardness.fill(0.2);
  return state;
}

/** Centre of cell (x, y) in metres. */
const at = (state: TerrainState, x: number, y: number) => ({
  xM: (x + 0.5) * state.metresPerCell,
  yM: (y + 0.5) * state.metresPerCell,
});

const solidM3 = (s: TerrainState) => layerVolumeM3(s, "bedrockM") + layerVolumeM3(s, "sedimentM");
const groundAt = (s: TerrainState, x: number, y: number) => {
  const i = cellIndex(s.gridSize, x, y);
  return s.layers.bedrockM[i]! + s.layers.sedimentM[i]!;
};

/** Steepest cardinal-pair slope anywhere on the grid (unit: degrees). */
function maxSlopeDeg(s: TerrainState): number {
  let max = 0;
  for (let y = 0; y < s.gridSize; y++) {
    for (let x = 0; x < s.gridSize; x++) {
      if (x + 1 < s.gridSize) max = Math.max(max, Math.abs(groundAt(s, x, y) - groundAt(s, x + 1, y)));
      if (y + 1 < s.gridSize) max = Math.max(max, Math.abs(groundAt(s, x, y) - groundAt(s, x, y + 1)));
    }
  }
  return (Math.atan(max / s.metresPerCell) * 180) / Math.PI;
}

describe("raise and dig", () => {
  it("raise adds loose sediment, peaking at the centre, and reports the measured volume", () => {
    const state = flat();
    const before = cloneTerrainState(state);
    const result = applyBrush(
      state,
      { kind: "raise", at: at(state, 16, 16), radiusM: 40, heightM: 2 },
      LIMITS,
    );
    expect(result).toMatchObject({ applied: true, clamped: [] });
    const c = cellIndex(32, 16, 16);
    expect(state.layers.sedimentM[c]).toBeCloseTo(3, 5);
    expect(state.layers.bedrockM).toEqual(before.layers.bedrockM);
    expect(result.volumeChangeM3).toBeGreaterThan(0);
    expect(result.volumeChangeM3).toBeCloseTo(solidM3(state) - solidM3(before), 6);
    // Cells outside the disk are untouched.
    expect(state.layers.sedimentM[cellIndex(32, 16, 10)]).toBe(1);
    expect(state.layers.waterM.every((v) => v === 0)).toBe(true);
  });

  it("dig removes sediment first, then bedrock", () => {
    const state = flat(32, 10, 100, 1);
    const result = applyBrush(state, { kind: "dig", at: at(state, 16, 16), radiusM: 40, depthM: 3 }, LIMITS);
    const c = cellIndex(32, 16, 16);
    expect(state.layers.sedimentM[c]).toBe(0);
    expect(state.layers.bedrockM[c]).toBeCloseTo(98, 5);
    expect(state.layers.sedimentM.every((v) => v >= 0)).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.volumeChangeM3).toBeLessThan(0);
    expect(result.volumeChangeM3).toBeCloseTo(solidM3(state) - solidM3(flat(32, 10, 100, 1)), 6);
  });

  it("clamps height and depth to the per-application limits and says so", () => {
    const state = flat();
    const c = cellIndex(32, 16, 16);
    const up = applyBrush(state, { kind: "raise", at: at(state, 16, 16), radiusM: 60, heightM: 50 }, LIMITS);
    expect(up.clamped).toEqual(["height"]);
    expect(groundAt(state, 16, 16) - 101).toBeCloseTo(LIMITS.brushMaxHeightM, 4);

    const s2 = flat();
    const down = applyBrush(s2, { kind: "dig", at: at(s2, 16, 16), radiusM: 60, depthM: 50 }, LIMITS);
    expect(down.clamped).toEqual(["depth"]);
    expect(101 - (s2.layers.bedrockM[c]! + s2.layers.sedimentM[c]!)).toBeCloseTo(LIMITS.brushMaxDepthM, 4);
  });

  it("limits the applied height so no neighbour pair ends steeper than brushMaxSlopeDeg", () => {
    // 1 m cells and a one-cell brush: 5 m in one cell would be a 79° step.
    const state = flat(16, 1, 0, 0);
    const result = applyBrush(state, { kind: "raise", at: at(state, 8, 8), radiusM: 1, heightM: 5 }, LIMITS);
    expect(result.applied).toBe(true);
    expect(result.clamped).toEqual(["slope"]);
    expect(maxSlopeDeg(state)).toBeLessThanOrEqual(LIMITS.brushMaxSlopeDeg + 1e-4);
    expect(maxSlopeDeg(state)).toBeGreaterThan(LIMITS.brushMaxSlopeDeg - 0.1); // as much as allowed
    expect(result.volumeChangeM3).toBeCloseTo(solidM3(state), 9);

    const pit = flat(16, 1, 0, 0);
    const dug = applyBrush(pit, { kind: "dig", at: at(pit, 8, 8), radiusM: 1, depthM: 5 }, LIMITS);
    expect(dug.clamped).toEqual(["slope"]);
    expect(maxSlopeDeg(pit)).toBeLessThanOrEqual(LIMITS.brushMaxSlopeDeg + 1e-4);
  });

  it("refuses to steepen a face that is already steeper than the limit, but may ease it", () => {
    const cliff = flat(16, 1, 0, 1);
    for (let y = 0; y < 16; y++) for (let x = 8; x < 16; x++) cliff.layers.bedrockM[cellIndex(16, x, y)] = 3; // a 72° step
    const before = cloneTerrainState(cliff);
    const higher = applyBrush(cliff, { kind: "raise", at: at(cliff, 8, 8), radiusM: 1, heightM: 1 }, LIMITS);
    expect(higher).toEqual({ applied: false, clamped: ["slope"], volumeChangeM3: 0 });
    expect(new Uint8Array(cliff.buffer)).toEqual(new Uint8Array(before.buffer));

    const eased = applyBrush(cliff, { kind: "smooth", at: at(cliff, 8, 8), radiusM: 3, strength: 1 }, LIMITS);
    expect(eased.applied).toBe(true);
    expect(eased.clamped).toEqual([]);
    expect(maxSlopeDeg(cliff)).toBeLessThanOrEqual(maxSlopeDeg(before));
  });

  it("a zero-height raise changes nothing", () => {
    const state = flat();
    expect(
      applyBrush(state, { kind: "raise", at: at(state, 3, 3), radiusM: 30, heightM: 0 }, LIMITS),
    ).toEqual({
      applied: false,
      clamped: [],
      volumeChangeM3: 0,
    });
  });
});

describe("radius and grid clamps", () => {
  it("offers one cell up to min(brushMaxRadiusM, a quarter of the domain)", () => {
    expect(brushRadiusRangeM({ gridSize: 128, metresPerCell: 10 }, LIMITS)).toEqual({ minM: 10, maxM: 200 });
    expect(brushRadiusRangeM({ gridSize: 32, metresPerCell: 10 }, LIMITS)).toEqual({ minM: 10, maxM: 80 });
  });

  it("clamps the radius above the maximum and below one cell", () => {
    const state = flat(32, 10);
    const wide = applyBrush(
      state,
      { kind: "raise", at: at(state, 16, 16), radiusM: 500, heightM: 1 },
      LIMITS,
    );
    expect(wide.clamped).toEqual(["radius"]);
    expect(state.layers.sedimentM[cellIndex(32, 16, 16 - 8)]).toBe(1); // 80 m away: on the clamped rim
    expect(state.layers.sedimentM[cellIndex(32, 16, 16 - 7)]).toBeGreaterThan(1);

    const tiny = applyBrush(state, { kind: "dig", at: at(state, 4, 4), radiusM: 1, depthM: 1 }, LIMITS);
    expect(tiny.clamped).toEqual(["radius"]);
    expect(tiny.applied).toBe(true);
  });

  it("disables the brush when the radius range is empty", () => {
    const state = flat();
    const limits = { ...LIMITS, brushMaxRadiusM: 5 }; // below one 10 m cell
    const result = applyBrush(state, { kind: "raise", at: at(state, 5, 5), radiusM: 5, heightM: 1 }, limits);
    expect(result).toEqual({ applied: false, clamped: ["radius"], volumeChangeM3: 0 });
  });

  it("applies nothing when the centre is off the grid, and clips disks at the edge", () => {
    const state = flat();
    const before = cloneTerrainState(state);
    const off = applyBrush(state, { kind: "dig", at: { xM: -5, yM: 50 }, radiusM: 30, depthM: 1 }, LIMITS);
    expect(off).toEqual({ applied: false, clamped: ["off-grid"], volumeChangeM3: 0 });
    expect(new Uint8Array(state.buffer)).toEqual(new Uint8Array(before.buffer));

    const edge = applyBrush(state, { kind: "raise", at: { xM: 1, yM: 1 }, radiusM: 30, heightM: 1 }, LIMITS);
    expect(edge).toMatchObject({ applied: true, clamped: [] });
  });
});

describe("smooth", () => {
  function rough(seed: number, n = 32, metresPerCell = 10): TerrainState {
    const state = flat(n, metresPerCell, 0, 0.5);
    const rng = createRng(seed);
    for (let i = 0; i < n * n; i++) state.layers.bedrockM[i] = rng.nextRange(-2, 2);
    return state;
  }

  const roughness = (s: TerrainState, x0: number, x1: number) => {
    let sum = 0;
    for (let y = x0; y < x1; y++)
      for (let x = x0; x < x1 - 1; x++) sum += (groundAt(s, x, y) - groundAt(s, x + 1, y)) ** 2;
    return sum;
  };

  it("conserves solid volume, to float32 storage, and reports the measured change", () => {
    for (const seed of [1, 17, 101]) {
      const state = rough(seed);
      const before = cloneTerrainState(state);
      const result = applyBrush(
        state,
        { kind: "smooth", at: at(state, 16, 16), radiusM: 80, strength: 1 },
        LIMITS,
      );
      expect(result.applied).toBe(true);
      const change = solidM3(state) - solidM3(before);
      // Each touched cell can round by half a float32 ulp of its ~2 m values in each of two layers.
      const cells = 32 * 32;
      const bound = cells * 2 * 2 ** -23 * 4 * 100;
      expect(Math.abs(change)).toBeLessThan(bound);
      expect(result.volumeChangeM3).toBeCloseTo(change, 6);
    }
  });

  it("conserves volume on the preset landscape too", () => {
    const state = tiltedPlateauPreset.create({ ...DEFAULT_TERRAIN_CONFIG, gridSize: 64 });
    const before = cloneTerrainState(state);
    const result = applyBrush(
      state,
      { kind: "smooth", at: at(state, 32, 32), radiusM: 150, strength: 0.7 },
      LIMITS,
    );
    const change = solidM3(state) - solidM3(before);
    // Float32 ulp at ~300 m is 2^-15 m; at most ~700 touched cells × 100 m² each.
    expect(Math.abs(change)).toBeLessThan(700 * 2 ** -15 * 100);
    expect(result.volumeChangeM3).toBeCloseTo(change, 6);
  });

  it("reduces roughness inside the brush and leaves cells outside untouched", () => {
    const state = rough(5);
    const before = cloneTerrainState(state);
    applyBrush(state, { kind: "smooth", at: { xM: 160, yM: 160 }, radiusM: 80, strength: 1 }, LIMITS);
    expect(roughness(state, 13, 19)).toBeLessThan(0.5 * roughness(before, 13, 19));
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (Math.hypot((x + 0.5) * 10 - 160, (y + 0.5) * 10 - 160) > 80) {
          expect(groundAt(state, x, y)).toBe(groundAt(before, x, y));
        }
      }
    }
  });

  it("removes sediment before bedrock, and deposits as sediment", () => {
    const state = rough(9);
    const before = cloneTerrainState(state);
    applyBrush(state, { kind: "smooth", at: at(state, 16, 16), radiusM: 60, strength: 1 }, LIMITS);
    for (let i = 0; i < 32 * 32; i++) {
      const sed = state.layers.sedimentM[i]!;
      expect(sed).toBeGreaterThanOrEqual(0);
      if (state.layers.bedrockM[i] !== before.layers.bedrockM[i]) {
        expect(state.layers.bedrockM[i]!).toBeLessThan(before.layers.bedrockM[i]!); // only lowered
        expect(sed).toBe(0); // and only once its sediment is gone
      }
    }
  });

  it("strength 0 changes nothing", () => {
    const state = rough(3);
    const result = applyBrush(
      state,
      { kind: "smooth", at: at(state, 16, 16), radiusM: 60, strength: 0 },
      LIMITS,
    );
    expect(result).toEqual({ applied: false, clamped: [], volumeChangeM3: 0 });
  });
});

describe("harden", () => {
  it("writes hardness inside the disk only, without moving material", () => {
    const state = flat();
    const before = cloneTerrainState(state);
    const result = applyBrush(
      state,
      { kind: "harden", at: at(state, 16, 16), radiusM: 30, hardness: 0.8 },
      LIMITS,
    );
    expect(result).toEqual({ applied: true, clamped: [], volumeChangeM3: 0 });
    expect(state.layers.hardness[cellIndex(32, 16, 16)]).toBe(Math.fround(0.8));
    expect(state.layers.hardness[cellIndex(32, 16, 19)]).toBe(Math.fround(0.8)); // 30 m: on the rim
    expect(state.layers.hardness[cellIndex(32, 16, 20)]).toBe(Math.fround(0.2));
    expect(state.layers.bedrockM).toEqual(before.layers.bedrockM);
    expect(state.layers.sedimentM).toEqual(before.layers.sedimentM);
  });

  it("clamps the target to hardnessRange", () => {
    const state = flat();
    const high = applyBrush(state, { kind: "harden", at: at(state, 8, 8), radiusM: 20, hardness: 1 }, LIMITS);
    expect(high.clamped).toEqual(["hardness"]);
    expect(state.layers.hardness[cellIndex(32, 8, 8)]).toBe(Math.fround(0.9));
    const low = applyBrush(state, { kind: "harden", at: at(state, 8, 8), radiusM: 20, hardness: -1 }, LIMITS);
    expect(low.clamped).toEqual(["hardness"]);
    expect(state.layers.hardness[cellIndex(32, 8, 8)]).toBe(0);
  });

  it("reports not applied when the hardness is already the target", () => {
    const state = flat();
    const op = { kind: "harden", at: at(state, 8, 8), radiusM: 20, hardness: 0.2 } as const;
    expect(applyBrush(state, op, LIMITS).applied).toBe(false);
  });
});

describe("brush inputs and determinism", () => {
  it("throws on values no control could produce", () => {
    const state = flat();
    const c = at(state, 8, 8);
    expect(() =>
      applyBrush(state, { kind: "raise", at: c, radiusM: 20, heightM: Number.NaN }, LIMITS),
    ).toThrow(RangeError);
    expect(() => applyBrush(state, { kind: "raise", at: c, radiusM: 20, heightM: -1 }, LIMITS)).toThrow(
      RangeError,
    );
    expect(() => applyBrush(state, { kind: "dig", at: c, radiusM: 0, depthM: 1 }, LIMITS)).toThrow(
      RangeError,
    );
    expect(() => applyBrush(state, { kind: "smooth", at: c, radiusM: 20, strength: 1.5 }, LIMITS)).toThrow(
      RangeError,
    );
    expect(() =>
      applyBrush(
        state,
        { kind: "harden", at: { xM: Number.POSITIVE_INFINITY, yM: 0 }, radiusM: 20, hardness: 0.5 },
        LIMITS,
      ),
    ).toThrow(RangeError);
  });

  it("gives identical bytes for the same state and op sequence", () => {
    const config = { ...DEFAULT_TERRAIN_CONFIG, gridSize: 64 };
    const run = () => {
      const state = tiltedPlateauPreset.create(config);
      const c = at(state, 32, 32);
      applyBrush(state, { kind: "raise", at: c, radiusM: 50, heightM: 3 }, LIMITS);
      applyBrush(state, { kind: "dig", at: { xM: c.xM + 40, yM: c.yM }, radiusM: 30, depthM: 4 }, LIMITS);
      applyBrush(state, { kind: "smooth", at: c, radiusM: 80, strength: 0.5 }, LIMITS);
      applyBrush(state, { kind: "harden", at: c, radiusM: 40, hardness: 0.8 }, LIMITS);
      return new Uint8Array(state.buffer);
    };
    expect(run()).toEqual(run());
  });

  it("isBrushOp separates brushes from sources", () => {
    expect(isBrushOp({ kind: "smooth", at: { xM: 0, yM: 0 }, radiusM: 1, strength: 1 })).toBe(true);
    expect(isBrushOp({ kind: "spring", id: "s", at: { xM: 0, yM: 0 }, flowM3PerS: 1 })).toBe(false);
    expect(isBrushOp({ kind: "remove-source", id: "s" })).toBe(false);
  });
});

describe("contract-suite expectations on the preset", () => {
  it("meets describeTerrainSolverContract's tool checks when a solver delegates to applyBrush", () => {
    // Mirrors "tools report the clamps that engaged" in testing/contract-suite.ts, on the 32² suite grid.
    const config = { ...DEFAULT_TERRAIN_CONFIG, gridSize: 32 };
    const state = tiltedPlateauPreset.create(config);
    const c = { xM: 160, yM: 160 };
    const r = config.metresPerCell * 3;
    const ok = applyBrush(
      state,
      { kind: "raise", at: c, radiusM: r, heightM: config.brushMaxHeightM / 10 },
      config,
    );
    expect(ok).toMatchObject({ applied: true, clamped: [] });
    const deep = applyBrush(
      state,
      { kind: "dig", at: c, radiusM: r, depthM: config.brushMaxDepthM * 10 },
      config,
    );
    expect(deep.clamped).toContain("depth");
    expect(deep.volumeChangeM3).toBeLessThan(0);
    const wide = applyBrush(
      state,
      { kind: "raise", at: c, radiusM: config.brushMaxRadiusM * 2, heightM: config.brushMaxHeightM / 10 },
      config,
    );
    expect(wide.clamped).toContain("radius");
    expect(applyBrush(state, { kind: "harden", at: c, radiusM: r, hardness: 2 }, config).clamped).toContain(
      "hardness",
    );
    const off = applyBrush(state, { kind: "dig", at: { xM: -1e6, yM: -1e6 }, radiusM: r, depthM: 1 }, config);
    expect(off).toMatchObject({ applied: false, clamped: ["off-grid"] });
  });
});
