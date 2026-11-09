/**
 * TerrainConfig: the one typed configuration for the terrain engine.
 *
 * Every field carries its unit in its name (AGENTS.md, "Architecture rules"). Fields without a physical
 * unit say so in their doc comment.
 *
 * Defaults and limits below are PROVISIONAL engineering placeholders, chosen only so the contract, the
 * fake solver and the tests can run. They are not science. Session 2A must enforce the joint stability guards and reader ranges from
 * `docs/science/parameters.md`; unresolved constraints are tagged `TODO(2A)`.
 */

/** Seconds in a Julian year (365.25 days). Used to convert simulated seconds into simulated years. */
export const SECONDS_PER_YEAR = 31_557_600;

export interface TerrainConfig {
  /** Cells per side of the square grid (unit: cells). The grid has `gridSize²` cells. */
  readonly gridSize: number;
  /** Horizontal size of one square cell (unit: metres). Also the virtual-pipe length. */
  readonly metresPerCell: number;
  /** Seed for every random choice the engine makes (unit: none; an unsigned 32-bit integer). */
  readonly seed: number;

  /** Uniform rainfall intensity over the whole grid (unit: millimetres per hour). */
  readonly rainMmPerHr: number;
  /** Gravitational acceleration (unit: metres per second squared). */
  readonly gravityMPerS2: number;
  /** Cross-sectional area of each virtual pipe (unit: square metres). */
  readonly pipeAreaM2: number;
  /** Manning roughness n (seconds per metre to the one-third power). Provisional; expert review pending. */
  readonly manningNSPerMOneThird: number;
  /** Fixed numerical time step of the hydraulic model (unit: simulated seconds). */
  readonly dtSimSeconds: number;
  /**
   * Morphological acceleration factor (unit: none). Each hydraulic step stands for
   * `dtSimSeconds × morphAccelerationFactor` seconds of landscape change. Clock mapping only: never multiply erosion increments by this factor. Calibrated by 3B
   * (`docs/science/time-scale.md`, tension T4). Factor 1 is an uncalibrated sentinel; a numeric landscape-time label requires approval metadata.
   */
  readonly morphAccelerationFactor: number;

  /** Sediment transport capacity coefficient (unit: none; scales capacity from slope and speed). */
  readonly capacityCoefficient: number;
  /** Rate at which flow picks up material when below capacity (unit: per second). */
  readonly erosionRatePerS: number;
  /** Rate at which flow drops material when above capacity (unit: per second). */
  readonly depositionRatePerS: number;
  /**
   * Range of rock hardness values a cell may hold, `[min, max]` (unit: none; 0 = fully erodible,
   * 1 = not erodible). Erosion rate is scaled by `1 − hardness`.
   */
  readonly hardnessRange: readonly [number, number];

  /** Angle of repose for loose sediment; thermal slumping acts above it (unit: degrees). */
  readonly talusAngleDeg: number;
  /** Rate at which material above the angle of repose slumps (unit: per second). */
  readonly thermalRatePerS: number;
  /** Fraction of water depth that evaporates each step (unit: none, per step, in [0, 1)). */
  readonly evaporationFractionPerStep: number;

  /** Largest height a single raise-brush application may add (unit: metres). Reader clamp. */
  readonly brushMaxHeightM: number;
  /** Largest depth a single dig-brush application may remove (unit: metres). Reader clamp. */
  readonly brushMaxDepthM: number;
  /** Largest brush radius (unit: metres). Reader clamp. */
  readonly brushMaxRadiusM: number;
  /** Steepest surface slope a brush may create (unit: degrees). Reader clamp. */
  readonly brushMaxSlopeDeg: number;
}

/** Fields that may change while a simulation runs (through `TerrainSolver.configure`). */
export type TunableConfigKey = Exclude<keyof TerrainConfig, "gridSize" | "metresPerCell" | "seed">;
export type TunableConfig = Pick<TerrainConfig, TunableConfigKey>;

/** Numeric fields of the config (everything except the hardness range tuple). */
export type NumericConfigKey = Exclude<keyof TerrainConfig, "hardnessRange">;

/** Inclusive numeric limits for one config field. */
export interface ConfigLimit {
  readonly min: number;
  readonly max: number;
  /** Must the value be an integer? */
  readonly integer?: boolean;
}

/**
 * Provisional defaults aligned with the 1E proposal in
 * `docs/science/parameters.md`. Expert review and real-solver validation remain pending.
 */
