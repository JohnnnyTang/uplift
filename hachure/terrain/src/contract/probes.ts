/**
 * Probe requests and results. Probes are pure functions of a `StateSnapshot` (session 2F implements
 * them), so every solver backend gets the same probes for free and the solver interface stays thin.
 */
import type { BudgetCounters, PointM } from "./state";

/** Water and sediment passing a point. */
export interface PointFluxRequest {
  readonly kind: "point-flux";
  readonly at: PointM;
}

export interface PointFluxResult {
  readonly kind: "point-flux";
  /** Water depth at the point (unit: metres). */
  readonly waterDepthM: number;
  /** Flow speed at the point (unit: metres per second). */
  readonly speedMPerS: number;
  /** Water discharge through the cell (unit: cubic metres per second). */
  readonly waterDischargeM3PerS: number;
  /** Suspended sediment carried through the cell (unit: cubic metres per second). */
  readonly sedimentFluxM3PerS: number;
}

/** Elevations sampled along a polyline, for example the river's long profile. */
export interface LongProfileRequest {
  readonly kind: "long-profile";
  /** At least two vertices (unit: metres). */
  readonly path: readonly PointM[];
  /** Number of evenly spaced samples along the path, ≥ 2. */
  readonly samples: number;
}

/** Elevations sampled along a straight line across a valley. */
export interface CrossSectionRequest {
  readonly kind: "cross-section";
  readonly from: PointM;
  readonly to: PointM;
  /** Number of evenly spaced samples, ≥ 2. */
  readonly samples: number;
}

/** Series result shared by long profiles and cross-sections. All arrays have `samples` entries. */
export interface ProfileResult {
  readonly kind: "long-profile" | "cross-section";
  /** Distance along the path from its start (unit: metres). */
  readonly distanceM: Float64Array;
  /** Bedrock elevation (unit: metres). */
  readonly bedrockM: Float64Array;
  /** Ground elevation, bedrock plus sediment (unit: metres). */
  readonly groundM: Float64Array;
  /** Water depth (unit: metres). */
  readonly waterM: Float64Array;
}

/** The running sediment and water budget. */
export interface BudgetRequest {
  readonly kind: "budget";
}

export interface BudgetResult extends BudgetCounters {
  readonly kind: "budget";
}

export type ProbeRequest = PointFluxRequest | LongProfileRequest | CrossSectionRequest | BudgetRequest;
export type ProbeResult = PointFluxResult | ProfileResult | BudgetResult;
export type ProbeKind = ProbeRequest["kind"];

export const PROBE_KINDS = [
  "point-flux",
  "long-profile",
  "cross-section",
  "budget",
] as const satisfies readonly ProbeKind[];

/** Maps each request type to its result type. */
export type ProbeResultFor<R extends ProbeRequest> = R extends PointFluxRequest
  ? PointFluxResult
  : R extends LongProfileRequest | CrossSectionRequest
    ? ProfileResult
    : R extends BudgetRequest
      ? BudgetResult
      : never;
