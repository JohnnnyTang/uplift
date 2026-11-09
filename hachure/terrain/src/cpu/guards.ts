/**
 * Parameter ranges and stability guards the CPU reference solver enforces.
 *
 * The contract's `TERRAIN_CONFIG_LIMITS` are numerical-sanity bounds only. A real solver must also enforce
 * the proposed admissible ranges in `docs/science/parameters.md` and the joint fixed-step guards in
 * `docs/science/model.md` ("Fixed-step stability and failure policy"). Values outside them are rejected,
 * never silently clipped. The GPU solver (3C/4A) must apply the same checks: import them from here.
 */
import {
  type ConfigIssue,
  type NumericConfigKey,
  type TerrainConfig,
  validateTerrainConfig,
} from "../contract/index";
import {
  CARDINAL_DEGREE,
  EVAPORATION_MAX_FRACTION_AT_REFERENCE_DT,
  EVAPORATION_REFERENCE_DT_S,
  WAVE_SAFETY_FACTOR,
} from "./constants";

/** Inclusive admissible interval for one numeric config field. */
export interface AdmissibleRange {
  readonly min: number;
  readonly max: number;
  readonly integer?: boolean;
}

/**
 * Proposed admissible ranges from `docs/science/parameters.md` (draft, expert review pending).
 *
 * Notes on fields whose range depends on others (checked in `validateCpuSolverConfig`):
 * - `gridSize`: 32–512 for runs; parameters.md lets fixtures use 8, so the floor here is 8.
 * - `gravityMPerS2`: fixed at 9.81, not a slider.
 * - `evaporationFractionPerStep`: 0–0.0001 at the default 0.05 s step, rescaled for other steps by
 *   `fMax(dt) = 1 − (1 − 0.0001)^(dt / 0.05)` (parameters.md, "Numerical constants and review changes").
 * - `brushMaxRadiusM`: at least one cell; the per-application radius is further clamped to a quarter of
 *   the domain width by the brush tools.
 */
export const CPU_ADMISSIBLE_RANGES: Readonly<Record<NumericConfigKey, AdmissibleRange>> = Object.freeze({
  gridSize: { min: 8, max: 512, integer: true },
  metresPerCell: { min: 1, max: 20 },
  seed: { min: 0, max: 0xffff_ffff, integer: true },
  rainMmPerHr: { min: 0, max: 50 },
  gravityMPerS2: { min: 9.81, max: 9.81 },
  pipeAreaM2: { min: 0.01, max: 100 },
  manningNSPerMOneThird: { min: 0.025, max: 0.15 },
  dtSimSeconds: { min: 0.0001, max: 0.05 },
  morphAccelerationFactor: { min: 1, max: 1e9 },
  capacityCoefficient: { min: 0, max: 0.1 },
  erosionRatePerS: { min: 0, max: 1 },
  depositionRatePerS: { min: 0, max: 2 },
  talusAngleDeg: { min: 30, max: 42 },
  thermalRatePerS: { min: 0, max: 1 },
  evaporationFractionPerStep: { min: 0, max: EVAPORATION_MAX_FRACTION_AT_REFERENCE_DT },
  brushMaxHeightM: { min: 0, max: 5 },
  brushMaxDepthM: { min: 0, max: 5 },
  brushMaxRadiusM: { min: 1, max: 200 },
  brushMaxSlopeDeg: { min: 1, max: 60 },
});

/** Largest admissible evaporation fraction per step at time step `dtSimSeconds` (unit: none per step). */
export function maxEvaporationFractionPerStep(dtSimSeconds: number): number {
  if (dtSimSeconds === EVAPORATION_REFERENCE_DT_S) return EVAPORATION_MAX_FRACTION_AT_REFERENCE_DT;
  return (
    1 - Math.pow(1 - EVAPORATION_MAX_FRACTION_AT_REFERENCE_DT, dtSimSeconds / EVAPORATION_REFERENCE_DT_S)
  );
}

