import { formatBoundNumber } from "../../bindings/format";
import { aggregateBudget, channelLengthM, sampleChannelProfile, type TerrainConfig } from "@hachure/terrain";
import type { HostSample } from "../../sim-host/protocol";

export const UNIVERSITY_PARAMETERS = [
  "capacityCoefficient",
  "erosionRatePerS",
  "depositionRatePerS",
] as const;
export type UniversityParameter = (typeof UNIVERSITY_PARAMETERS)[number];
/** Effective scene defaults, never a cached slider value. */
export function universityDefaults(config: TerrainConfig) {
  return Object.fromEntries(UNIVERSITY_PARAMETERS.map((key) => [key, config[key]])) as Record<
    UniversityParameter,
    number
  >;
}
export function changedUniversityParameters(config: TerrainConfig, defaults: TerrainConfig) {
  return UNIVERSITY_PARAMETERS.filter((key) => config[key] !== defaults[key]);
}
/** A fixed route avoids mistaking rerouting for incision; never fabricate a missing reach. */
export function universitySample(sample: HostSample) {
  const route = sample.paths.baseline;
  const profile =
    channelLengthM(route) >= sample.snapshot.metresPerCell
      ? sampleChannelProfile(sample.snapshot, route)
      : undefined;
  return { profile, route, budget: aggregateBudget(sample.snapshot) };
}

/** Keep tiny diagnostic volumes readable without rounding a nonzero transfer to zero. */
export function formatUniversityNumber(value: number, unit: string): string {
  if (value !== 0 && Math.abs(value) < 0.001) return `${value.toExponential(2)} ${unit}`;
  return formatBoundNumber(value, unit);
}
