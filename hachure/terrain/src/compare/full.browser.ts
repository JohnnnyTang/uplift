import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { server } from "vitest/browser";
import {
  createCpuSolver,
  resolveTerrainConfig,
  waterComparisonPreset,
  WATER_COMPARISON_CONFIG,
  tiltedPlateauPreset,
  DRY_DEPTH_M,
  type TerrainConfig,
  type TerrainPreset,
} from "../index";
import { createGpuTerrainSolver } from "../gpu/index";
import { compareFields, WATER_TOLERANCES } from "./fields";
const evidence: Record<string, unknown> = {
  scope:
    "Complete process solver engineering comparison; no field calibration or classroom performance claim",
  cases: [],
};
let available = false;
beforeAll(async () => {
  const adapter = await navigator.gpu?.requestAdapter();
  available = !!adapter;
  evidence.utc = new Date().toISOString();
  evidence.userAgent = navigator.userAgent;
  evidence.adapter = adapter
    ? {
        vendor: adapter.info.vendor,
        architecture: adapter.info.architecture,
        device: adapter.info.device,
        description: adapter.info.description,
        isFallbackAdapter: adapter.info.isFallbackAdapter,
      }
    : null;
  evidence.capability = available ? "available" : "SKIPPED: WebGPU adapter unavailable";
});
afterAll(async () => {
  await server.commands.writeFile(
    "src/compare/full-results-local.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
});
async function run(config: TerrainConfig, preset: TerrainPreset, steps = 80, spring = false) {
  const cpu = createCpuSolver(config, preset),
    gpu = await createGpuTerrainSolver(config, preset);
  try {
    if (spring) {
      const op = tiltedPlateauPreset.layout(config).source;
      await cpu.applyTool(op);
      await gpu.applyTool(op);
    }
    cpu.step(steps);
    await gpu.step(steps);
    const expected = await cpu.snapshot(),
      actual = await gpu.snapshot(),
      ref = cpu.referenceLayers(),
      raw = await gpu.referenceLayers();
    const checks: Record<string, unknown> = {};
    for (const name of Object.keys(expected.layers) as (keyof typeof expected.layers)[]) {
      const tolerance =
        name === "bedrockM"
          ? { absolute: 2e-5, relative: 2e-7 }
          : name === "hardness"
            ? { absolute: 0, relative: 0 }
            : name.includes("velocity")
              ? WATER_TOLERANCES.velocityMPerS
              : name.includes("flux")
                ? WATER_TOLERANCES.fluxM3PerS
                : WATER_TOLERANCES.waterM;
      const check = compareFields(actual.layers[name]!, expected.layers[name]!, tolerance);
      checks[name] = check;
      expect(check.failed, `${name} ${JSON.stringify(check)}`).toBe(0);
    }
    expect(compareFields(raw.bedrockM, ref.bedrockM, { absolute: 2e-6, relative: 1e-8 }).failed).toBe(0);
    expect(actual.step).toBe(steps);
    for (const key of Object.keys(expected.budget) as (keyof typeof expected.budget)[])
      expect(actual.budget[key], key).toBeCloseTo(expected.budget[key], 3);
    (evidence.cases as unknown[]).push({ preset: preset.id, config, steps, checks, budget: actual.budget });
    return actual;
  } finally {
    cpu.dispose();
    await gpu.dispose();
  }
}
describe("Full GPU process solver [requires-webgpu]", () => {
  for (const kind of ["dry", "wet", "front"] as const)
    it(`agrees for ${kind}`, async (context) => {
      if (!available) context.skip();
      await run(
        resolveTerrainConfig({
          ...WATER_COMPARISON_CONFIG,
          capacityCoefficient: 0.01,
          erosionRatePerS: 0.5,
          depositionRatePerS: 1,
          thermalRatePerS: 0.1,
          evaporationFractionPerStep: 0.0001,
        }),
        waterComparisonPreset(kind),
      );
    });
  it("agrees for the 256 squared real plateau and declared spring", async (context) => {
    if (!available) context.skip();
    await run(
      resolveTerrainConfig({ gridSize: 256, metresPerCell: 5, pipeAreaM2: 5, seed: 123 }),
      tiltedPlateauPreset,
      80,
      true,
    );
  });
  it("agrees for real plateau", async (context) => {
    if (!available) context.skip();
    await run(resolveTerrainConfig({ gridSize: 128 }), tiltedPlateauPreset);
  });
});

const fullConfig = () =>
  resolveTerrainConfig({
    ...WATER_COMPARISON_CONFIG,
    capacityCoefficient: 0.01,
    erosionRatePerS: 0.5,
    depositionRatePerS: 1,
    thermalRatePerS: 0.1,
    evaporationFractionPerStep: 0.0001,
  });
function activePreset(): TerrainPreset {
  return {
    id: "active-process-engineering-fixture",
    create(c) {
      const s = waterComparisonPreset("wet").create(c),
        n = c.gridSize;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const i = y * n + x;
          s.layers.sedimentM[i] = x === 3 && y === 3 ? 20 : 0.002;
          s.layers.suspendedSedimentM[i] = y === 2 ? 0.005 : 0;
          s.layers.hardness[i] = x === 4 ? 0.8 : 0.2;
        }
      return s;
    },
  };
}
const sum = (a: ArrayLike<number>) => Array.from(a).reduce((x, y) => x + y, 0);
function delta(a: ArrayLike<number>, b: ArrayLike<number>) {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += b[i] - a[i];
  return total;
}
describe("Full GPU conservation, tools and precision [requires-webgpu]", () => {
  it("compares active deposition, transport, thermal transfers and evaporation", async (context) => {
    if (!available) context.skip();
    await run(fullConfig(), activePreset(), 200);
  });
  it("closes solid and water budgets at every sample with sources and tools", async (context) => {
    if (!available) context.skip();
    const config = fullConfig(),
      gpu = await createGpuTerrainSolver(config, activePreset());
    try {
      await gpu.applyTool({ kind: "spring", id: "inflow", at: { xM: 25, yM: 15 }, flowM3PerS: 0.05 });
      const initial = await gpu.referenceLayers();
      const residuals = [];
      for (let k = 0; k < 10; k++) {
        await gpu.step(100);
        if (k === 3) await gpu.applyTool({ kind: "dig", at: { xM: 25, yM: 35 }, radiusM: 15, depthM: 0.1 });
        if (k === 6)
          await gpu.applyTool({ kind: "raise", at: { xM: 45, yM: 25 }, radiusM: 15, heightM: 0.1 });
        const current = await gpu.referenceLayers(),
          budget = await gpu.budget(),
          area = config.metresPerCell ** 2;
        const solid =
          area *
            (delta(initial.bedrockM, current.bedrockM) +
              delta(initial.sedimentM, current.sedimentM) +
              delta(initial.suspendedSedimentM, current.suspendedSedimentM)) +
          budget.exportedSedimentM3 -
          budget.toolNetM3;
        const water =
          area * delta(initial.waterM, current.waterM) -
          budget.rainedWaterM3 -
          budget.sourcedWaterM3 +
          budget.evaporatedWaterM3 +
          budget.outflowedWaterM3;
        const solidRef = Math.max(
          budget.erodedM3,
          sum(initial.suspendedSedimentM) * area,
          budget.exportedSedimentM3,
          Math.abs(budget.toolNetM3),
        );
        const waterRef = Math.max(sum(initial.waterM) * area, budget.rainedWaterM3 + budget.sourcedWaterM3);
        expect(Math.abs(solid)).toBeLessThanOrEqual(Math.max(1e-6, 0.01 * solidRef));
        expect(Math.abs(water)).toBeLessThanOrEqual(Math.max(1e-6, 0.01 * waterRef));
        residuals.push({ step: (k + 1) * 100, solid, water, solidRef, waterRef });
      }
      evidence.massBudget = residuals;
    } finally {
      await gpu.dispose();
    }
  });
  it("preserves sub-ulp cumulative erosion against CPU float64", async (context) => {
    if (!available) context.skip();
    const config = resolveTerrainConfig({
      ...fullConfig(),
      rainMmPerHr: 0,
      capacityCoefficient: 0.00001,
      depositionRatePerS: 0,
      thermalRatePerS: 0,
      evaporationFractionPerStep: 0,
    });
    const preset: TerrainPreset = {
      id: "tiny-erosion-high-datum",
      create(c) {
        const s = waterComparisonPreset("wet").create(c);
        for (let i = 0; i < c.gridSize ** 2; i++) s.layers.bedrockM[i] += 100000;
        return s;
      },
    };
    const cpu = createCpuSolver(config, preset),
      gpu = await createGpuTerrainSolver(config, preset);
    try {
      const before = cpu.referenceLayers();
      cpu.step(4096);
      await gpu.step(4096);
      const expected = cpu.referenceLayers(),
        actual = await gpu.referenceLayers();
      const check = compareFields(actual.bedrockM, expected.bedrockM, { absolute: 1e-8, relative: 0 });
      expect(check.failed, JSON.stringify(check)).toBe(0);
      const changes = Array.from(expected.bedrockM, (v, i) => v - before.bedrockM[i]);
      expect(changes.some((v) => v < -1e-8)).toBe(true);
      expect(-Math.min(...Array.from(actual.bedrockM, (v, i) => v - before.bedrockM[i]))).toBeGreaterThan(
        -Math.min(...changes) * 0.95,
      );
      expect(changes.every((v) => Math.abs(v) < 0.0078125)).toBe(true);
      evidence.cumulativeTinyErosion = {
        steps: 4096,
        maxIncisionM: -Math.min(...changes),
        float32UlpM: 0.0078125,
        check,
      };
    } finally {
      cpu.dispose();
      await gpu.dispose();
    }
  });
  it("repeats every layer and reduced budget bitwise with tools and configuration", async (context) => {
    if (!available) context.skip();
    const config = fullConfig();
    const replay = async () => {
      const gpu = await createGpuTerrainSolver(config, activePreset());
      try {
        await gpu.step(30);
        await gpu.applyTool({ kind: "harden", at: { xM: 35, yM: 35 }, radiusM: 15, hardness: 0.6 });
        await gpu.applyTool({ kind: "smooth", at: { xM: 35, yM: 35 }, radiusM: 15, strength: 0.01 });
        gpu.configure({ rainMmPerHr: 20 });
        await gpu.step(50);
        const snapshot = await gpu.snapshot();
        return { snapshot, reference: await gpu.referenceLayers(), hash: await gpu.hash() };
      } finally {
        await gpu.dispose();
      }
    };
    const a = await replay(),
      b = await replay();
    expect(a.hash).toBe(b.hash);
    expect(a.snapshot.budget).toEqual(b.snapshot.budget);
    expect(a.reference).toEqual(b.reference);
    expect(a.snapshot.step).toBe(80);
    evidence.sameDeviceFullReplay = { hash: a.hash, budget: a.snapshot.budget };
  });
  it("rejects an invalid candidate atomically including solids, split lanes and budgets", async (context) => {
    if (!available) context.skip();
    const config = fullConfig(),
      preset: TerrainPreset = {
        id: "full-guard-fixture",
        create(c) {
          const s = activePreset().create(c);
          s.layers.waterM.fill(1e6);
          return s;
        },
      };
    const gpu = await createGpuTerrainSolver(config, preset);
    try {
      const before = await gpu.snapshot(),
        reference = await gpu.referenceLayers();
      await expect(gpu.step(4)).rejects.toThrow(/wave/);
      const after = await gpu.snapshot();
      expect(after.layers).toEqual(before.layers);
      expect(after.budget).toEqual(before.budget);
      expect(await gpu.referenceLayers()).toEqual(reference);
      expect(after.step).toBe(0);
      await expect(gpu.step()).rejects.toThrow(/halt/);
      expect(gpu.stepCount).toBe(after.step);
      gpu.reset(waterComparisonPreset("wet"), config.seed);
      await gpu.step();
      expect((await gpu.snapshot()).step).toBe(1);
      evidence.fullGuardAtomic = true;
    } finally {
      await gpu.dispose();
    }
  });
  it("serializes and coalesces snapshots before queued mutations", async (context) => {
    if (!available) context.skip();
    const gpu = await createGpuTerrainSolver(fullConfig(), activePreset());
    try {
      await gpu.step(3);
      const first = gpu.sample(0)!;
      expect(gpu.snapshot()).toBe(first);
      expect(gpu.sample(500)).toBeNull();
      const next = gpu.step(2);
      expect((await first).step).toBe(3);
      await next;
      expect((await gpu.sample(500)!).step).toBe(5);
      expect(gpu.sample(999)).toBeNull();
      evidence.fullAtomicSnapshot = true;
    } finally {
      await gpu.dispose();
    }
  });
});