/**
 * Pipe-wave Courant number for a config: `dt × 2 × sqrt(g × pipeAreaM2 / metresPerCell) / metresPerCell`
 * (unit: none). The virtual-pipe update is a symplectic-Euler wave scheme whose linear celerity is
 * `sqrt(g A / l)`, so `A / l` acts as an effective flow depth. This is model.md's wave guard with zero
 * velocity and that effective depth; it bounds pipe area against grid scale before any water exists
 * (parameters.md: pipe area and time step are "subject to CFL").
 */
export function pipeWaveCourant(
  config: Pick<TerrainConfig, "dtSimSeconds" | "gravityMPerS2" | "pipeAreaM2" | "metresPerCell">,
): number {
  const celerity = Math.sqrt((config.gravityMPerS2 * config.pipeAreaM2) / config.metresPerCell);
  return (config.dtSimSeconds * 2 * celerity) / config.metresPerCell;
}

/**
 * Checks a config against the contract limits, the admissible ranges and the joint config-level guards.
 * Returns an empty list when the solver may run it. State-dependent guards (the wave guard with live depth
 * and velocity, and finiteness) are checked every step by the kernel.
 */
export function validateCpuSolverConfig(config: TerrainConfig): ConfigIssue[] {
  const issues = validateTerrainConfig(config);
  if (issues.length > 0) return issues;

  for (const key of Object.keys(CPU_ADMISSIBLE_RANGES) as NumericConfigKey[]) {
    const value = config[key];
    const range = CPU_ADMISSIBLE_RANGES[key];
    if (value < range.min || value > range.max) {
      issues.push({
        field: key,
        message: `${key} = ${value} is outside the admissible range [${range.min}, ${range.max}] (docs/science/parameters.md)`,
      });
    } else if (range.integer && !Number.isInteger(value)) {
      issues.push({ field: key, message: `${key} must be an integer` });
    }
  }

  const evapMax = maxEvaporationFractionPerStep(config.dtSimSeconds);
  // Relative slack of 1e-12 so a value computed with the same rescaling formula is not rejected by roundoff.
  if (config.evaporationFractionPerStep > evapMax * (1 + 1e-12)) {
    issues.push({
      field: "evaporationFractionPerStep",
      message: `evaporationFractionPerStep = ${config.evaporationFractionPerStep} exceeds ${evapMax} at dtSimSeconds = ${config.dtSimSeconds}`,
    });
  }
  if (config.brushMaxRadiusM < config.metresPerCell) {
    issues.push({
      field: "brushMaxRadiusM",
      message: `brushMaxRadiusM = ${config.brushMaxRadiusM} is smaller than one cell (${config.metresPerCell} m)`,
    });
  }

  // Joint guards (model.md, "Fixed-step stability and failure policy").
  const reaction = config.dtSimSeconds * Math.max(config.erosionRatePerS, config.depositionRatePerS);
  if (reaction > 1) {
    issues.push({
      field: "dtSimSeconds",
      message: `reaction guard: dt × max(erosionRatePerS, depositionRatePerS) = ${reaction} > 1`,
    });
  }
  const thermal = config.dtSimSeconds * config.thermalRatePerS * CARDINAL_DEGREE;
  if (thermal > 1) {
    issues.push({ field: "dtSimSeconds", message: `slump guard: dt × thermalRatePerS × 4 = ${thermal} > 1` });
  }
  if (!(config.evaporationFractionPerStep >= 0 && config.evaporationFractionPerStep < 1)) {
    issues.push({ field: "evaporationFractionPerStep", message: "evaporation fraction must lie in [0, 1)" });
  }
  const pipe = pipeWaveCourant(config);
  if (pipe > WAVE_SAFETY_FACTOR) {
    issues.push({
      field: "pipeAreaM2",
      message: `pipe wave guard: dt × 2 sqrt(g A / l) / l = ${pipe.toPrecision(3)} > ${WAVE_SAFETY_FACTOR}; reduce pipeAreaM2 or dtSimSeconds`,
    });
  }
  return issues;
}
