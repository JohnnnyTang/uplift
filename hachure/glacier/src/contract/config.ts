/**
 * GlacierConfig: the one typed configuration of the glacier model (frozen contract, session 5G).
 *
 * Every field carries its unit in its name (AGENTS.md, "Architecture rules"); unitless fields say so.
 * Physical constants follow Cuffey & Paterson (2010). Teaching choices (snowline, erosion speed-up, rock
 * properties) are marked as such; they are not field-calibrated. See docs/science/glacial/model.md.
 * <!-- expert-review -->
 */
import { type RockId, isRockId } from "./rocks";

export const MASS_BALANCE_ALTITUDES = ["starting-bed", "ice-surface"] as const;
export type MassBalanceAltitude = (typeof MASS_BALANCE_ALTITUDES)[number];

/** Seconds in a Julian year (365.25 days). */
export const SECONDS_PER_YEAR = 31_557_600;

/** Glen's flow-law exponent n (unit: none). Fixed at 3 (Cuffey & Paterson 2010, §3.4); not configurable. */
export const GLEN_EXPONENT = 3;

export interface GlacierConfig {
  // ── Grid and run identity ─────────────────────────────────────────────────────────────────────────
  /** Cells along the valley axis, the grid x direction (unit: cells). Index is `j * nx + i`. */
  readonly nx: number;
  /** Cells across the valley, the grid y direction (unit: cells). */
  readonly ny: number;
  /** Horizontal size of a square cell (unit: metres). */
  readonly metresPerCell: number;
  /** Seed for the authored start's bed roughness (unit: none; unsigned 32-bit integer). */
  readonly seed: number;
  /** Fixed time step (unit: model years). Speed controls scheduling only, never this value. */
  readonly dtYears: number;
  /** Rock the valley is cut into. Fixed for the whole run (owner decision 5). */
  readonly rockId: RockId;

  // ── Controls (feasibility arms; the reader never sees these) ───────────────────────────────────────
  /** Grow ice from the snowline mass balance (unit: boolean). False is the "no ice" control. */
  readonly iceEnabled: boolean;
  /** Let sliding ice erode the bed (unit: boolean). False is the "no erosion" control. */
  readonly erosionEnabled: boolean;
  /**
   * Apply the lateral-drag shape factor (unit: boolean). False is plain shallow-ice flow, the
   * recorded failed attempt A0 (docs/science/glacial/feasibility.md).
   */
  readonly lateralDragEnabled: boolean;

  // ── Ice physics ───────────────────────────────────────────────────────────────────────────────────
  /** Glen rate factor A for temperate ice (unit: Pa⁻³ per year). C&P 2010 recommend 2.4e-24 Pa⁻³ s⁻¹. */
  readonly glenRateFactorPerPa3PerYear: number;
  /** Ice density (unit: kilograms per cubic metre). */
  readonly iceDensityKgPerM3: number;
  /** Gravitational acceleration (unit: metres per second squared). */
  readonly gravityMPerS2: number;
  /** Basal sliding speed at the reference basal shear stress (unit: metres per year). Weertman-type law. */
  readonly slidingMPerYearAtReferenceStress: number;
  /** Reference basal shear stress for the sliding and erosion laws (unit: pascals). */
  readonly referenceBasalStressPa: number;
  /** Sliding-law stress exponent m in u_b ∝ τ_b^m (unit: none). */
  readonly slidingStressExponent: number;
  /**
   * Largest basal shear stress used by the sliding and erosion laws (unit: pascals). Valley glaciers
   * sustain basal stresses of roughly 50–150 kPa (ice is near-plastic; Cuffey & Paterson 2010, ch. 8);
   * the shallow-ice estimate exceeds that at steep, thin ice fronts, where it would drive runaway erosion
   * (attempt A2b). Deformation is not capped.
   */
  readonly maxSlidingStressPa: number;
  /**
   * Ice thinner than this is frozen to its bed: no sliding, so no erosion (unit: metres). A simple stand-in
   * for the basal thermal regime: thin ice is cold-based, thick ice warm-based ("selective linear
   * erosion", Sugden 1978; Cuffey & Paterson 2010 ch. 9). A teaching choice, not a computed temperature.
   */
  readonly slidingOnsetIceThicknessM: number;
  /** Ice at least this thick slides fully; the sliding fraction ramps linearly in between (unit: metres). */
  readonly fullSlidingIceThicknessM: number;

