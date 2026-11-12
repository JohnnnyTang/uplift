/**
 * Test support for the glacial host (not exported from the package). A small grid over the same 6.4 × 2.56 km
 * footprint and a short horizon keep CPU runs fast; the runtime logic does not depend on the grid.
 */
import { type GlacierConfig, createCpuGlacier } from "@hachure/glacier";
import {
  type AsyncGlacierSolver,
  type GlacierBackendSelection,
  GlacierGpuError,
  type GlacierGpuFailure,
  type SelectGlacierBackendOptions,
  asyncCpuGlacier,
  selectGlacierBackend,
} from "@hachure/glacier/gpu";
import type { GlacialRunConfig } from "../runs/index";
import type { GlacialEngineOptions } from "./engine";
import { GlacialHost, type GlacialHostOptions } from "./host";
import { InProcessGlacialTransport } from "./worker";

export const TEST_MODEL: Partial<Omit<GlacierConfig, "rockId">> = Object.freeze({
  nx: 40,
  ny: 16,
  metresPerCell: 160,
});

/** 20 steps between records, 160 steps per run (9 snapshots); 10 steps per 0.25 s animation frame. */
export const TEST_RUNS: Partial<GlacialRunConfig> = Object.freeze({
  snapshotIntervalYears: 0.05,
  horizonYears: 0.4,
  modelYearsPerRealSecond: 0.1,
  maxBatchModelYears: 0.025,
  frameIntervalSeconds: 0.25,
});

export async function createTestHost(
  options: Partial<GlacialHostOptions> & { readonly engine?: GlacialEngineOptions } = {},
): Promise<{ host: GlacialHost; transport: InProcessGlacialTransport }> {
  const transport = new InProcessGlacialTransport(options.engine ?? {});
  const host = new GlacialHost({
    model: TEST_MODEL,
    runConfig: TEST_RUNS,
    ...options,
    transport,
  });
  await host.initialize();
  return { host, transport };
}

/** Animation frames of 0.25 s, each followed by draining the queue (10 fixed steps per frame at speed 1). */
export async function frames(host: GlacialHost, count: number, seconds = 0.25): Promise<void> {
  for (let k = 0; k < count; k++) {
    host.advance(seconds);
    await host.whenIdle();
  }
}

/** The CPU reference labelled as a WebGPU run (a test fake), failing with `reason` once it would pass `failAtStep`. */
export function fakeGpuSolver(
  overrides: Partial<GlacierConfig>,
  failAtStep: number | null,
  reason: GlacierGpuFailure = "device-lost",
): AsyncGlacierSolver {
  const cpu = asyncCpuGlacier(createCpuGlacier(overrides));
  return {
    backend: "webgpu",
    config: cpu.config,
    get step() {
      return cpu.step;
    },
    get modelYears() {
      return cpu.modelYears;
    },
    async advance(steps) {
      if (failAtStep !== null && cpu.step + steps > failAtStep) {
        await cpu.advance(Math.max(0, failAtStep - cpu.step));
        throw new GlacierGpuError(reason, "test fake: the device went away");
      }
      await cpu.advance(steps);
    },
    advanceYears: (years) => cpu.advanceYears(years),
    snapshot: () => cpu.snapshot(),
    probes: () => cpu.probes(),
    section: (i, options) => cpu.section(i, options),
    budget: () => cpu.budget(),
    diagnostics: () => cpu.diagnostics(),
    hash: () => cpu.hash(),
    dispose: () => cpu.dispose(),
  };
}

/**
 * A selection function whose "WebGPU" is the fake above. `gpuRuns` limits how many runs it serves before GPU
 * creation itself fails; CPU requests go to the real selection.
 */
export function fakeGpuSelect(
  options: { failAtStep?: number | null; gpuRuns?: number } = {},
): NonNullable<GlacialEngineOptions["select"]> {
  let served = 0;
  return async (overrides, init, select: SelectGlacierBackendOptions): Promise<GlacierBackendSelection> => {
    if (select.prefer === "cpu") return selectGlacierBackend(overrides, init, { prefer: "cpu" });
    if (options.gpuRuns !== undefined && served >= options.gpuRuns) {
      const failure = new GlacierGpuError("device-request-failed", "test fake: no device this time");
      if (select.prefer === "webgpu") throw failure;
      return {
        ...(await selectGlacierBackend(overrides, init, { prefer: "cpu" })),
        requested: "auto",
        fallbackReason: failure.message,
        failure,
      };
    }
    served++;
    return {
      solver: fakeGpuSolver(overrides, options.failAtStep ?? null),
      backend: "webgpu",
      requested: select.prefer ?? "auto",
      fallbackReason: null,
      failure: null,
    };
  };
}
