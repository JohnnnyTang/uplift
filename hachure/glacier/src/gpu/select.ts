/**
 * Backend selection with a labelled CPU fallback (session 5I).
 *
 * - "cpu": the CPU reference.
 * - "webgpu": the GPU solver or a rejected promise with the labelled reason (an explicit request is never
 *   silently served by another backend).
 * - "auto": WebGPU only when the recorded parity allows it (`GLACIER_GPU_PARITY`), the device comes up and
 *   its kernels pass the per-device check (`./device-check.ts`); otherwise the CPU, with `fallbackReason`
 *   saying why.
 *
 * A failure during a run never switches that run's backend. The run halts with a labelled error; the host may
 * then start a NEW run on the CPU from the authored start (`restartOnCpu`), labelled as such.
 */
import { type GlacierConfig, resolveGlacierConfig } from "../contract/config";
import { type CpuGlacierInit, createCpuGlacier } from "../cpu/solver";
import { type AsyncGlacierSolver, type GlacierBackendId, asyncCpuGlacier } from "./async";
import { DEVICE_CHECK_MAX_DIFF_M, checkGlacierGpuDevice } from "./device-check";
import { GlacierGpuError } from "./errors";
import { GLACIER_GPU_PARITY, type GlacierGpuParityRecord } from "./parity";
import { type GpuGlacierOptions, createGpuGlacier } from "./solver";

export type GlacierBackendPreference = "auto" | GlacierBackendId;

export interface GlacierBackendSelection {
  readonly solver: AsyncGlacierSolver;
  readonly backend: GlacierBackendId;
  readonly requested: GlacierBackendPreference;
  /** Why the requested (or, for "auto", the GPU) backend is not the one running; null when it is. */
  readonly fallbackReason: string | null;
  /** The labelled GPU failure behind the fallback, if any. */
  readonly failure: GlacierGpuError | null;
}

export interface SelectGlacierBackendOptions {
  readonly prefer?: GlacierBackendPreference;
  readonly gpu?: GpuGlacierOptions;
  /** Parity record consulted by "auto" (tests inject one; defaults to the recorded outcome). */
  readonly parity?: GlacierGpuParityRecord;
  /** "auto" runs the per-device kernel check (`checkGlacierGpuDevice`) first unless this is false. */
  readonly deviceCheck?: boolean;
}

export async function selectGlacierBackend(
  overrides: Partial<GlacierConfig> = {},
  init: CpuGlacierInit = {},
  options: SelectGlacierBackendOptions = {},
): Promise<GlacierBackendSelection> {
  const prefer = options.prefer ?? "auto";
  const parity = options.parity ?? GLACIER_GPU_PARITY;
  const cpu = (fallbackReason: string | null, failure: GlacierGpuError | null): GlacierBackendSelection => ({
    solver: asyncCpuGlacier(createCpuGlacier(overrides, init)),
    backend: "cpu",
    requested: prefer,
    fallbackReason,
    failure,
  });
  if (prefer === "cpu") return cpu(null, null);
  if (prefer === "auto" && !(parity.autoSelectsGpu && parity.status === "passed"))
    return cpu(`GPU not used automatically: ${parity.summary} (${parity.status})`, null);
  try {
    if (prefer === "auto" && options.deviceCheck !== false) {
      // The registered comparison ran on one adapter; check the kernels on this one before trusting it.
      const check = await checkGlacierGpuDevice(resolveGlacierConfig(overrides), options.gpu);
      if (!check.pass)
        throw new GlacierGpuError(
          "device-check-failed",
          `GPU differs from CPU on this device after ${check.steps} steps (bed ${check.maxBedDiffM} m, ice ${check.maxIceDiffM} m; limit ${DEVICE_CHECK_MAX_DIFF_M} m)`,
        );
    }
    const solver = await createGpuGlacier(overrides, init, options.gpu);
    return { solver, backend: "webgpu", requested: prefer, fallbackReason: null, failure: null };
  } catch (error) {
    if (prefer === "webgpu") throw error;
    const failure =
      error instanceof GlacierGpuError ? error : new GlacierGpuError("pipeline-failed", String(error));
    return cpu(`WebGPU not used, running on CPU: ${failure.message}`, failure);
  }
}

/**
 * A new CPU run from the authored start after a GPU run failed. It is a different run (step 0), labelled
 * with the failure; it does not continue or reinterpret the failed GPU run.
 */
export function restartOnCpu(
  config: GlacierConfig,
  init: CpuGlacierInit,
  failure: unknown,
  failedAtStep: number,
): GlacierBackendSelection {
  const labelled =
    failure instanceof GlacierGpuError ? failure : new GlacierGpuError("validation-error", String(failure));
  return {
    solver: asyncCpuGlacier(createCpuGlacier(config, init)),
    backend: "cpu",
    requested: "webgpu",
    fallbackReason: `WebGPU run halted at step ${failedAtStep} (${labelled.reason}); new CPU run from the authored start`,
    failure: labelled,
  };
}
