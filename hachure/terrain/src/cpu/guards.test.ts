/**
 * Parameter ranges and joint stability guards (docs/science/parameters.md, model.md). The contract's sanity
 * limits alone are not enough: the CPU solver must reject values outside the proposed admissible ranges.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TERRAIN_CONFIG,
  type NumericConfigKey,
  TERRAIN_CONFIG_LIMITS,
  type TerrainConfig,
  TerrainConfigError,
  resolveTerrainConfig,
} from "../contract/index";
import {
  CPU_ADMISSIBLE_RANGES,
  WAVE_SAFETY_FACTOR,
  createCpuSolver,
  maxEvaporationFractionPerStep,
  pipeWaveCourant,
  validateCpuSolverConfig,
} from "./index";
import { catchmentFixture } from "./test-fixtures";

const preset = catchmentFixture();
const fields = (config: TerrainConfig) => validateCpuSolverConfig(config).map((i) => i.field);
const withValue = (key: keyof TerrainConfig, value: unknown): TerrainConfig =>
  ({ ...DEFAULT_TERRAIN_CONFIG, [key]: value }) as TerrainConfig;

describe("admissible ranges", () => {
  it("the defaults are admissible, at the CPU tier and at 256² with 5 m cells", () => {
    expect(validateCpuSolverConfig(DEFAULT_TERRAIN_CONFIG)).toEqual([]);
    expect(validateCpuSolverConfig(resolveTerrainConfig({ gridSize: 256, metresPerCell: 5 }))).toEqual([]);
  });

  it("every numeric field has a range inside the contract's sanity limits", () => {
    expect(Object.keys(CPU_ADMISSIBLE_RANGES).sort()).toEqual(Object.keys(TERRAIN_CONFIG_LIMITS).sort());
    for (const key of Object.keys(CPU_ADMISSIBLE_RANGES) as NumericConfigKey[]) {
      expect(CPU_ADMISSIBLE_RANGES[key].min, key).toBeGreaterThanOrEqual(TERRAIN_CONFIG_LIMITS[key].min);
      expect(CPU_ADMISSIBLE_RANGES[key].max, key).toBeLessThanOrEqual(TERRAIN_CONFIG_LIMITS[key].max);
    }
  });

  // Values the contract accepts but parameters.md does not.
  const rejected: [keyof TerrainConfig, number][] = [
    ["gridSize", 1024],
    ["metresPerCell", 0.5],
    ["metresPerCell", 50],
    ["rainMmPerHr", 51],
    ["gravityMPerS2", 9.8],
    ["pipeAreaM2", 101],
    ["dtSimSeconds", 0.06],
    ["capacityCoefficient", 0.11],
    ["erosionRatePerS", 1.01],
    ["depositionRatePerS", 2.01],
    ["talusAngleDeg", 29],
    ["talusAngleDeg", 43],
    ["thermalRatePerS", 1.01],
    ["evaporationFractionPerStep", 0.00011],
    ["brushMaxHeightM", 5.01],
    ["brushMaxDepthM", 5.01],
    ["brushMaxRadiusM", 201],
    ["brushMaxSlopeDeg", 61],
  ];
  for (const [key, value] of rejected) {
    it(`rejects ${key} = ${value}`, () => {
      expect(validateTerrainLimitsAccept(key, value)).toBe(true);
      expect(fields(withValue(key, value))).toContain(key);
      expect(() => createCpuSolver({ [key]: value }, preset)).toThrow(TerrainConfigError);
    });
  }

  it("accepts each range's end points", () => {
    for (const key of Object.keys(CPU_ADMISSIBLE_RANGES) as NumericConfigKey[]) {
      const { min, max } = CPU_ADMISSIBLE_RANGES[key];
      for (const value of [min, max]) {
        const config = withValue(key, value);
        // Some end points are only admissible jointly (pipe area at small cells, evaporation at small dt).
        const issues = validateCpuSolverConfig(config).filter(
          (i) => i.field === key && /admissible/.test(i.message),
        );
        expect(issues, `${key} = ${value}`).toEqual([]);
      }
    }
  });

  it("rejects hardness ranges outside [0, 1] or inverted", () => {
    expect(fields(withValue("hardnessRange", [0.5, 0.2]))).toContain("hardnessRange");
    expect(fields(withValue("hardnessRange", [0, 1.1]))).toContain("hardnessRange");
    expect(fields(withValue("hardnessRange", [0, 1]))).toEqual([]);
  });
});

/** True when the contract's own validation accepts the value (so the CPU range is what rejects it). */
function validateTerrainLimitsAccept(key: keyof TerrainConfig, value: number): boolean {
  const limit = TERRAIN_CONFIG_LIMITS[key as NumericConfigKey];
  return value >= limit.min && value <= limit.max;
}

