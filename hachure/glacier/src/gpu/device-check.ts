/**
 * Per-device kernel smoke check (session 5I).
 *
 * The registered comparison ran on one adapter. WebGPU arithmetic is not bitwise portable, and a driver or
 * shader compiler may differ. Before "auto" hands a run to an untested device, it runs this short check.
 * The check uses the run's own config and the authored start under a uniform 150 m ice slab, so the first
 * steps exercise every kernel the run uses: the shape factor, warm-based sliding, the stability cap, the
 * limiter, erosion and the frame. It compares GPU against CPU after `DEVICE_CHECK_STEPS` steps. It costs
 * about 0.1 s of CPU time.
 *
 * The bound (`DEVICE_CHECK_MAX_DIFF_M`) was declared before the check was first run: 1 cm. That is one
 * fiftieth of the registered G7 bed RMS bound (0.05 m), and porting or compiler errors make O(1 m)
 * differences. It is a gate on the device, not a substitute for the registered comparison.
 */
import type { GlacierConfig } from "../contract/config";
import { createCpuGlacier } from "../cpu/solver";
import { FRAME_CELLS } from "../cpu/solver";
import { GlacierGpuError } from "./errors";
import { type GpuGlacierOptions, createGpuGlacier } from "./solver";

/** Steps compared, covering two shape-factor passes at the default interval (unit: steps). */
export const DEVICE_CHECK_STEPS = 80;
/** Largest bed or ice difference accepted (unit: metres). */
export const DEVICE_CHECK_MAX_DIFF_M = 0.01;
/** Thickness of the uniform ice slab that starts the check (unit: metres). */
export const DEVICE_CHECK_ICE_M = 150;

export interface DeviceCheckResult {
  readonly pass: boolean;
  readonly steps: number;
  readonly maxBedDiffM: number;
  readonly maxIceDiffM: number;
  readonly ms: number;
}

export async function checkGlacierGpuDevice(
  config: GlacierConfig,
  gpuOptions: GpuGlacierOptions = {},
): Promise<DeviceCheckResult> {
  const t0 = performance.now();
  const ice = new Float64Array(config.nx * config.ny);
  for (let j = 0; j < config.ny; j++)
    for (let i = 0; i < config.nx; i++)
      if (Math.min(i, j, config.nx - 1 - i, config.ny - 1 - j) >= FRAME_CELLS)
        ice[j * config.nx + i] = DEVICE_CHECK_ICE_M;
  const steps = config.iceEnabled ? DEVICE_CHECK_STEPS : Math.min(DEVICE_CHECK_STEPS, 8);
  const cpu = createCpuGlacier(config, { iceThicknessM: ice });
  const gpu = await createGpuGlacier(config, { iceThicknessM: ice }, gpuOptions);
  try {
    cpu.advance(steps);
    await gpu.advance(steps);
    const f = await gpu.fields();
    let maxBed = 0;
    let maxIce = 0;
    for (let k = 0; k < ice.length; k++) {
      const db = Math.abs(f.bedM[k]! - cpu.fields.bedM[k]!);
      const di = Math.abs(f.iceThicknessM[k]! - cpu.fields.iceThicknessM[k]!);
      maxBed = Math.max(maxBed, Number.isNaN(db) ? Number.POSITIVE_INFINITY : db);
      maxIce = Math.max(maxIce, Number.isNaN(di) ? Number.POSITIVE_INFINITY : di);
    }
    return {
      pass: maxBed <= DEVICE_CHECK_MAX_DIFF_M && maxIce <= DEVICE_CHECK_MAX_DIFF_M,
      steps,
      maxBedDiffM: maxBed,
      maxIceDiffM: maxIce,
      ms: performance.now() - t0,
    };
  } catch (error) {
    throw error instanceof GlacierGpuError
      ? error
      : new GlacierGpuError("device-check-failed", String(error));
  } finally {
    await gpu.dispose();
  }
}
