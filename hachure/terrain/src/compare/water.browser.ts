import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { server } from "vitest/browser";
import {
  applyBrush,
  cellAt,
  tiltedPlateauPreset,
  type SpringOp,
  createCpuSolver,
  resolveTerrainConfig,
  waterComparisonPreset,
  WATER_COMPARISON_CONFIG,
  type TerrainConfig,
  type TerrainPreset,
} from "../index";
import { createGpuWaterSolver, type WaterSnapshot } from "../gpu/index";
import { compareFields, WATER_TOLERANCES } from "./fields";

const evidence: Record<string, unknown> = {
  scope: "Real water stage; not full erosion or classroom performance acceptance",
  tolerances: WATER_TOLERANCES,
  cases: [],
};
const cases = evidence.cases as unknown[];
let available = false;
beforeAll(async () => {
  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: "high-performance" });
  available = Boolean(adapter);
  evidence.utc = new Date().toISOString();
  evidence.userAgent = navigator.userAgent;
  evidence.adapter = adapter
    ? {
        vendor: adapter.info.vendor,
        architecture: adapter.info.architecture,
        device: adapter.info.device,
        description: adapter.info.description,
        isFallbackAdapter: adapter.info.isFallbackAdapter,
        driver: "Not exposed by WebGPU; obtain OS driver version for classroom acceptance",
      }
    : null;
  evidence.capability = available
    ? "WebGPU adapter available"
    : "SKIPPED: no WebGPU adapter; requires capable runner or local wave-close run";
});
afterAll(async () => {
  await server.commands.writeFile("src/compare/results-local.json", JSON.stringify(evidence, null, 2) + "\n");
});

async function compare(
  name: string,
  config: TerrainConfig,
  preset: TerrainPreset,
  steps = 80,
  spring: boolean | SpringOp = false,
) {
  const cpu = createCpuSolver(config, preset);
  const sourceRate = new Float32Array(config.gridSize ** 2);
  if (spring) {
    const op: SpringOp =
      typeof spring === "boolean"
        ? {
            kind: "spring",
            id: "comparison",
            at: { xM: 3.5 * config.metresPerCell, yM: 2.5 * config.metresPerCell },
            flowM3PerS: 0.1,
          }
        : spring;
    const cell = cellAt(config.gridSize, config.metresPerCell, op.at)!;
    sourceRate[cell.y * config.gridSize + cell.x] = op.flowM3PerS / config.metresPerCell ** 2;
    await cpu.applyTool(op);
  }
  const gpu = await createGpuWaterSolver(config, preset.create(config), { sourceRateMPerS: sourceRate });
  try {
    cpu.step(steps);
    await gpu.step(steps);
    const a = await gpu.snapshot(),
      b = await cpu.snapshot(),
      reference = cpu.referenceLayers();
    const expectedFlux = new Float32Array(config.gridSize ** 2 * 4);
    const faces = ["fluxWestM3PerS", "fluxEastM3PerS", "fluxNorthM3PerS", "fluxSouthM3PerS"] as const;
    for (let i = 0; i < config.gridSize ** 2; i++)
      for (let j = 0; j < 4; j++) expectedFlux[i * 4 + j] = b.layers[faces[j]]![i];
    const checks = {
      water: compareFields(a.waterM, reference.waterM, WATER_TOLERANCES.waterM),
      flux: compareFields(a.fluxM3PerS, expectedFlux, WATER_TOLERANCES.fluxM3PerS),
      u: compareFields(a.velocityXMPerS, b.layers.velocityXMPerS!, WATER_TOLERANCES.velocityMPerS),
      v: compareFields(a.velocityYMPerS, b.layers.velocityYMPerS!, WATER_TOLERANCES.velocityMPerS),
    };
    cases.push({
      name,
      presetId: preset.id,
      seed: config.seed,
      steps,
      gridSize: config.gridSize,
      dt: config.dtSimSeconds,
      roughness: config.manningNSPerMOneThird,
      ...checks,
      wave: a.waveCourant,
      transport: a.transportCourant,
    });
    expect(a.step).toBe(steps);
    expect(a.failure).toBeNull();
    for (const [field, check] of Object.entries(checks))
      expect(check.failed, `${name} ${field}: ${JSON.stringify(check)}`).toBe(0);
    return a;
  } finally {
    cpu.dispose();
    await gpu.dispose();
  }
}