describe("joint guards", () => {
  it("evaporation's upper bound rescales with the time step", () => {
    expect(maxEvaporationFractionPerStep(0.05)).toBe(0.0001);
    expect(maxEvaporationFractionPerStep(0.025)).toBeCloseTo(1 - Math.sqrt(1 - 0.0001), 15);
    expect(fields(withValue("dtSimSeconds", 0.001))).toContain("evaporationFractionPerStep");
    expect(
      fields({ ...DEFAULT_TERRAIN_CONFIG, dtSimSeconds: 0.001, evaporationFractionPerStep: 1e-6 }),
    ).toEqual([]);
  });

  it("the pipe wave guard bounds pipe area against cell size", () => {
    expect(pipeWaveCourant(DEFAULT_TERRAIN_CONFIG)).toBeLessThan(WAVE_SAFETY_FACTOR);
    // 100 m² pipes on 1 m cells: celerity √(g A / l) ≈ 31 m/s, Courant ≈ 3.1.
    const tooWide = { ...DEFAULT_TERRAIN_CONFIG, metresPerCell: 1, pipeAreaM2: 100, brushMaxRadiusM: 10 };
    expect(pipeWaveCourant(tooWide)).toBeGreaterThan(WAVE_SAFETY_FACTOR);
    expect(fields(tooWide)).toContain("pipeAreaM2");
    // The candidate scaling 0.2 l² passes at every admissible cell size.
    for (const l of [1, 5, 10, 20]) {
      const scaled = {
        ...DEFAULT_TERRAIN_CONFIG,
        metresPerCell: l,
        pipeAreaM2: 0.2 * l * l,
        brushMaxRadiusM: 10 * l,
      };
      expect(validateCpuSolverConfig(scaled), `l = ${l}`).toEqual([]);
    }
  });

  it("the brush radius limit must cover at least one cell", () => {
    expect(fields({ ...DEFAULT_TERRAIN_CONFIG, metresPerCell: 20, brushMaxRadiusM: 15 })).toContain(
      "brushMaxRadiusM",
    );
  });

  it("reaction and slump guards hold everywhere inside the ranges", () => {
    const extreme = {
      ...DEFAULT_TERRAIN_CONFIG,
      erosionRatePerS: 1,
      depositionRatePerS: 2,
      thermalRatePerS: 1,
    };
    expect(validateCpuSolverConfig(extreme)).toEqual([]);
  });
});

describe("configure", () => {
  it("rejects out-of-range values without changing the config", () => {
    const solver = createCpuSolver({ gridSize: 16 }, preset);
    expect(() => solver.configure({ rainMmPerHr: 60 })).toThrow(TerrainConfigError);
    expect(solver.config.rainMmPerHr).toBe(DEFAULT_TERRAIN_CONFIG.rainMmPerHr);
  });

  it("rejects non-tunable fields", () => {
    const solver = createCpuSolver({ gridSize: 16 }, preset);
    expect(() => solver.configure({ gridSize: 32 } as never)).toThrow(TerrainConfigError);
  });

  it("allows dtSimSeconds to change only at step 0 (fixed per run)", () => {
    const solver = createCpuSolver({ gridSize: 16 }, preset);
    solver.configure({ dtSimSeconds: 0.025, evaporationFractionPerStep: 0 });
    expect(solver.config.dtSimSeconds).toBe(0.025);
    solver.step();
    expect(() => solver.configure({ dtSimSeconds: 0.01 })).toThrow(/fixed per run/);
    solver.configure({ dtSimSeconds: 0.025 }); // unchanged value is fine
    solver.reset(preset, 1);
    solver.configure({ dtSimSeconds: 0.01 });
    expect(solver.config.dtSimSeconds).toBe(0.01);
  });

  it("re-checks joint guards on every change", () => {
    const solver = createCpuSolver(
      { gridSize: 16, metresPerCell: 1, pipeAreaM2: 0.2, brushMaxRadiusM: 4 },
      preset,
    );
    expect(() => solver.configure({ pipeAreaM2: 100 })).toThrow(/pipe wave guard/);
  });
});