import { selectTerrainBackend, TERRAIN_BACKENDS } from "../../../runtime/src/sim-host/backend/index";
import { WorkerTransport } from "../../../runtime/src/sim-host/transport";
import { type ToolOp } from "../index";
describe("Real backend transports [requires-webgpu]", () => {
  for (const tier of TERRAIN_BACKENDS)
    it(`initializes forced ${tier} on its declared grid/domain`, async (context) => {
      if (tier === "webgpu" && !available) context.skip();
      const selected = await selectTerrainBackend({
        search: `?backend=${tier}`,
        createWorkerTransport: () =>
          new WorkerTransport(
            new Worker(new URL("../../../runtime/src/sim-host/backend/worker.ts", import.meta.url), {
              type: "module",
            }),
          ),
      });
      try {
        expect(selected.backend, JSON.stringify(selected.failures)).toBe(tier);
        expect(selected.initialSample.snapshot.gridSize).toBe(
          tier === "webgpu" ? 256 : tier === "cpu-worker" ? 128 : 64,
        );
        expect(selected.config.gridSize * selected.config.metresPerCell).toBe(1280);
        expect(selected.initialSample.calibration.status).toBe("pending");
        expect(selected.initialSample.snapshot.step).toBe(0);
        if (selected.transport) {
          const init = await selected.transport.request({ kind: "init", config: selected.config });
          expect(init.sample!.snapshot.step).toBe(0);
          const next = await selected.transport.request({ kind: "advance", steps: 20, sample: true });
          expect(next.sample!.snapshot.step).toBe(20);
          expect(next.sample!.config).toEqual(selected.config);
        }
        const records = (evidence.backendTransports ??= []) as unknown[];
        records.push({
          backend: tier,
          gridSize: selected.config.gridSize,
          metresPerCell: selected.config.metresPerCell,
          pipeAreaM2: selected.config.pipeAreaM2,
          failures: selected.failures,
        });
      } finally {
        selected.transport?.dispose();
      }
    });
  it("agrees with CPU after every shared tool, changing parameters and source replacement", async (context) => {
    if (!available) context.skip();
    const config = fullConfig(),
      preset = waterComparisonPreset("wet"),
      cpu = createCpuSolver(config, preset),
      gpu = await createGpuTerrainSolver(config, preset);
    const ops: ToolOp[] = [
      { kind: "raise", at: { xM: 25, yM: 35 }, radiusM: 15, heightM: 0.1 },
      { kind: "dig", at: { xM: 35, yM: 35 }, radiusM: 15, depthM: 0.1 },
      { kind: "smooth", at: { xM: 35, yM: 35 }, radiusM: 15, strength: 0.2 },
      { kind: "harden", at: { xM: 35, yM: 35 }, radiusM: 15, hardness: 0.6 },
      { kind: "spring", id: "replace", at: { xM: 25, yM: 15 }, flowM3PerS: 0.05 },
      { kind: "rain-source", id: "replace", at: { xM: 25, yM: 15 }, radiusM: 15, rainMmPerHr: 10 },
      { kind: "remove-source", id: "replace" },
    ];
    try {
      for (const op of ops) {
        const a = await cpu.applyTool(op),
          b = await gpu.applyTool(op);
        expect(b.applied).toBe(a.applied);
        expect(b.clamped).toEqual(a.clamped);
        expect(b.volumeChangeM3).toBeCloseTo(a.volumeChangeM3, 4);
        cpu.step(10);
        await gpu.step(10);
      }
      cpu.configure({ rainMmPerHr: 20 });
      gpu.configure({ rainMmPerHr: 20 });
      cpu.configure({ capacityCoefficient: 0.02 });
      gpu.configure({ capacityCoefficient: 0.02 });
      expect(gpu.config.rainMmPerHr).toBe(20);
      cpu.step(40);
      await gpu.step(40);
      const a = await cpu.snapshot(),
        b = await gpu.snapshot();
      expect(b.step).toBe(a.step);
      for (const name of Object.keys(a.layers) as (keyof typeof a.layers)[])
        expect(
          compareFields(b.layers[name]!, a.layers[name]!, { absolute: 3e-5, relative: 5e-4 }).failed,
          name,
        ).toBe(0);
      expect(b.budget.toolNetM3).toBeCloseTo(a.budget.toolNetM3, 3);
      evidence.toolsAndConfigure = true;
    } finally {
      cpu.dispose();
      await gpu.dispose();
    }
  });
});

