import type { ProfileResult } from "../contract/index";
import { median } from "./shared";

export interface KnickpointCandidate {
  readonly index: number;
  readonly distanceM: number;
  readonly slopeRatio: number;
  readonly localSlope: number;
  readonly backgroundSlope: number;
}
export interface KnickpointResult {
  readonly resolved: boolean;
  readonly candidates: readonly KnickpointCandidate[];
}

/** Operational slope-break proxy, not a resolved waterfall. Definitions: validation-spec.md. */
export function detectKnickpoints(profile: ProfileResult, metresPerCell: number): KnickpointResult {
  if (!(Number.isFinite(metresPerCell) && metresPerCell > 0)) throw new RangeError("Invalid cell spacing");
  const z = profile.groundM,
    distances = profile.distanceM;
  if (z.length !== distances.length) throw new RangeError("Mismatched profile arrays");
  for (let i = 0; i < z.length; i++) {
    if (!Number.isFinite(z[i]) || !Number.isFinite(distances[i])) throw new RangeError("Non-finite profile");
    if (i && Math.abs(distances[i]! - distances[i - 1]! - metresPerCell) > 1e-6 * metresPerCell)
      throw new RangeError("Knickpoint profile must use one-cell arc spacing");
  }
  const candidates: KnickpointCandidate[] = [];
  let resolved = false,
    previousIndex = -2;
  for (let k = 6; k + 6 < z.length; k++) {
    const slopes: number[] = [];
    // 12 segments between samples k-6 ... k+6, excluding k-1→k and k→k+1.
    for (let j = k - 6; j < k + 6; j++) {
      if (j === k - 1 || j === k) continue;
      const slope = (z[j]! - z[j + 1]!) / metresPerCell;
      if (slope > 0) slopes.push(slope);
    }
    if (slopes.length < 4) continue;
    resolved = true;
    const backgroundSlope = median(slopes);
    const drop = z[k - 1]! - z[k + 1]!;
    const localSlope = drop / (2 * metresPerCell);
    const slopeRatio = localSlope / Math.max(backgroundSlope, 0.001);
    if (slopeRatio < 3 || drop < 1) continue;
    const candidate = { index: k, distanceM: distances[k]!, slopeRatio, localSlope, backgroundSlope };
    if (previousIndex === k - 1) {
      if (slopeRatio > candidates.at(-1)!.slopeRatio) candidates[candidates.length - 1] = candidate;
    } else candidates.push(candidate);
    previousIndex = k;
  }
  return { resolved, candidates };
}

export interface PersistenceObservation {
  readonly step: number;
  readonly completePath: boolean;
  readonly candidates: readonly KnickpointCandidate[];
}
export interface PersistenceRequest {
  readonly observations: readonly PersistenceObservation[];
  /** Caller must supply an approved calibration; snapshot.simYears alone is insufficient. */
  readonly calibrated: boolean;
  readonly simYearsPerStep: number;
  readonly observationIntervalSteps: number;
  readonly metresPerCell: number;
}
export interface PersistenceResult {
  readonly passed: boolean;
  readonly elapsedYears: number;
  readonly initialDistanceM: number | null;
}

/** Pure history reduction. Missing scheduled samples and incomplete paths reset each track. */
export function knickpointPersistence(request: PersistenceRequest): PersistenceResult {
  const { observationIntervalSteps: interval, simYearsPerStep: years, metresPerCell: l } = request;
  if (
    !Number.isInteger(interval) ||
    interval <= 0 ||
    !Number.isFinite(years) ||
    years <= 0 ||
    !Number.isFinite(l) ||
    l <= 0
  )
    throw new RangeError("Invalid persistence cadence");
  if (!request.calibrated || interval * years > 10)
    return { passed: false, elapsedYears: 0, initialDistanceM: null };
  let tracks: { distance: number; step: number }[] = [],
    previous: number | undefined;
  let lastStep = 0;
  for (const observation of request.observations) {
    if (
      !Number.isInteger(observation.step) ||
      observation.step < 0 ||
      (previous !== undefined && observation.step <= previous)
    )
      throw new RangeError("Observations must increase in fixed steps");
    if (previous !== undefined && observation.step !== previous + interval) tracks = [];
    previous = observation.step;
    lastStep = observation.step;
    if (!observation.completePath) {
      tracks = [];
      continue;
    }
    tracks = tracks.filter((t) =>
      observation.candidates.some((c) => Math.abs(c.distanceM - t.distance) <= 2 * l),
    );
    for (const c of observation.candidates) {
      if (!tracks.some((t) => Math.abs(c.distanceM - t.distance) <= 2 * l))
        tracks.push({ distance: c.distanceM, step: observation.step });
    }
  }
  const oldest = tracks.reduce<{ distance: number; step: number } | undefined>(
    (a, b) => (!a || b.step < a.step ? b : a),
    undefined,
  );
  const elapsedYears = oldest ? (lastStep - oldest.step) * years : 0;
  return { passed: elapsedYears >= 100, elapsedYears, initialDistanceM: oldest?.distance ?? null };
}
