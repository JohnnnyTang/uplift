/**
 * CPU reference solver (session 2A). See `docs/science/model.md` for the process model it implements.
 */
export {
  CARDINAL_DEGREE,
  DRY_DEPTH_M,
  EVAPORATION_MAX_FRACTION_AT_REFERENCE_DT,
  EVAPORATION_REFERENCE_DT_S,
  MM_PER_HR_TO_M_PER_S,
  REFERENCE_CAPACITY_THICKNESS_M,
  REFERENCE_SPEED_M_PER_S,
  WAVE_SAFETY_FACTOR,
} from "./constants";
export {
  type AdmissibleRange,
  CPU_ADMISSIBLE_RANGES,
  maxEvaporationFractionPerStep,
  pipeWaveCourant,
  validateCpuSolverConfig,
} from "./guards";
export {
  type CpuSolverOptions,
  CpuTerrainSolver,
  type WaveGuardPolicy,
  type ReferenceLayers,
  type StabilityDiagnostic,
  type StabilityFailure,
  type StepDiagnostics,
  TerrainStabilityError,
  createCpuSolver,
} from "./solver";
export { WATER_COMPARISON_CONFIG, waterComparisonPreset } from "./comparison-fixtures";