it("keeps coalescing within a mutation sequence and observes queued changes", async (context) => {
  if (!available) context.skip();
  const config = fullConfig(),
    gpu = await createGpuTerrainSolver(config, waterComparisonPreset("wet"));
  try {
    const first = gpu.snapshot();
    expect(gpu.snapshot()).toBe(first);
    const advancing = gpu.step(1),
      after = gpu.snapshot();
    expect(after).not.toBe(first);
    expect((await first).step).toBe(0);
    await advancing;
    expect((await after).step).toBe(1);
    const beforeTool = gpu.snapshot();
    const edit = gpu.applyTool({ kind: "raise", at: { xM: 25, yM: 25 }, radiusM: 15, heightM: 0.1 });
    const afterTool = gpu.snapshot();
    expect(afterTool).not.toBe(beforeTool);
    await edit;
    expect((await afterTool).budget.toolNetM3).toBeGreaterThan((await beforeTool).budget.toolNetM3);
    const beforeConfigure = gpu.snapshot();
    gpu.configure({ rainMmPerHr: 20 });
    const afterConfigure = gpu.snapshot();
    expect(afterConfigure).not.toBe(beforeConfigure);
    await afterConfigure;
    const beforeReset = gpu.snapshot();
    gpu.reset(waterComparisonPreset("wet"), config.seed);
    const afterReset = gpu.snapshot();
    expect(afterReset).not.toBe(beforeReset);
    expect((await afterReset).step).toBe(0);
    evidence.mutationSequenceSnapshots = true;
  } finally {
    await gpu.dispose();
  }
});
it("preserves tiny elevation and loose-layer changes across configure and untouched tool cells", async (context) => {
  if (!available) context.skip();
  const config = resolveTerrainConfig({
      ...fullConfig(),
      capacityCoefficient: 0.00001,
      depositionRatePerS: 0,
      thermalRatePerS: 0,
      evaporationFractionPerStep: 0,
    }),
    preset: TerrainPreset = {
      id: "precision-reconfiguration",
      create(c) {
        const s = waterComparisonPreset("wet").create(c);
        for (let i = 0; i < c.gridSize ** 2; i++) {
          s.layers.bedrockM[i] += 100000;
          s.layers.sedimentM[i] = i % 2 ? 0.7 : 0;
        }
        return s;
      },
    };
  const gpu = await createGpuTerrainSolver(config, preset);
  try {
    await gpu.step(2048);
    const before = await gpu.referenceLayers(),
      budget = await gpu.budget();
    gpu.configure({ rainMmPerHr: 20 });
    await gpu.snapshot();
    const configured = await gpu.referenceLayers();
    expect(compareFields(configured.bedrockM, before.bedrockM, { absolute: 1e-10, relative: 0 }).failed).toBe(
      0,
    );
    expect(
      compareFields(configured.sedimentM, before.sedimentM, { absolute: 1e-12, relative: 0 }).failed,
    ).toBe(0);
    expect(await gpu.budget()).toEqual(budget);
    await gpu.applyTool({ kind: "harden", at: { xM: 25, yM: 25 }, radiusM: 15, hardness: 0.8 });
    const edited = await gpu.referenceLayers();
    expect(edited.bedrockM).toEqual(configured.bedrockM);
    expect(edited.sedimentM).toEqual(configured.sedimentM);
    evidence.precisionAcrossReconfigureAndTool = true;
  } finally {
    await gpu.dispose();
  }
});