export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = Object.freeze({
  gridSize: 128,
  metresPerCell: 10, // TODO(2A)
  seed: 1,
  rainMmPerHr: 10, // TODO(2A)
  gravityMPerS2: 9.81,
  manningNSPerMOneThird: 0.035,
  pipeAreaM2: 20, // TODO(2A)
  dtSimSeconds: 0.05, // TODO(2A): must satisfy the CFL condition in model.md
  morphAccelerationFactor: 1, // TODO(2A): calibration, docs/science/time-scale.md
  capacityCoefficient: 0.01, // TODO(2A)
  erosionRatePerS: 0.5, // TODO(2A)
  depositionRatePerS: 1, // TODO(2A)
  hardnessRange: Object.freeze([0, 0.9]) as readonly [number, number], // TODO(2A)
  talusAngleDeg: 33, // TODO(2A)
  thermalRatePerS: 0.15, // TODO(2A)
  evaporationFractionPerStep: 0.00001, // TODO(2A)
  brushMaxHeightM: 5, // TODO(2A)
  brushMaxDepthM: 5, // TODO(2A)
  brushMaxRadiusM: 200, // TODO(2A)
  brushMaxSlopeDeg: 60, // TODO(2A)
});

/**
 * Hard limits for each numeric field: values outside them are rejected, not silently changed. These are
 * numerical-sanity bounds, wider than the reader clamps on controls (those live in the spread definition).
 * TODO(2A): tighten to the plausible ranges in `docs/science/parameters.md`.
 */
export const TERRAIN_CONFIG_LIMITS: Readonly<Record<NumericConfigKey, ConfigLimit>> = Object.freeze({
  gridSize: { min: 8, max: 1024, integer: true },
  metresPerCell: { min: 0.1, max: 1000 },
  seed: { min: 0, max: 0xffff_ffff, integer: true },
  rainMmPerHr: { min: 0, max: 500 },
  gravityMPerS2: { min: 1, max: 30 },
  pipeAreaM2: { min: 0.01, max: 10_000 },
  manningNSPerMOneThird: { min: 0.025, max: 0.15 },
  dtSimSeconds: { min: 1e-4, max: 10 },
  morphAccelerationFactor: { min: 1, max: 1e9 },
  capacityCoefficient: { min: 0, max: 100 },
  erosionRatePerS: { min: 0, max: 10 },
  depositionRatePerS: { min: 0, max: 10 },
  talusAngleDeg: { min: 1, max: 89 },
  thermalRatePerS: { min: 0, max: 10 },
  evaporationFractionPerStep: { min: 0, max: 0.99 },
  brushMaxHeightM: { min: 0, max: 1000 },
  brushMaxDepthM: { min: 0, max: 1000 },
  brushMaxRadiusM: { min: 0, max: 100_000 },
  brushMaxSlopeDeg: { min: 1, max: 89 },
});

/** One problem found by `validateTerrainConfig`. */
export interface ConfigIssue {
  readonly field: keyof TerrainConfig;
  readonly message: string;
}

/** Checks every field against its limits. Returns an empty list when the config is valid. */
export function validateTerrainConfig(config: TerrainConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  for (const key of Object.keys(TERRAIN_CONFIG_LIMITS) as NumericConfigKey[]) {
    const value = config[key];
    const limit = TERRAIN_CONFIG_LIMITS[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push({ field: key, message: `${key} must be a finite number` });
    } else if (value < limit.min || value > limit.max) {
      issues.push({ field: key, message: `${key} = ${value} is outside [${limit.min}, ${limit.max}]` });
    } else if (limit.integer && !Number.isInteger(value)) {
      issues.push({ field: key, message: `${key} must be an integer` });
    }
  }
  const [hMin, hMax] = config.hardnessRange;
  if (!(Number.isFinite(hMin) && Number.isFinite(hMax) && hMin >= 0 && hMax <= 1 && hMin <= hMax)) {
    issues.push({ field: "hardnessRange", message: "hardnessRange must satisfy 0 ≤ min ≤ max ≤ 1" });
  }
  return issues;
}

/** Thrown when a config fails validation. */
export class TerrainConfigError extends Error {
  readonly issues: readonly ConfigIssue[];
  constructor(issues: readonly ConfigIssue[]) {
    super(`Invalid TerrainConfig: ${issues.map((i) => i.message).join("; ")}`);
    this.name = "TerrainConfigError";
    this.issues = issues;
  }
}

/** Fills missing fields from the defaults, validates, and returns a frozen config. Throws on bad values. */
export function resolveTerrainConfig(overrides: Partial<TerrainConfig> = {}): TerrainConfig {
  const config: TerrainConfig = { ...DEFAULT_TERRAIN_CONFIG, ...overrides };
  const issues = validateTerrainConfig(config);
  if (issues.length > 0) throw new TerrainConfigError(issues);
  return Object.freeze({
    ...config,
    hardnessRange: Object.freeze([...config.hardnessRange]) as readonly [number, number],
  });
}

/**
 * Simulated years each solver step stands for (unit: simulated years per step). Derived, never set
 * directly, so the page's time label can be bound to it (tension T4).
 */
export function simYearsPerStep(
  config: Pick<TerrainConfig, "dtSimSeconds" | "morphAccelerationFactor">,
): number {
  return (config.dtSimSeconds * config.morphAccelerationFactor) / SECONDS_PER_YEAR;
}

/** Side length of the whole terrain (unit: metres). */
export function terrainWidthM(config: Pick<TerrainConfig, "gridSize" | "metresPerCell">): number {
  return config.gridSize * config.metresPerCell;
}
