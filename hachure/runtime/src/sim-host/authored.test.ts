import { describe, it, expect } from "vitest";
import { createCpuSolver, resolveTerrainConfig } from "@hachure/terrain";
import type { AuthoredTerrainInitial } from "../reader/contracts";
import {
  backendConfig,
  SolverTransport,
  createFlatTerrainSample,
  selectTerrainBackend,
} from "./backend/index";
import { TerrainWorkerEngine } from "./worker-engine";
import { cloneAuthoredInitial } from "./authored";
export function authoredFixture(): AuthoredTerrainInitial {
  return {
    id: "prepared",
    gridSize: 8,
    metresPerCell: 2,
    outlet: { x: 4, y: 7 },
    bedrockM: Float32Array.from({ length: 64 }, (_, i) => 8 - Math.floor(i / 8)),
    sedimentM: new Float32Array(64),
    hardness: new Float32Array(64).fill(0.5),
    sources: [{ kind: "spring", id: "reader", at: { xM: 7, yM: 3 }, flowM3PerS: 1 }],
  };
}
const config = resolveTerrainConfig({ gridSize: 8, metresPerCell: 2, pipeAreaM2: 0.1, rainMmPerHr: 0 });
describe("authored initial boundary", () => {
  it("validates array contents, domain, edge outlet, sources and clones", () => {
    const initial = authoredFixture();
    const accepted = cloneAuthoredInitial(initial, config);
    initial.bedrockM.fill(99);
    expect(accepted.bedrockM[0]).toBe(8);
    for (const patch of [
      { gridSize: 9 },
      { bedrockM: new Float32Array(1) },
      { sedimentM: new Float32Array(64).fill(-1) },
      { hardness: new Float32Array(64).fill(1) },
      { outlet: { x: 2, y: 2 } },
      { sources: [...initial.sources, ...initial.sources] },
      { bedrockM: new Float32Array(64).fill(NaN) },
    ])
      expect(() => cloneAuthoredInitial({ ...authoredFixture(), ...patch }, config)).toThrow();
  });
  it("preserves exact authored configuration on every tier and flat fallback", async () => {
    for (const tier of ["flat", "cpu-64", "cpu-worker", "webgpu"] as const)
      expect(backendConfig(tier, config, authoredFixture())).toEqual(config);
    const sample = await createFlatTerrainSample(config, undefined, authoredFixture());
    expect(sample.snapshot.gridSize).toBe(8);
    expect(sample.diagnostics?.kind).toBe("unavailable");
    expect(sample.paths.current.path).toEqual([]);
    expect(sample.probes.incisionDepth).toBeNull();
  });
  it("Worker and shared solver transport agree through source replacement, rejection and authored reset", async () => {
    const transports = [new TerrainWorkerEngine(), new SolverTransport(createCpuSolver)];
    const outputs = [];
    for (const transport of transports) {
      const request =
        transport instanceof TerrainWorkerEngine
          ? transport.execute.bind(transport)
          : transport.request.bind(transport);
      const initial = authoredFixture();
      const first = (await request({ kind: "init", config, initial })).sample!;
      initial.bedrockM.fill(100);
      await request({ kind: "advance", steps: 3, sample: true });
      const moved = await request({
        kind: "tool",
        op: { kind: "spring", id: "reader", at: { xM: 3, yM: 5 }, flowM3PerS: 2 },
      });
      expect(moved.toolResult!.applied).toBe(true);
      const rain = await request({
        kind: "tool",
        op: { kind: "rain-source", id: "extra", at: { xM: 3, yM: 5 }, radiusM: 999, rainMmPerHr: 20 },
      });
      expect(rain.toolResult!.clamped).toContain("radius");
      expect(
        (await request({ kind: "tool", op: { kind: "remove-source", id: "extra" } })).toolResult!.applied,
      ).toBe(true);
      expect(moved.sample!.snapshot.layers.waterM!.some((v) => v > 0)).toBe(true);
      const rejected = await request({
        kind: "tool",
        op: { kind: "spring", id: "reader", at: { xM: -1, yM: 5 }, flowM3PerS: 2 },
      });
      expect(rejected.toolResult).toMatchObject({ applied: false, clamped: ["off-grid"] });
      const stepped = (await request({ kind: "advance", steps: 2, sample: true })).sample!;
      expect(stepped.snapshot.budget.sourcedWaterM3).toBeCloseTo(0.35);
      outputs.push(stepped.snapshot);
      await request({ kind: "configure", patch: { rainMmPerHr: 50 } });
      const reset = (await request({ kind: "reset" })).sample!;
      expect(reset.config).toEqual(first.config);
      expect(reset.snapshot).toEqual(first.snapshot);
      const again = (await request({ kind: "advance", steps: 3, sample: true })).sample!;
      expect(again.snapshot.budget.sourcedWaterM3).toBeCloseTo(0.15);
      transport.dispose();
    }
    expect(outputs[0]).toEqual(outputs[1]);
  });
  it("cached initialization includes authored data identity", async () => {
    const result = await selectTerrainBackend({
      config,
      initial: authoredFixture(),
      search: "?backend=cpu-64",
      canRenderWebGL2: () => true,
      createWorkerTransport: () => new SolverTransport(createCpuSolver),
    });
    const changed = authoredFixture();
    changed.bedrockM.fill(4);
    const sample = (await result.transport!.request({ kind: "init", config, initial: changed })).sample!;
    expect(sample.snapshot.layers.bedrockM![0]).toBe(4);
    result.transport!.dispose();
  });
});
