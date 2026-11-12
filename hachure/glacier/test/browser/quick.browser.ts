/**
 * Default GPU glacier suite (`pnpm --filter @hachure/glacier test:gpu`), session 5I.
 *
 * Real WebGPU in headless Chrome. Covers: the early-interval CPU/GPU comparison (tolerances.md G7, with G1,
 * G3, G4) for every shipped rock; same-device determinism and on-device two-lane precision (G8); and every
 * forced fallback path (G9). An unavailable adapter skips the GPU tests explicitly and records the skip; a
 * skip is never parity. The registered-horizon comparison is `registered.browser.ts` (GLACIER_GPU_FULL=1).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ROCK_IDS } from "../../src/contract/rocks";
import { createCpuGlacier } from "../../src/cpu/index";
import {
  DEVICE_CHECK_MAX_DIFF_M,
  DF_WGSL,
  GLACIER_GPU_PARITY,
  GPU_GLACIER_TOLERANCES as TOL,
  GlacierGpuError,
  checkGlacierGpuDevice,
  checkRecord,
  createGpuGlacier,
  fieldDifference,
  fieldPass,
  restartOnCpu,
  selectGlacierBackend,
  speedField,
} from "../../src/gpu/index";
import {
  advanceCpu,
  adapterEvidence,
  recordableCpu,
  recordableGpu,
  seriesEntry,
  writeEvidence,
} from "./harness";

const evidence: Record<string, unknown> = {
  scope:
    "Session 5I default suite: early-interval CPU/GPU comparison (G7, G1, G3, G4), determinism and precision (G8), fallback (G9). Engineering evidence on this development machine; not classroom hardware.",
  tolerances: "docs/review/glacial/gpu/tolerances.md",
  cases: {} as Record<string, unknown>,
};
const cases = evidence.cases as Record<string, unknown>;
let available = false;

beforeAll(async () => {
  const cap = await adapterEvidence();
  available = cap.available;
  Object.assign(evidence, cap);
});
afterAll(async () => {
  await writeEvidence("results-quick-local.json", evidence);
});

describe("early interval: CPU and GPU agree on every shipped rock (G7, G1, G3, G4)", () => {
  for (const rockId of ROCK_IDS) {
    it(`${rockId}: ${TOL.earlyYears} model years`, async (ctx) => {
      if (!available) ctx.skip();
      const cpu = createCpuGlacier({ rockId });
      const gpu = await createGpuGlacier({ rockId });
      try {
        const steps = Math.round(TOL.earlyYears / cpu.config.dtYears);
        const cpuMs = await advanceCpu(cpu, steps);
        const t0 = performance.now();
        await gpu.advance(steps);
        const gpuMs = performance.now() - t0;
        expect(gpu.step).toBe(steps);
        const f = await gpu.fields();
        const cs = cpu.snapshot();
        const gs = await gpu.snapshot();
        const fields = {
          bedM: fieldDifference(f.bedM, cpu.fields.bedM),
          iceThicknessM: fieldDifference(f.iceThicknessM, cpu.fields.iceThicknessM),
          surfaceSpeedMPerYear: fieldDifference(
            speedField(gs.surfaceVelocityXMPerYear, gs.surfaceVelocityYMPerYear),
            speedField(cs.surfaceVelocityXMPerYear, cs.surfaceVelocityYMPerYear),
          ),
        };
        const a = await seriesEntry(recordableGpu(gpu));
        const b = await seriesEntry(recordableCpu(cpu));
        const probes = checkRecord({ ...a.probes }, { ...b.probes }, TOL.probes);
        const budget = checkRecord({ ...a.budget }, { ...b.budget }, TOL.budget);
        const closure =
          Math.abs(a.budget.residualM3) <=
          TOL.closureRel * (Math.abs(a.budget.surfaceMassBalanceM3) + Math.abs(a.budget.edgeOutflowM3)) +
            TOL.closureAbsM3;
        const sections = Object.fromEntries(
          Object.keys(a.sections).map((k) => [
            k,
            checkRecord({ ...a.sections[k]! }, { ...b.sections[k]! }, TOL.sections),
          ]),
        );
        const fieldGate = Object.fromEntries(
          (Object.keys(fields) as (keyof typeof fields)[]).map((k) => [
            k,
            fieldPass(fields[k], TOL.fields[k], TOL.earlyFactor),
          ]),
        );
        cases[`early-${rockId}`] = {
          years: TOL.earlyYears,
          steps,
          fields,
          fieldGate,
          probes,
          budget,
          closure: { residualM3: a.budget.residualM3, pass: closure },
          sections,
          cpuMsPerModelYear: cpuMs / TOL.earlyYears,
          gpuMsPerModelYear: gpuMs / TOL.earlyYears,
          diagnostics: { cpu: b.diagnostics, gpu: a.diagnostics },
        };
        for (const [k, pass] of Object.entries(fieldGate))
          expect(pass, `${k} ${JSON.stringify(fields)}`).toBe(true);
        for (const [k, c] of Object.entries(probes))
          expect(c.pass, `probe ${k} ${JSON.stringify(c)}`).toBe(true);
        for (const [k, c] of Object.entries(budget))
          expect(c.pass, `budget ${k} ${JSON.stringify(c)}`).toBe(true);
        expect(closure, `closure ${a.budget.residualM3}`).toBe(true);
        for (const [s, rec] of Object.entries(sections))
          for (const [k, c] of Object.entries(rec))
            expect(c.pass, `${s}.${k} ${JSON.stringify(c)}`).toBe(true);
      } finally {
        await gpu.dispose();
      }
    });
  }
});

describe("determinism and precision (G8)", () => {
  it("same rock, config and backend on one device reproduce bitwise", async (ctx) => {
    if (!available) ctx.skip();
    const hashes: string[][] = [];
    for (let run = 0; run < 2; run++) {
      // Different submit chunking must not change results: scheduling only.
      const gpu = await createGpuGlacier(
        { rockId: "sandstone" },
        {},
        { stepsPerSubmit: run === 0 ? 200 : 37 },
      );
      try {
        await gpu.advance(2000);
        const h1 = await gpu.hash();
        await gpu.advanceYears(TOL.earlyYears - 5);
        hashes.push([h1, await gpu.hash()]);
      } finally {
        await gpu.dispose();
      }
    }
    cases.determinism = { hashes };
    expect(hashes[1]).toEqual(hashes[0]);
  });

  it("operations serialize: a read queued after an un-awaited advance sees that advance", async (ctx) => {
    if (!available) ctx.skip();
    const gpu = await createGpuGlacier({ rockId: "shale" });
    try {
      const before = await gpu.snapshot();
      const step = gpu.advance(25);
      const after = await gpu.snapshot();
      await step;
      expect(before.step).toBe(0);
      expect(after.step).toBe(25);
      expect((await gpu.probes()).step).toBe(25);
    } finally {
      await gpu.dispose();
    }
  });

  it("two-lane accumulation keeps sub-ulp increments that plain float32 loses", async (ctx) => {
    if (!available) ctx.skip();
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter!.requestDevice();
    try {
      const steps = 100_000;
      const start = 2000;
      const inc = Math.fround(-1e-6);
      const module = device.createShaderModule({
        code: `${DF_WGSL}
@group(0) @binding(0) var<storage, read_write> io: array<f32, 4>;
@compute @workgroup_size(1) fn main() {
  var lane = vec2<f32>(io[0], 0.0);
  var plain = io[0];
  let d = io[1];
  let n = u32(io[2]);
  for (var s = 0u; s < n; s = s + 1u) { lane = dfAdd(lane, d); plain = plain + d; }
  io[0] = lane.x; io[1] = lane.y; io[2] = plain;
}`,
      });
      const buffer = device.createBuffer({ size: 16, usage: 0x0080 | 0x0004 | 0x0008 });
      device.queue.writeBuffer(buffer, 0, new Float32Array([start, inc, steps, 0]));
      const pipeline = await device.createComputePipelineAsync({
        layout: "auto",
        compute: { module, entryPoint: "main" },
      });
      const bind = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer } }],
      });
      const staging = device.createBuffer({ size: 16, usage: 0x0001 | 0x0008 });
      const enc = device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bind);
      pass.dispatchWorkgroups(1);
      pass.end();
      enc.copyBufferToBuffer(buffer, 0, staging, 0, 16);
      device.queue.submit([enc.finish()]);
      await staging.mapAsync(0x0001);
      const [hi, lo, plain] = Array.from(new Float32Array(staging.getMappedRange().slice(0)));
      let exact = start;
      for (let s = 0; s < steps; s++) exact += inc;
      const sum = exact - start;
      const laneError = Math.abs(hi! + lo! - exact);
      const plainError = Math.abs(plain! - exact);
      cases.precision = {
        start,
        increment: inc,
        steps,
        exact,
        lane: hi! + lo!,
        plain,
        laneError,
        plainError,
      };
      expect(laneError).toBeLessThanOrEqual(1e-6 * Math.abs(sum));
      expect(plainError).toBeGreaterThan(0.5 * Math.abs(sum)); // plain float32 loses the change
    } finally {
      device.destroy();
    }
  });
});

describe("fallback is labelled and never reinterprets a run (G9)", () => {
  const passedParity = { ...GLACIER_GPU_PARITY, status: "passed" as const, autoSelectsGpu: true };

  it("the per-device kernel check passes here for every rock and rejects skewed kernels", async (ctx) => {
    if (!available) ctx.skip();
    const results: Record<string, unknown> = {};
    for (const rockId of ROCK_IDS) {
      const r = await checkGlacierGpuDevice(createCpuGlacier({ rockId }).config);
      results[rockId] = r;
      expect(r.pass, JSON.stringify(r)).toBe(true);
    }
    const skewed = await checkGlacierGpuDevice(createCpuGlacier({ rockId: "shale" }).config, {
      forceFault: "skew-erosion",
    });
    results.skewedShale = skewed;
    expect(skewed.pass).toBe(false);
    expect(skewed.maxBedDiffM).toBeGreaterThan(DEVICE_CHECK_MAX_DIFF_M);
    const auto = await selectGlacierBackend(
      { rockId: "shale" },
      {},
      { prefer: "auto", parity: passedParity, gpu: { forceFault: "skew-erosion" } },
    );
    expect(auto.backend).toBe("cpu");
    expect(auto.failure?.reason).toBe("device-check-failed");
    cases.deviceCheck = { ...results, autoWithSkew: auto.fallbackReason };
  });

  it("missing WebGPU selects the CPU under auto, with the reason", async () => {
    const s = await selectGlacierBackend(
      {},
      {},
      { prefer: "auto", parity: passedParity, gpu: { gpu: undefined } },
    );
    expect(s.backend).toBe("cpu");
    expect(s.failure?.reason).toBe("webgpu-unavailable");
    expect(s.fallbackReason).toMatch(/webgpu-unavailable/);
    cases.fallbackMissing = { backend: s.backend, fallbackReason: s.fallbackReason };
  });

  it("an invalid shader fails creation; auto falls back labelled, an explicit request rejects", async (ctx) => {
    if (!available) ctx.skip();
    await expect(createGpuGlacier({}, {}, { forceFault: "invalid-shader" })).rejects.toMatchObject({
      reason: "pipeline-failed",
    });
    const auto = await selectGlacierBackend(
      {},
      {},
      { prefer: "auto", parity: passedParity, gpu: { forceFault: "invalid-shader" } },
    );
    expect(auto.backend).toBe("cpu");
    expect(auto.failure?.reason).toBe("pipeline-failed");
    await expect(
      selectGlacierBackend({}, {}, { prefer: "webgpu", gpu: { forceFault: "invalid-shader" } }),
    ).rejects.toBeInstanceOf(GlacierGpuError);
    cases.fallbackShader = { backend: auto.backend, fallbackReason: auto.fallbackReason };
  });

  it("the recorded parity decides auto selection", async (ctx) => {
    if (!available) ctx.skip();
    const s = await selectGlacierBackend({}, {}, { prefer: "auto" });
    try {
      const expected =
        GLACIER_GPU_PARITY.autoSelectsGpu && GLACIER_GPU_PARITY.status === "passed" ? "webgpu" : "cpu";
      expect(s.backend).toBe(expected);
      if (expected === "cpu") expect(s.fallbackReason).toMatch(/GPU not used automatically/);
      cases.autoSelection = {
        parity: GLACIER_GPU_PARITY,
        backend: s.backend,
        fallbackReason: s.fallbackReason,
      };
    } finally {
      await s.solver.dispose();
    }
  });

  it("a device lost mid-run rejects, latches and keeps the step; a CPU restart is a new labelled run", async (ctx) => {
    if (!available) ctx.skip();
    const gpu = await createGpuGlacier({ rockId: "granite" });
    await gpu.advance(10);
    gpu.loseDeviceForTest();
    const failed = await gpu.advance(10).catch((e: unknown) => e);
    expect(failed).toBeInstanceOf(GlacierGpuError);
    expect((failed as GlacierGpuError).reason).toBe("device-lost");
    expect(gpu.step).toBe(10);
    expect(gpu.failure?.reason).toBe("device-lost");
    await expect(gpu.advance(1)).rejects.toMatchObject({ reason: "device-lost" });
    const restart = restartOnCpu(gpu.config, {}, failed, gpu.step);
    expect(restart.backend).toBe("cpu");
    expect(restart.solver.step).toBe(0);
    expect(restart.fallbackReason).toMatch(/halted at step 10 \(device-lost\); new CPU run/);
    cases.deviceLost = { message: (failed as Error).message, restart: restart.fallbackReason };
    await gpu.dispose();
  });

  it("non-finite state halts both backends; the GPU latches stepping but stays readable", async (ctx) => {
    if (!available) ctx.skip();
    const config = createCpuGlacier().config;
    const ice = new Float64Array(config.nx * config.ny);
    ice[32 * config.nx + 80] = Number.NaN;
    expect(() => createCpuGlacier({}, { iceThicknessM: ice }).advance(1)).toThrow(/non-finite/);
    const gpu = await createGpuGlacier({}, { iceThicknessM: ice });
    try {
      await expect(gpu.advance(1)).rejects.toMatchObject({ reason: "non-finite" });
      await expect(gpu.advance(1)).rejects.toMatchObject({ reason: "non-finite" });
      expect(gpu.step).toBe(1);
      const snapshot = await gpu.snapshot();
      expect(snapshot.step).toBe(1);
      cases.nonFinite = { message: gpu.failure?.message };
    } finally {
      await gpu.dispose();
    }
  });
});
