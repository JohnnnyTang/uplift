/**
 * The registered acceptance protocol for "From V to U" (session 5G), as code, so the feasibility runs,
 * the captured runs, the tests and 5N's acceptance run use one definition. The prose registration is
 * docs/science/glacial/acceptance-protocol.md; change both together, never one.
 */
import type { GlacierConfig } from "../contract/config";
import { OPEN_HEAD_V_VALLEY, type VValleyOptions } from "../presets/v-valley";
import { ROCK_IDS, type RockId } from "../contract/rocks";

/** Model years simulated by every registered arm. */
export const PROTOCOL_HORIZON_YEARS = 300;
/** Model-time spacing of recorded snapshots and matched comparisons. */
export const PROTOCOL_SNAPSHOT_YEARS = 20;
/** Matched times at which rock arms are compared (unit: model years). */
export const PROTOCOL_MATCHED_YEARS = [100, 200, 300] as const;
/** Seeds of the authored start's roughness; every rock arm runs every seed. */
export const PROTOCOL_SEEDS = [1, 2, 3] as const;

/**
 * Registered section columns (grid i). The first 5080 m of the valley are the same in the 5G (128-column)
 * and 5G2 (160-column) starts, so the columns and their start shapes did not change. "underIce": inside the glacier at
 * steady state; "belowSnout": the control reach the glacier never reaches; "upper": below the headwall.
 */
export const PROTOCOL_SECTIONS = { belowSnout: 14, underIce: 74, upper: 90 } as const;
export type ProtocolSection = keyof typeof PROTOCOL_SECTIONS;

export interface ProtocolArm {
  readonly id: string;
  readonly description: string;
  readonly overrides: Partial<GlacierConfig>;
  /** Start options replacing the registered start's (default: `DEFAULT_V_VALLEY` unchanged). */
  readonly start?: Partial<VValleyOptions>;
  /** Arms that feed the registered rock comparison (others are controls or recorded attempts). */
  readonly kind: "rock" | "control" | "attempt";
}

export function rockArm(rockId: RockId, seed: number): ProtocolArm {
  return {
    id: `${rockId}-s${seed}`,
    description: `Reference model, ${rockId}, seed ${seed}`,
    overrides: { rockId, seed },
    kind: "rock",
  };
}

export const PROTOCOL_ARMS: readonly ProtocolArm[] = [
  ...ROCK_IDS.flatMap((rock) => PROTOCOL_SEEDS.map((seed) => rockArm(rock, seed))),
  {
    id: "control-no-ice",
    description: "Control: no ice (sandstone). The valley must not change.",
    overrides: { iceEnabled: false },
    kind: "control",
  },
  {
    id: "control-no-erosion",
    description: "Control: ice flows but does not erode (sandstone). The bed must not change.",
    overrides: { erosionEnabled: false },
    kind: "control",
  },
  {
    id: "attempt-a0-plain-sia",
    description: "Attempt A0: plain shallow-ice flow, no lateral drag (sandstone).",
    overrides: { lateralDragEnabled: false },
    kind: "attempt",
  },
  {
    id: "attempt-a0-plain-sia-shale",
    description: "Attempt A0: plain shallow-ice flow, no lateral drag (shale).",
    overrides: { lateralDragEnabled: false, rockId: "shale" },
    kind: "attempt",
  },
  {
    id: "attempt-a2a-surface-balance",
    description: "Attempt A2a: mass balance on the live ice surface (sandstone).",
    overrides: { massBalanceAltitude: "ice-surface" },
    kind: "attempt",
  },
  {
    id: "attempt-a2a-surface-balance-shale",
    description: "Attempt A2a: mass balance on the live ice surface (shale).",
    overrides: { massBalanceAltitude: "ice-surface", rockId: "shale" },
    kind: "attempt",
  },
  {
    id: "attempt-5g-open-head-shale",
    description:
      "Attempt (session 5G registered start): open valley head on the 128 × 96 grid (shale). Its glacier leaked to the border.",
    overrides: { nx: 128, ny: 96, rockId: "shale" },
    start: { ...OPEN_HEAD_V_VALLEY },
    kind: "attempt",
  },
  {
    id: "attempt-5g-open-head-granite",
    description: "Attempt (session 5G registered start): open valley head on the 128 × 96 grid (granite).",
    overrides: { nx: 128, ny: 96, rockId: "granite" },
    start: { ...OPEN_HEAD_V_VALLEY },
    kind: "attempt",
  },
  {
    id: "check-half-step",
    description: "Numerical check: half the time step (sandstone, seed 1).",
    overrides: { dtYears: 0.00125, shapeFactorIntervalSteps: 80 },
    kind: "control",
  },
];

export function findArm(id: string): ProtocolArm {
  const arm = PROTOCOL_ARMS.find((a) => a.id === id);
  if (!arm) throw new Error(`unknown protocol arm ${id}`);
  return arm;
}

/**
 * Registered pass criteria. Thresholds are engineering/legibility choices (a trough must be several cells
 * wider and visibly reshaped at page size), not geomorphic constants (docs/science/education-policy.md).
 */
export const PROTOCOL_CRITERIA = {
  /** T1: the under-ice floor widens by at least this (unit: metres; half a cell). */
  troughMinFloorWideningM: 20,
  /** T1: the under-ice shape exponent rises by at least this (unit: none). */
  troughMinShapeIncrease: 0.2,
  /** T1: the under-ice floor is lowered by at least this (unit: metres). */
  troughMinLoweringM: 30,
  /** T1: the steepest wall steepens by at least this (unit: degrees; shale can gain only 8° over the start). */
  troughMinWallSteepeningDeg: 5,
  /** T2: largest change allowed below the snout (unit: metres). */
  belowSnoutMaxChangeM: 0.5,
  /** R1: smallest eroded-area step between neighbouring rocks (unit: square metres). */
  rockMinErodedAreaGapM2: 1000,
  /** R2: smallest floor-width step between neighbouring rocks (unit: metres). */
  rockMinWidthGapM: 5,
  /** R3: smallest steepest-wall step between neighbouring rocks (unit: degrees). */
  rockMinWallGapDeg: 2,
  /** R4: smallest floor-lowering step between neighbouring rocks (unit: metres). */
  rockMinDepthGapM: 5,
  /** S1: granite walls steeper than shale walls at equal eroded area by at least (unit: degrees). */
  shapeMinWallGapDeg: 3,
} as const;
