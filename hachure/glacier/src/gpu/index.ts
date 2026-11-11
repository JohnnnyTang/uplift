/**
 * @hachure/glacier/gpu — the WebGPU glacier solver, backend selection with a labelled CPU fallback, and the
 * CPU/GPU comparison measures (session 5I). Separate entry so CPU-only consumers never load GPU code.
 * Evidence and the recommended default: docs/review/glacial/gpu/README.md.
 */
export { type AsyncGlacierSolver, type GlacierBackendId, asyncCpuGlacier } from "./async";
export { GLACIER_GPU_FAILURES, GlacierGpuError, type GlacierGpuFailure, isGlacierGpuError } from "./errors";
export {
  DEVICE_CHECK_ICE_M,
  DEVICE_CHECK_MAX_DIFF_M,
  DEVICE_CHECK_STEPS,
  type DeviceCheckResult,
  checkGlacierGpuDevice,
} from "./device-check";
export { GLACIER_GPU_PARITY, type GlacierGpuParityRecord } from "./parity";
export {
  type GlacierBackendPreference,
  type GlacierBackendSelection,
  type SelectGlacierBackendOptions,
  restartOnCpu,
  selectGlacierBackend,
} from "./select";
export {
  type GpuGlacierFields,
  type GpuGlacierOptions,
  type GpuGlacierSolver,
  createGpuGlacier,
} from "./solver";
export {
  type Bound,
  type Check,
  type FieldDifference,
  GPU_GLACIER_TOLERANCES,
  borderlineVerdicts,
  check,
  checkRecord,
  fieldDifference,
  fieldPass,
  isBorderline,
  speedField,
} from "./compare";
export { DF_WGSL, glacierWgsl } from "./shaders";