it("closes a zero-throughput run exactly", async (context) => {
  if (!available) context.skip();
  const config = resolveTerrainConfig({
      ...fullConfig(),
      rainMmPerHr: 0,
      capacityCoefficient: 0,
      thermalRatePerS: 0,
      evaporationFractionPerStep: 0,
    }),
    gpu = await createGpuTerrainSolver(config, waterComparisonPreset("dry"));
  try {
    const before = await gpu.referenceLayers();
    await gpu.step(400);
    expect(await gpu.referenceLayers()).toEqual(before);
    expect(Object.values(await gpu.budget()).every((v) => v === 0)).toBe(true);
    evidence.zeroThroughputMass = true;
  } finally {
    await gpu.dispose();
  }
});
it("agrees when evaporation strands all suspended material", async (context) => {
  if (!available) context.skip();
  const config = resolveTerrainConfig({ ...fullConfig(), rainMmPerHr: 0, thermalRatePerS: 0 }),
    preset: TerrainPreset = {
      id: "stranded-sediment-engineering-fixture",
      create(c) {
        const s = waterComparisonPreset("dry").create(c);
        s.layers.waterM.fill(DRY_DEPTH_M * 0.5);
        s.layers.suspendedSedimentM.fill(0.001);
        return s;
      },
    };
  const result = await run(config, preset, 1);
  expect(result.budget.suspendedM3).toBe(0);
  expect(result.budget.depositedM3).toBeGreaterThan(0);
});
it("compares full processes on an odd grid and each outlet face", async (context) => {
  if (!available) context.skip();
  const config = resolveTerrainConfig({ ...fullConfig(), gridSize: 9 });
  for (const outlet of [
    { x: 0, y: 4 },
    { x: 8, y: 4 },
    { x: 4, y: 0 },
    { x: 8, y: 8 },
  ])
    await run(
      config,
      {
        id: `full-outlet-${outlet.x}-${outlet.y}`,
        create(c) {
          return { ...activePreset().create(c), outlet };
        },
      },
      40,
    );
});

