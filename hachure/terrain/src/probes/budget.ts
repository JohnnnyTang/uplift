import type { BudgetResult, StateSnapshot } from "../contract/index";
import { layer } from "./shared";

/** Recompute suspension stock in fixed row-major float64 order; exchanges remain solver counters. */
export function aggregateBudget(snapshot: StateSnapshot): BudgetResult {
  const m = layer(snapshot, "suspendedSedimentM");
  let suspendedM3 = 0;
  for (const v of m) suspendedM3 += v * snapshot.metresPerCell ** 2;
  return { ...snapshot.budget, kind: "budget", suspendedM3 };
}

export interface BudgetResidual {
  readonly solidResidualM3: number;
  readonly waterResidualM3: number;
  readonly solidReferenceM3: number;
  readonly waterReferenceM3: number;
  readonly solidRelativeResidual: number | null;
  readonly waterRelativeResidual: number | null;
  readonly solidPassed: boolean;
  readonly waterPassed: boolean;
}

/** Baseline may be nonzero step: cumulative counters are differenced, including tool transfers. */
export function budgetResidual(snapshot: StateSnapshot, initial: StateSnapshot): BudgetResidual {
  if (snapshot.gridSize !== initial.gridSize || snapshot.metresPerCell !== initial.metresPerCell)
    throw new RangeError("Budget grids must match");
  const b = layer(snapshot, "bedrockM"),
    s = layer(snapshot, "sedimentM"),
    m = layer(snapshot, "suspendedSedimentM"),
    h = layer(snapshot, "waterM");
  const b0 = layer(initial, "bedrockM"),
    s0 = layer(initial, "sedimentM"),
    m0 = layer(initial, "suspendedSedimentM"),
    h0 = layer(initial, "waterM");
  const area = snapshot.metresPerCell ** 2;
  let solid = 0,
    water = 0,
    initialSuspended = 0,
    initialWater = 0;
  for (let i = 0; i < b.length; i++) {
    solid += (b[i]! - b0[i]! + (s[i]! - s0[i]!) + (m[i]! - m0[i]!)) * area;
    water += (h[i]! - h0[i]!) * area;
    initialSuspended += m0[i]! * area;
    initialWater += h0[i]! * area;
  }
  const delta = (key: keyof StateSnapshot["budget"]) => snapshot.budget[key] - initial.budget[key];
  const solidResidualM3 = solid + delta("exportedSedimentM3") - delta("toolNetM3");
  const input = delta("rainedWaterM3") + delta("sourcedWaterM3");
  const waterResidualM3 = water - input + delta("evaporatedWaterM3") + delta("outflowedWaterM3");
  const solidReferenceM3 = Math.max(delta("erodedM3"), initialSuspended, delta("exportedSedimentM3"));
  const waterReferenceM3 = Math.max(initialWater, input);
  return {
    solidResidualM3,
    waterResidualM3,
    solidReferenceM3,
    waterReferenceM3,
    solidRelativeResidual: solidReferenceM3 ? Math.abs(solidResidualM3) / solidReferenceM3 : null,
    waterRelativeResidual: waterReferenceM3 ? Math.abs(waterResidualM3) / waterReferenceM3 : null,
    solidPassed: Math.abs(solidResidualM3) <= Math.max(1e-6, 0.01 * solidReferenceM3),
    waterPassed: Math.abs(waterResidualM3) <= Math.max(1e-6, 0.01 * waterReferenceM3),
  };
}