  // ── Mass balance: a fixed, authored snowline (not a reader control) ───────────────────────────────
  /** Snowline (equilibrium-line) altitude: net accumulation above, net melt below (unit: metres). */
  readonly snowlineAltitudeM: number;
  /** Mass-balance gradient with altitude (unit: metres of ice per year per metre of altitude). */
  readonly massBalanceGradientPerYear: number;
  /** Cap on net accumulation (unit: metres of ice per year). */
  readonly maxAccumulationMPerYear: number;
  /**
   * Altitude the mass balance is evaluated at (unit: none; enum). "starting-bed": the authored start,
   * held fixed for the run, so every rock gets the same ice supply (the registered model; it omits the
   * feedback by which a deepening valley lowers and melts its glacier). "ice-surface": the live ice
   * surface (recorded attempt A2a in docs/science/glacial/feasibility.md).
   */
  readonly massBalanceAltitude: MassBalanceAltitude;

  // ── Erosion ───────────────────────────────────────────────────────────────────────────────────────
  /** Bed lowering for sandstone at the reference sliding speed, before speed-up (unit: metres per year). */
  readonly erosionMPerYearAtReferenceSliding: number;
  /** Reference sliding speed for the erosion law (unit: metres per year). */
  readonly referenceSlidingMPerYear: number;
  /** Erosion-law exponent l in ė ∝ u_b^l (unit: none). */
  readonly erosionSlidingExponent: number;
  /**
   * Time compression of erosion (unit: none). Each model year erodes as much as `erosionSpeedup` years of
   * the uncompressed law, so the valley changes within a short run. A declared teaching choice; the page
   * says "time compressed".
   */
  readonly erosionSpeedup: number;
  /** Rate at which over-steep walls relax to the rock's critical slope (unit: per model year). */
  readonly wallFailureRatePerYear: number;

  // ── Numerics ──────────────────────────────────────────────────────────────────────────────────────
  /** Ice thinner than this counts as ice-free for erosion and probes (unit: metres). */
  readonly minIceThicknessM: number;
  /** Recompute the lateral-drag shape factor every this many steps (unit: steps). */
  readonly shapeFactorIntervalSteps: number;
  /** Half-width of the across-flow profile searched for lateral drag (unit: cells). */
  readonly lateralDragSearchCells: number;
}

/**
 * Defaults: the reference configuration registered in docs/science/glacial/acceptance-protocol.md.
 * Rock is sandstone (the middle rock). Change only through the protocol. The grid is 160 × 64 cells since
 * session 5G2 (the enclosed valley head, `v-valley/2`); session 5G used 128 × 96.
 */
export const DEFAULT_GLACIER_CONFIG: GlacierConfig = Object.freeze({
  nx: 160,
  ny: 64,
  metresPerCell: 40,
  seed: 1,
  dtYears: 0.0025,
  rockId: "sandstone",
  iceEnabled: true,
  erosionEnabled: true,
  lateralDragEnabled: true,
  glenRateFactorPerPa3PerYear: 2.4e-24 * SECONDS_PER_YEAR,
  iceDensityKgPerM3: 917,
  gravityMPerS2: 9.81,
  slidingMPerYearAtReferenceStress: 40,
  referenceBasalStressPa: 100_000,
  slidingStressExponent: 2,
  maxSlidingStressPa: 200_000,
  slidingOnsetIceThicknessM: 40,
  fullSlidingIceThicknessM: 120,
  snowlineAltitudeM: 1830,
  massBalanceGradientPerYear: 0.01,
  maxAccumulationMPerYear: 3,
  massBalanceAltitude: "starting-bed",
  erosionMPerYearAtReferenceSliding: 0.01,
  referenceSlidingMPerYear: 100,
  erosionSlidingExponent: 2,
  erosionSpeedup: 120,
  wallFailureRatePerYear: 5,
  minIceThicknessM: 1,
  shapeFactorIntervalSteps: 40,
  lateralDragSearchCells: 14,
}) as GlacierConfig;

type NumericKey = {
  [K in keyof GlacierConfig]: GlacierConfig[K] extends number ? K : never;
}[keyof GlacierConfig];