it("profiles the complete guarded 256 squared solver and atomic readback", async (context) => {
  if (!available) context.skip();
  const config = resolveTerrainConfig({ gridSize: 256, metresPerCell: 5, pipeAreaM2: 5 }),
    gpu = await createGpuTerrainSolver(config, tiltedPlateauPreset);
  try {
    await gpu.applyTool(tiltedPlateauPreset.layout(config).source);
    await gpu.step(5);
    const start = performance.now();
    await gpu.step(80);
    const msPerStep = (performance.now() - start) / 80,
      read = performance.now(),
      snapshot = await gpu.snapshot(),
      readbackMs = performance.now() - read;
    expect(snapshot.step).toBe(85);
    evidence.fullPerformance = {
      gridSize: 256,
      steps: 80,
      msPerStep,
      readbackMs,
      scope:
        "Headless real preset + spring, dispatch/guards/completion; excludes rendering, compilation warmup and classroom thermal/power conditions",
    };
  } finally {
    await gpu.dispose();
  }
});

it("rejects invalid tool input without halting accepted simulation state", async (context) => {
  if (!available) context.skip();
  const config = fullConfig(),
    gpu = await createGpuTerrainSolver(config, waterComparisonPreset("wet"));
  try {
    const before = await gpu.hash();
    await expect(
      gpu.applyTool({ kind: "spring", id: "bad", at: { xM: 25, yM: 25 }, flowM3PerS: NaN }),
    ).rejects.toThrow(/finite/);
    expect(await gpu.hash()).toBe(before);
    await gpu.step();
    expect((await gpu.snapshot()).step).toBe(1);
  } finally {
    await gpu.dispose();
  }
});

