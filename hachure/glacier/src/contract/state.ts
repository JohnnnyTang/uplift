/**
 * Glacier state, snapshots and solver interface (frozen contract, session 5G).
 *
 * Layout: every field is row-major with `index = j * nx + i`, where i runs ALONG the valley (grid x,
 * metres = i · metresPerCell, i = 0 is the downstream edge, i = nx − 1 the valley head) and j runs ACROSS it
 * (grid y). Elevations are metres above an arbitrary datum.
 */
import type { GlacierConfig } from "./config";
import type { RockId } from "./rocks";
import type { GlacierProbes, SectionMeasure } from "./probes";

/** The layers recorded in every snapshot and captured run, in this order. */
export const GLACIER_LAYERS = [
  "bedM",
  "iceThicknessM",
  "surfaceVelocityXMPerYear",
  "surfaceVelocityYMPerYear",
] as const;
export type GlacierLayer = (typeof GLACIER_LAYERS)[number];

/**
 * A recorded moment of one run: view data, not a resumable checkpoint (wave plan §4). Float32 is enough
 * for display and probes; the CPU reference integrates in Float64 internally.
 */
export interface GlacierSnapshot {
  readonly nx: number;
  readonly ny: number;
  readonly metresPerCell: number;
  readonly rockId: RockId;
  /** Completed fixed steps (unit: steps). */
  readonly step: number;
  /** Model time, `step × dtYears` (unit: model years; time compressed for erosion). */
  readonly modelYears: number;
  /** Bed (rock surface) elevation (unit: metres). */
  readonly bedM: Float32Array;
  /** Ice thickness, zero where ice-free (unit: metres). */
  readonly iceThicknessM: Float32Array;
  /** Ice surface velocity, x component (unit: metres per year); zero where ice-free. */
  readonly surfaceVelocityXMPerYear: Float32Array;
  /** Ice surface velocity, y component (unit: metres per year); zero where ice-free. */
  readonly surfaceVelocityYMPerYear: Float32Array;
}

/** Cumulative ice volume accounting since the start of the run (unit: cubic metres). */
export interface IceBudget {
  /** Net surface mass balance actually applied (accumulation minus melt that found ice to melt). */
  readonly surfaceMassBalanceM3: number;
  /** Ice removed at the domain edge (the edge cells are kept ice-free). */
  readonly edgeOutflowM3: number;
  /** Current ice volume minus (applied balance − edge outflow); round-off only. */
  readonly residualM3: number;
}

/** Numerical health counters since the start of the run. */
export interface GlacierDiagnostics {
  /** Edge diffusivities that hit the explicit-stability cap (unit: count of edge-steps). */
  readonly cappedEdgeSteps: number;
  /** All ice-carrying edge-steps evaluated (unit: count), the denominator for `cappedEdgeSteps`. */
  readonly iceEdgeSteps: number;
  /** Cell-steps where the outflow limiter scaled fluxes to keep ice thickness non-negative. */
  readonly limitedCellSteps: number;
}

export interface GlacierSolver {
  readonly config: GlacierConfig;
  readonly step: number;
  readonly modelYears: number;
  /** Advance by whole fixed steps. */
  advance(steps: number): void;
  /** Advance by `round(years / dtYears)` steps. */
  advanceYears(years: number): void;
  /** A Float32 copy of the current state (view data). Never changes the model. */
  snapshot(): GlacierSnapshot;
  /** Whole-run probes. Never changes the model. */
  probes(): GlacierProbes;
  /** Section measures at grid column `i` (the cut position). View-only. */
  section(i: number): SectionMeasure;
  budget(): IceBudget;
  diagnostics(): GlacierDiagnostics;
  /** 16-hex digest of step + Float64 bed and ice; equal runs give equal hashes. */
  hash(): string;
}
