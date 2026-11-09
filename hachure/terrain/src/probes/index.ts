import type {
  PointFluxRequest,
  PointFluxResult,
  ProbeRequest,
  ProbeResult,
  ProbeResultFor,
  StateSnapshot,
} from "../contract/index";
import { layer, pointCell } from "./shared";
import { sampleProfile } from "./profile";
import { aggregateBudget } from "./budget";

/** Outgoing water throughput; sediment is an instantaneous concentration estimate, not a stored transfer. */
export function pointFlux(snapshot: StateSnapshot, request: PointFluxRequest): PointFluxResult {
  const i = pointCell(snapshot, request.at);
  const waterDepthM = layer(snapshot, "waterM")[i]!;
  const suspended = layer(snapshot, "suspendedSedimentM")[i]!;
  const speedMPerS = Math.hypot(layer(snapshot, "velocityXMPerS")[i]!, layer(snapshot, "velocityYMPerS")[i]!);
  let waterDischargeM3PerS = 0;
  for (const name of ["fluxWestM3PerS", "fluxEastM3PerS", "fluxNorthM3PerS", "fluxSouthM3PerS"] as const)
    waterDischargeM3PerS += layer(snapshot, name)[i]!;
  return {
    kind: "point-flux",
    waterDepthM,
    speedMPerS,
    waterDischargeM3PerS,
    sedimentFluxM3PerS: waterDepthM > 1e-6 ? (waterDischargeM3PerS * suspended) / waterDepthM : 0,
  };
}

export function probe<R extends ProbeRequest>(snapshot: StateSnapshot, request: R): ProbeResultFor<R>;
export function probe(snapshot: StateSnapshot, request: ProbeRequest): ProbeResult {
  switch (request.kind) {
    case "point-flux":
      return pointFlux(snapshot, request);
    case "long-profile":
    case "cross-section":
      return sampleProfile(snapshot, request);
    case "budget":
      return aggregateBudget(snapshot);
  }
}

export * from "./profile";
export * from "./channel";
export * from "./width";
export * from "./knickpoint";
export * from "./budget";
