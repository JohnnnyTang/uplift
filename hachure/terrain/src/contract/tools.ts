/**
 * Tool operations a reader (or a test) can apply to the terrain. Positions and sizes are in metres; the
 * solver converts to cells. Brush operations are single applications: a brush stroke is a sequence of ops.
 */
import type { PointM } from "./state";

interface BrushBase {
  /** Brush centre (unit: metres). */
  readonly at: PointM;
  /** Brush radius (unit: metres). Clamped to `brushMaxRadiusM`. */
  readonly radiusM: number;
}

/** Adds rock under the brush, peaking at the centre. */
export interface RaiseOp extends BrushBase {
  readonly kind: "raise";
  /** Height added at the centre (unit: metres). Clamped to `brushMaxHeightM`. */
  readonly heightM: number;
}

/** Removes material under the brush, sediment first, then bedrock. */
export interface DigOp extends BrushBase {
  readonly kind: "dig";
  /** Depth removed at the centre (unit: metres). Clamped to `brushMaxDepthM`. */
  readonly depthM: number;
}

/** Relaxes the surface towards its local mean. Must conserve volume. */
export interface SmoothOp extends BrushBase {
  readonly kind: "smooth";
  /** Fraction of the way to the local mean per application (unit: none, in [0, 1]). */
  readonly strength: number;
}

/** Sets rock hardness under the brush. */
export interface HardenOp extends BrushBase {
  readonly kind: "harden";
  /** Target hardness (unit: none). Clamped to `hardnessRange`. */
  readonly hardness: number;
}

/** Adds a persistent local rain source. Replaces any source with the same id. */
export interface RainSourceOp extends BrushBase {
  readonly kind: "rain-source";
  readonly id: string;
  /** Extra rainfall over the brush area (unit: millimetres per hour). */
  readonly rainMmPerHr: number;
}

/** Adds a persistent point spring. Replaces any source with the same id. */
export interface SpringOp {
  readonly kind: "spring";
  readonly id: string;
  /** Spring location (unit: metres). */
  readonly at: PointM;
  /** Water discharge of the spring (unit: cubic metres per second). */
  readonly flowM3PerS: number;
}

/** Removes a rain source or spring by id. A missing id is not an error. */
export interface RemoveSourceOp {
  readonly kind: "remove-source";
  readonly id: string;
}

export type ToolOp = RaiseOp | DigOp | SmoothOp | HardenOp | RainSourceOp | SpringOp | RemoveSourceOp;
export type ToolKind = ToolOp["kind"];

export const TOOL_KINDS = [
  "raise",
  "dig",
  "smooth",
  "harden",
  "rain-source",
  "spring",
  "remove-source",
] as const satisfies readonly ToolKind[];

/** Why a tool op was limited. The page uses these to acknowledge the limit (handoff, "Input clamping"). */
export type ClampReason =
  | "radius" // radius above brushMaxRadiusM
  | "height" // raise above brushMaxHeightM
  | "depth" // dig above brushMaxDepthM
  | "slope" // the result would exceed brushMaxSlopeDeg
  | "hardness" // target outside hardnessRange
  | "off-grid"; // centre outside the grid

export interface ToolResult {
  /** Did the op change the state at all? */
  readonly applied: boolean;
  /** Clamps that engaged; empty when the op ran as requested. */
  readonly clamped: readonly ClampReason[];
  /** Net rock and sediment volume added; negative for dig (unit: cubic metres). */
  readonly volumeChangeM3: number;
}
