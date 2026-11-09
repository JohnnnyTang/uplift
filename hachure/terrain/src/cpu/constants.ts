/**
 * Named numerical constants of the terrain process model (`docs/science/model.md`,
 * `docs/science/parameters.md`, "Numerical constants and review changes").
 *
 * These are solver constants, not reader parameters. Keep one definition: the GPU solver (3C/4A) imports
 * these values rather than repeating the literals.
 */

/**
 * Water depth at or below which a cell is treated as dry (unit: metres). A numerical guard, not an
 * observed depth threshold (model.md, stage 3).
 */
export const DRY_DEPTH_M = 1e-6;

/** Reference thickness that makes the capacity coefficient dimensionless (unit: metres). */
export const REFERENCE_CAPACITY_THICKNESS_M = 1;

/** Reference speed that makes the capacity coefficient dimensionless (unit: metres per second). */
export const REFERENCE_SPEED_M_PER_S = 1;

/** Engineering safety factor of the wave (CFL) guard (unit: none). */
export const WAVE_SAFETY_FACTOR = 0.5;

/** Number of cardinal neighbours that share a hydraulic face (unit: none). */
export const CARDINAL_DEGREE = 4;

/** Converts millimetres per hour to metres per second (unit: (m/s) per (mm/h)). */
export const MM_PER_HR_TO_M_PER_S = 1 / 3_600_000;

/** The proposed default time step that the evaporation range is stated at (unit: seconds). */
export const EVAPORATION_REFERENCE_DT_S = 0.05;

/** Largest evaporation fraction per step at the reference time step (unit: none per step). */
export const EVAPORATION_MAX_FRACTION_AT_REFERENCE_DT = 0.0001;
