/** Labelled GPU glacier failures. A reason is always reported with the fallback it caused (never silent). */
export const GLACIER_GPU_FAILURES = [
  "webgpu-unavailable",
  "adapter-unavailable",
  "limits-insufficient",
  "device-request-failed",
  "pipeline-failed",
  "validation-error",
  "device-lost",
  "non-finite",
  "device-check-failed",
  "invalid-input",
  "disposed",
] as const;
export type GlacierGpuFailure = (typeof GLACIER_GPU_FAILURES)[number];

export class GlacierGpuError extends Error {
  readonly reason: GlacierGpuFailure;
  constructor(reason: GlacierGpuFailure, message: string) {
    super(`[${reason}] ${message}`);
    this.name = "GlacierGpuError";
    this.reason = reason;
  }
}

export function isGlacierGpuError(error: unknown): error is GlacierGpuError {
  return error instanceof GlacierGpuError;
}
