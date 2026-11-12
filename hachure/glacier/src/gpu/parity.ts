/**
 * The recorded outcome of the registered CPU/GPU comparison (docs/review/glacial/gpu/README.md), as code.
 * Automatic backend selection reads it, so the GPU is used only where it passed (owner decision 9).
 * Change it only together with the evidence; `parity.test.ts` checks the two agree.
 */
import type { GlacierBackendId } from "./async";

export interface GlacierGpuParityRecord {
  /** "passed": every gate in tolerances.md held; "failed": at least one did; "pending": not yet run. */
  readonly status: "pending" | "passed" | "failed";
  /** Backend the runtime uses when the caller asks for "auto". */
  readonly recommendedDefault: GlacierBackendId;
  /** Whether "auto" may pick WebGPU at all. False keeps the GPU selectable only on explicit request. */
  readonly autoSelectsGpu: boolean;
  /** Short reason shown with a CPU selection made because of this record. */
  readonly summary: string;
  readonly evidence: string;
}

/**
 * Session 5I, 2026-11-10: every gate G1–G9 passed on the registered horizon (Intel Arc 140V, headless Chrome),
 * and the GPU ran about 38× faster per model year than the CPU in the same browser. Auto selection still runs
 * the per-device kernel check before it trusts an adapter the comparison did not cover.
 */
export const GLACIER_GPU_PARITY: GlacierGpuParityRecord = Object.freeze({
  status: "passed",
  recommendedDefault: "webgpu",
  autoSelectsGpu: true,
  summary: "GPU glacier passed the registered CPU/GPU comparison (session 5I)",
  evidence: "docs/review/glacial/gpu/README.md",
});