export interface ConfigLimit {
  readonly min: number;
  readonly max: number;
  readonly integer?: boolean;
}

/** Numerical-sanity limits. Values outside are rejected, never silently changed. */
export const GLACIER_CONFIG_LIMITS: Readonly<Record<NumericKey, ConfigLimit>> = Object.freeze({
  nx: { min: 8, max: 1024, integer: true },
  ny: { min: 8, max: 1024, integer: true },
  metresPerCell: { min: 1, max: 1000 },
  seed: { min: 0, max: 0xffff_ffff, integer: true },
  dtYears: { min: 1e-5, max: 1 },
  glenRateFactorPerPa3PerYear: { min: 0, max: 1e-14 },
  iceDensityKgPerM3: { min: 800, max: 1000 },
  gravityMPerS2: { min: 1, max: 30 },
  slidingMPerYearAtReferenceStress: { min: 0, max: 10_000 },
  referenceBasalStressPa: { min: 1, max: 1e7 },
  slidingStressExponent: { min: 1, max: 4 },
  maxSlidingStressPa: { min: 1, max: 1e7 },
  slidingOnsetIceThicknessM: { min: 0, max: 1000 },
  fullSlidingIceThicknessM: { min: 0, max: 2000 },
  snowlineAltitudeM: { min: -1000, max: 10_000 },
  massBalanceGradientPerYear: { min: 0, max: 0.1 },
  maxAccumulationMPerYear: { min: 0, max: 20 },
  erosionMPerYearAtReferenceSliding: { min: 0, max: 1 },
  referenceSlidingMPerYear: { min: 1e-3, max: 1e5 },
  erosionSlidingExponent: { min: 0.5, max: 4 },
  erosionSpeedup: { min: 0, max: 1e5 },
  wallFailureRatePerYear: { min: 0, max: 1e4 },
  minIceThicknessM: { min: 0, max: 100 },
  shapeFactorIntervalSteps: { min: 1, max: 10_000, integer: true },
  lateralDragSearchCells: { min: 1, max: 256, integer: true },
});

/** Merges overrides into the defaults and validates the result. Throws with every problem listed. */
export function resolveGlacierConfig(overrides: Partial<GlacierConfig> = {}): GlacierConfig {
  const merged = { ...DEFAULT_GLACIER_CONFIG, ...overrides };
  const problems = validateGlacierConfig(merged);
  if (problems.length > 0) throw new Error(`Invalid GlacierConfig: ${problems.join("; ")}`);
  return Object.freeze(merged);
}

export function validateGlacierConfig(config: GlacierConfig): string[] {
  const problems: string[] = [];
  for (const [key, limit] of Object.entries(GLACIER_CONFIG_LIMITS) as [NumericKey, ConfigLimit][]) {
    const value = config[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      problems.push(`${key} must be a finite number`);
      continue;
    }
    if (value < limit.min || value > limit.max)
      problems.push(`${key}=${value} outside [${limit.min}, ${limit.max}]`);
    if (limit.integer && !Number.isInteger(value)) problems.push(`${key}=${value} must be an integer`);
  }
  if (config.fullSlidingIceThicknessM <= config.slidingOnsetIceThicknessM)
    problems.push("fullSlidingIceThicknessM must exceed slidingOnsetIceThicknessM");
  if (!(MASS_BALANCE_ALTITUDES as readonly string[]).includes(config.massBalanceAltitude))
    problems.push(`massBalanceAltitude=${String(config.massBalanceAltitude)} is not known`);
  if (!isRockId(config.rockId)) problems.push(`rockId=${String(config.rockId)} is not a known rock`);
  for (const key of ["iceEnabled", "erosionEnabled", "lateralDragEnabled"] as const) {
    if (typeof config[key] !== "boolean") problems.push(`${key} must be a boolean`);
  }
  return problems;
}

/**
 * Largest ice diffusivity the explicit scheme accepts at this step (unit: square metres per year):
 * D·dt/dx² ≤ 0.2, below the 2-D limit of 0.25. Larger values are capped and counted in diagnostics.
 */
export function maxStableDiffusivityM2PerYear(config: GlacierConfig): number {
  return (0.2 * config.metresPerCell * config.metresPerCell) / config.dtYears;
}