it("matches CPU fixed dt policy after accepted and enqueued steps, allowing changes at reset", async (context) => {
  if (!available) context.skip();
  const config = resolveTerrainConfig({ ...fullConfig(), evaporationFractionPerStep: 0 }),
    preset = waterComparisonPreset("wet"),
    cpu = createCpuSolver(config, preset),
    gpu = await createGpuTerrainSolver(config, preset);
  try {
    cpu.configure({ dtSimSeconds: 0.025 });
    gpu.configure({ dtSimSeconds: 0.025 });
    await gpu.snapshot();
    expect(gpu.config.dtSimSeconds).toBe(cpu.config.dtSimSeconds);
    cpu.configure({ dtSimSeconds: 0.05 });
    gpu.configure({ dtSimSeconds: 0.05 });
    cpu.step();
    const enqueued = gpu.step();
    for (const solver of [cpu, gpu])
      expect(() => solver.configure({ dtSimSeconds: 0.025 })).toThrow(/fixed per run/);
    expect(gpu.config.dtSimSeconds).toBe(0.05);
    await enqueued;
    expect(() => gpu.configure({ dtSimSeconds: 0.025 })).toThrow(/fixed per run/);
    cpu.reset(preset, config.seed);
    gpu.reset(preset, config.seed);
    cpu.configure({ dtSimSeconds: 0.025 });
    gpu.configure({ dtSimSeconds: 0.025 });
    cpu.step(20);
    await gpu.step(20);
    const a = await cpu.snapshot(),
      b = await gpu.snapshot();
    expect(b.step).toBe(20);
    expect(b.simYears).toBeCloseTo(a.simYears, 12);
    for (const name of Object.keys(a.layers) as (keyof typeof a.layers)[])
      expect(
        compareFields(b.layers[name]!, a.layers[name]!, { absolute: 2e-5, relative: 5e-4 }).failed,
        name,
      ).toBe(0);
    evidence.fixedDtPolicy = true;
  } finally {
    cpu.dispose();
    await gpu.dispose();
  }
});
it("captures queued brush and source requests before callers reuse their objects", async (context) => {
  if (!available) context.skip();
  const config = fullConfig(),
    preset = waterComparisonPreset("wet"),
    cpu = createCpuSolver(config, preset),
    gpu = await createGpuTerrainSolver(config, preset);
  try {
    cpu.step(20);
    const advancing = gpu.step(20);
    const brush = { kind: "raise" as const, at: { xM: 25, yM: 25 }, radiusM: 15, heightM: 0.1 };
    const a = cpu.applyTool(brush),
      b = gpu.applyTool(brush);
    brush.at.xM = 1e6;
    brush.at.yM = 1e6;
    brush.radiusM = 100;
    brush.heightM = 5;
    await advancing;
    expect(await b).toEqual(await a);
    const spring = {
      kind: "spring" as const,
      id: "captured-source",
      at: { xM: 25, yM: 15 },
      flowM3PerS: 0.05,
    };
    const c = cpu.applyTool(spring),
      d = gpu.applyTool(spring);
    spring.id = "mutated-source";
    spring.at.xM = 1e6;
    spring.flowM3PerS = 5;
    expect(await d).toEqual(await c);
    cpu.step(20);
    await gpu.step(20);
    const expected = await cpu.snapshot(),
      actual = await gpu.snapshot();
    for (const name of Object.keys(expected.layers) as (keyof typeof expected.layers)[])
      expect(
        compareFields(actual.layers[name]!, expected.layers[name]!, { absolute: 2e-5, relative: 5e-4 })
          .failed,
        name,
      ).toBe(0);
    expect(actual.budget.sourcedWaterM3).toBeCloseTo(expected.budget.sourcedWaterM3, 5);
    evidence.queuedToolCapture = true;
  } finally {
    cpu.dispose();
    await gpu.dispose();
  }
});

it("keeps a reset's queued step count when an earlier failed run finishes rejecting", async (context) => {
  if (!available) context.skip();
  const config = fullConfig(),
    bad: TerrainPreset = {
      id: "queued-recovery-guard",
      create(c) {
        const s = waterComparisonPreset("wet").create(c);
        s.layers.waterM.fill(1e6);
        return s;
      },
    },
    gpu = await createGpuTerrainSolver(config, bad);
  try {
    const failed = gpu.step(4);
    gpu.reset(waterComparisonPreset("wet"), config.seed);
    const recovered = gpu.step(2);
    expect(gpu.stepCount).toBe(2);
    await expect(failed).rejects.toThrow(/wave/);
    await recovered;
    const snapshot = await gpu.snapshot();
    expect(snapshot.step).toBe(2);
    expect(gpu.stepCount).toBe(snapshot.step);
    evidence.queuedResetCounterRecovery = true;
  } finally {
    await gpu.dispose();
  }
});