describe("GPU water [requires-webgpu]", () => {
  for (const kind of ["dry", "wet", "front"] as const)
    for (const roughness of [0.025, 0.035, 0.15])
      for (const dt of [0.05, 0.0125]) {
        it(`${kind}, roughness ${roughness}, dt ${dt}`, async (context) => {
          if (!available) context.skip();
          await compare(
            `${kind}/${roughness}/${dt}`,
            resolveTerrainConfig({
              ...WATER_COMPARISON_CONFIG,
              dtSimSeconds: dt,
              manningNSPerMOneThird: roughness,
            }),
            waterComparisonPreset(kind),
          );
        });
      }
  it("agrees with a persistent spring and odd-grid reduction", async (context) => {
    if (!available) context.skip();
    await compare(
      "spring/odd-grid",
      resolveTerrainConfig({ ...WATER_COMPARISON_CONFIG, gridSize: 9 }),
      waterComparisonPreset("dry"),
      80,
      true,
    );
  });
  for (const outlet of [
    { x: 0, y: 4 },
    { x: 7, y: 4 },
    { x: 4, y: 0 },
    { x: 7, y: 7 },
  ]) {
    it(`agrees with outlet ${outlet.x},${outlet.y}`, async (context) => {
      if (!available) context.skip();
      const config = resolveTerrainConfig(WATER_COMPARISON_CONFIG);
      const preset: TerrainPreset = {
        id: "outlet-face",
        create: (c) => ({ ...waterComparisonPreset("wet").create(c), outlet }),
      };
      await compare(`outlet/${outlet.x}/${outlet.y}`, config, preset);
    });
  }
  it("agrees after public raise, dig and harden edits in the initial preset", async (context) => {
    if (!available) context.skip();
    const config = resolveTerrainConfig(WATER_COMPARISON_CONFIG);
    const preset: TerrainPreset = {
      id: "brush-edited-water",
      create: (c) => {
        const state = waterComparisonPreset("wet").create(c);
        applyBrush(state, { kind: "raise", at: { xM: 25, yM: 25 }, radiusM: 20, heightM: 1 }, config);
        applyBrush(state, { kind: "dig", at: { xM: 55, yM: 45 }, radiusM: 20, depthM: 1 }, config);
        applyBrush(state, { kind: "harden", at: { xM: 35, yM: 35 }, radiusM: 20, hardness: 0.8 }, config);
        return state;
      },
    };
    await compare(preset.id, config, preset);
  });
  it("agrees on the real 128 squared plateau with its declared spring", async (context) => {
    if (!available) context.skip();
    const config = resolveTerrainConfig({ ...WATER_COMPARISON_CONFIG, gridSize: 128 });
    await compare(
      "tilted-plateau/128/spring",
      config,
      tiltedPlateauPreset,
      80,
      tiltedPlateauPreset.layout(config).source,
    );
  });
  it("replays bitwise on one device and coalesces bounded same-version snapshots", async (context) => {
    if (!available) context.skip();
    const config = resolveTerrainConfig(WATER_COMPARISON_CONFIG),
      preset = waterComparisonPreset("wet");
    const a = await compare("determinism-first", config, preset);
    const gpu = await createGpuWaterSolver(config, preset.create(config));
    try {
      await gpu.step(80);
      const first = gpu.sample(0)!;
      expect(gpu.sample(0)).toBeNull();
      expect(gpu.snapshot()).toBe(first);
      const b = await first;
      expect(gpu.sample(499)).toBeNull();
      expect(new Uint32Array(a.waterM.buffer)).toEqual(new Uint32Array(b.waterM.buffer));
      expect(new Uint32Array(a.fluxM3PerS.buffer)).toEqual(new Uint32Array(b.fluxM3PerS.buffer));
      expect(new Uint32Array(a.velocityYMPerS.buffer)).toEqual(new Uint32Array(b.velocityYMPerS.buffer));
      const next = gpu.sample(500)!;
      const stepping = gpu.step(1);
      const before = await next;
      await stepping;
      expect(before.step).toBe(80);
      expect((await gpu.snapshot()).step).toBe(81);
      evidence.sameDeviceBitwise = true;
      evidence.atomicBoundedReadback = true;
    } finally {
      await gpu.dispose();
    }
  });
  it("halts before committing a deep-water wave-guard violation", async (context) => {
    if (!available) context.skip();
    const config = resolveTerrainConfig(WATER_COMPARISON_CONFIG);
    const preset: TerrainPreset = {
      id: "deep-water-guard",
      create: (c) => {
        const s = waterComparisonPreset("wet").create(c);
        s.layers.waterM.fill(1e6);
        return s;
      },
    };
    const cpu = createCpuSolver(config, preset),
      gpu = await createGpuWaterSolver(config, preset.create(config));
    try {
      const before = await gpu.snapshot();
      expect(() => cpu.step()).toThrow(/wave/i);
      await expect(gpu.step(4)).rejects.toThrow(/wave-guard/);
      const after = await gpu.snapshot();
      expect(after.step).toBe(0);
      expect(after.waterM).toEqual(before.waterM);
      expect(after.fluxM3PerS).toEqual(before.fluxM3PerS);
      await expect(gpu.step()).rejects.toThrow(/halted/);
      evidence.guardRejectsWithoutCommit = true;
    } finally {
      cpu.dispose();
      await gpu.dispose();
    }
  });
  it("preserves cumulative sub-ulp elevation increments against a float64 reference", async (context) => {
    if (!available) context.skip();
    const config = resolveTerrainConfig(WATER_COMPARISON_CONFIG);
    const preset: TerrainPreset = {
      id: "high-datum-precision",
      create: (c) => {
        const s = waterComparisonPreset("wet").create(c);
        s.layers.bedrockM.fill(100_000);
        return s;
      },
    };
    const cpu = createCpuSolver(config, preset),
      gpu = await createGpuWaterSolver(config, preset.create(config));
    try {
      const reference = cpu.referenceLayers().bedrockM;
      const delta = new Float32Array(config.gridSize ** 2);
      delta[27] = -1e-7;
      for (let i = 0; i < 4096; i++) reference[27] += delta[27];
      await gpu.addElevationChange(delta, 4096);
      const snapshot = await gpu.snapshot();
      expect(Math.fround(100_000 + delta[27])).toBe(100_000);
      expect(Math.abs(snapshot.groundM[27] - reference[27])).toBeLessThan(1e-7);
      expect(Math.abs(snapshot.elevationChangeM[27] - delta[27] * 4096)).toBeLessThan(1e-9);
      await gpu.step(1);
      const after = await gpu.snapshot();
      expect(after.fluxM3PerS.some((q) => q > 0)).toBe(true);
      evidence.precision = {
        increments: 4096,
        incrementM: delta[27],
        cpuFloat64M: reference[27],
        gpuReconstructedM: snapshot.groundM[27],
        gpuChangeM: snapshot.elevationChangeM[27],
        limitation: "Tests the elevation accumulator, not the full erosion process (4A)",
      };
    } finally {
      cpu.dispose();
      await gpu.dispose();
    }
  });
  it("profiles guarded real water batches and full atomic snapshot readback at 128 squared", async (context) => {
    if (!available) context.skip();
    const config = resolveTerrainConfig({ ...WATER_COMPARISON_CONFIG, gridSize: 128 });
    const gpu = await createGpuWaterSolver(config, waterComparisonPreset("wet").create(config));
    try {
      await gpu.step(5);
      const start = performance.now();
      await gpu.step(80);
      const msPerStep = (performance.now() - start) / 80;
      const read = performance.now();
      const a: WaterSnapshot = await gpu.snapshot();
      const readbackMs = performance.now() - read;
      expect(a.step).toBe(85);
      evidence.performance = {
        gridSize: 128,
        steps: 80,
        msPerStep,
        readbackMs,
        includes:
          "dispatch, fixed-tree guards, GPU completion and one small status read; excludes compilation warmup",
      };
    } finally {
      await gpu.dispose();
    }
  });
});
