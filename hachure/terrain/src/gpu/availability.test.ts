import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTerrainConfig, waterComparisonPreset, WATER_COMPARISON_CONFIG } from "../index";
import { createGpuWaterSolver } from "./index";
afterEach(() => vi.unstubAllGlobals());
describe("GPU compute availability before renderer creation", () => {
  const config = resolveTerrainConfig(WATER_COMPARISON_CONFIG),
    state = waterComparisonPreset("dry").create(config);
  it("rejects absent WebGPU without attempting DOM or WebGL initialization", async () => {
    vi.stubGlobal("navigator", {});
    await expect(createGpuWaterSolver(config, state)).rejects.toThrow(/WebGPU unavailable/);
  });
  it("rejects a null adapter without attempting DOM or WebGL initialization", async () => {
    vi.stubGlobal("navigator", { gpu: { requestAdapter: async () => null } });
    await expect(createGpuWaterSolver(config, state)).rejects.toThrow(/adapter unavailable/);
  });
  it("propagates device creation failure before renderer initialization", async () => {
    vi.stubGlobal("navigator", {
      gpu: {
        requestAdapter: async () => ({
          requestDevice: async () => {
            throw new Error("device unavailable");
          },
        }),
      },
    });
    await expect(createGpuWaterSolver(config, state)).rejects.toThrow(/device unavailable/);
  });
});
