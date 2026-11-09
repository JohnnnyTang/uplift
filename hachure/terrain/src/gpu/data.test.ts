import { describe, expect, it } from "vitest";
import { resolveTerrainConfig, waterComparisonPreset, WATER_COMPARISON_CONFIG } from "../index";
import { splitElevation, validateWaterStage } from "./data";
import { compareFields } from "../compare/fields";

describe("water stage boundaries", () => {
  const config = resolveTerrainConfig(WATER_COMPARISON_CONFIG);
  it("accepts the shared water fixture but refuses omitted active processes", () => {
    const state = waterComparisonPreset("wet").create(config);
    expect(() => validateWaterStage(config, state)).not.toThrow();
    expect(() => validateWaterStage({ ...config, erosionRatePerS: 0.5 }, state)).toThrow(
      /does not implement/,
    );
    expect(() => validateWaterStage({ ...config, manningNSPerMOneThird: 0.001 }, state)).toThrow(
      /manningNSPerMOneThird.*outside/,
    );
    expect(() => validateWaterStage(config, { ...state, outlet: { x: 3, y: 3 } })).toThrow(/edge/);
  });
  it("preserves the initial elevation around a local datum and validates source rates", () => {
    const state = waterComparisonPreset("wet").create(config);
    const split = splitElevation(state);
    for (let i = 0; i < config.gridSize ** 2; i++)
      expect(split.datumM + split.base[i * 4]).toBe(state.layers.bedrockM[i]);
    expect(() => splitElevation(state, new Float32Array(3))).toThrow(/match grid/);
    expect(() => splitElevation(state, new Float32Array(config.gridSize ** 2).fill(-1))).toThrow(
      /non-negative/,
    );
  });
  it("comparison fails nonfinite values and values outside absolute plus relative tolerance", () => {
    expect(compareFields([0.001, 100.1], [0, 100], { absolute: 0.001, relative: 0.001 }).failed).toBe(0);
    expect(compareFields([NaN, 3], [0, 1], { absolute: 0.001, relative: 0.001 }).failed).toBe(2);
  });
});
