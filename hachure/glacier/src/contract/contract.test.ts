import { describe, expect, it } from "vitest";
import {
  DEFAULT_GLACIER_CONFIG,
  GLACIER_CONFIG_LIMITS,
  ROCK_IDS,
  ROCK_TYPES,
  measureSection,
  resolveGlacierConfig,
  validateGlacierConfig,
} from "./index";
import { DEFAULT_V_VALLEY, OPEN_HEAD_V_VALLEY, createVValleyBed, maxCellSlopeDeg } from "../presets/index";

describe("GlacierConfig", () => {
  it("defaults are valid and every numeric field has a limit", () => {
    expect(validateGlacierConfig(DEFAULT_GLACIER_CONFIG)).toEqual([]);
    for (const [key, value] of Object.entries(DEFAULT_GLACIER_CONFIG)) {
      if (typeof value === "number") expect(GLACIER_CONFIG_LIMITS).toHaveProperty(key);
    }
  });

  it("rejects out-of-range, non-integer and unknown values instead of clamping", () => {
    expect(() => resolveGlacierConfig({ dtYears: 5 })).toThrow(/dtYears/);
    expect(() => resolveGlacierConfig({ nx: 12.5 })).toThrow(/integer/);
    // @ts-expect-error deliberately invalid rock
    expect(() => resolveGlacierConfig({ rockId: "chalk" })).toThrow(/rockId/);
    // @ts-expect-error deliberately invalid enum
    expect(() => resolveGlacierConfig({ massBalanceAltitude: "sea" })).toThrow(/massBalanceAltitude/);
  });

  it("resolved configs are frozen", () => {
    expect(Object.isFrozen(resolveGlacierConfig())).toBe(true);
  });
});

describe("rock types", () => {
  it("order erodibility soft > medium > hard and wall strength the other way", () => {
    const [shale, sandstone, granite] = ROCK_IDS.map((id) => ROCK_TYPES[id]);
    expect(shale!.relativeErodibility).toBeGreaterThan(sandstone!.relativeErodibility);
    expect(sandstone!.relativeErodibility).toBeGreaterThan(granite!.relativeErodibility);
    expect(granite!.criticalWallSlopeDeg).toBeGreaterThan(sandstone!.criticalWallSlopeDeg);
    expect(sandstone!.criticalWallSlopeDeg).toBeGreaterThan(shale!.criticalWallSlopeDeg);
  });

  it("every rock holds the authored start's walls, so the start is the same V for every rock", () => {
    for (const id of ROCK_IDS)
      expect(ROCK_TYPES[id].criticalWallSlopeDeg).toBeGreaterThan(DEFAULT_V_VALLEY.wallSlopeDeg + 2);
  });

  it("no cell pair of the registered start (enclosed head, crest corners included) is steeper than any rock holds", () => {
    const c = DEFAULT_GLACIER_CONFIG;
    const slope = maxCellSlopeDeg(createVValleyBed(c), c.nx, c.ny, c.metresPerCell);
    const weakest = Math.min(...ROCK_IDS.map((id) => ROCK_TYPES[id].criticalWallSlopeDeg));
    expect(slope).toBeLessThan(weakest - 2);
  });

  it("the open-head 5G start stays reproducible: it differs from the registered start only beyond the valley", () => {
    const grid = { nx: 128, ny: 96, metresPerCell: 40, seed: 1 };
    const open = createVValleyBed(grid, OPEN_HEAD_V_VALLEY);
    // Floor on the axis is the same in both starts for the shared 5080 m of valley.
    const enclosed = createVValleyBed(grid, { ...OPEN_HEAD_V_VALLEY, valleyLengthM: 127 * 40 });
    const axis = 48 * 128;
    for (let i = 0; i < 128; i++) expect(enclosed[axis + i]).toBeCloseTo(open[axis + i]!, 6);
  });
});

/** One-column grid (nx = 1) holding a profile z(y). */
function profile(ny: number, z: (y: number) => number) {
  return { bed: Float64Array.from({ length: ny }, (_, j) => z(j)), grid: { nx: 1, ny, metresPerCell: 10 } };
}

describe("measureSection", () => {
  it("reads a V as b ≈ 1 with a narrow floor", () => {
    const { bed, grid } = profile(81, (j) => 100 + 10 * Math.abs(j - 40) * 0.6);
    const s = measureSection(bed, undefined, grid, 0);
    expect(s.floorElevationM).toBeCloseTo(100, 6);
    expect(s.depthM).toBeCloseTo(240, 6);
    expect(s.shapeExponent).toBeCloseTo(1, 1);
    expect(s.wallSlopeDeg).toBeCloseTo((Math.atan(0.6) * 180) / Math.PI, 3);
    // Floor band 25 m on walls rising 6 m per 10 m cell: 2 × 25 / 0.6 ≈ 83 m.
    expect(s.floorWidthM).toBeCloseTo(83.3, 0);
  });

  it("reads a parabola as b ≈ 2", () => {
    const { bed, grid } = profile(81, (j) => 100 + 0.15 * (j - 40) ** 2);
    expect(measureSection(bed, undefined, grid, 0).shapeExponent).toBeCloseTo(2, 1);
  });

  it("measures a flat floor between steep walls", () => {
    const { bed, grid } = profile(81, (j) => 100 + Math.max(0, Math.abs(j - 40) - 15) * 20);
    const s = measureSection(bed, undefined, grid, 0);
    expect(s.floorWidthM).toBeGreaterThan(300);
    expect(s.shapeExponent).toBeGreaterThan(2);
  });

  it("rejects columns outside the grid", () => {
    const { bed, grid } = profile(9, () => 0);
    expect(() => measureSection(bed, undefined, grid, 1)).toThrow(RangeError);
  });
});
