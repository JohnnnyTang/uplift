import type { KnickpointCandidate } from "@hachure/terrain";
export interface ModelStepPersistenceOptions {
  readonly sustainModelSteps: number;
  readonly observationIntervalSteps: number;
  readonly metresPerCell: number;
  readonly maxDisplacementCells: number;
}
export interface SlopeBreakObservation {
  readonly runId: string;
  readonly step: number;
  readonly completePath: boolean;
  readonly resolved: boolean;
  readonly candidates: readonly Pick<KnickpointCandidate, "distanceM">[];
}
/** Operational model-step proxy only. Does not approve a lesson, clock or stamp. */
export class ModelStepSlopeBreakTracker {
  private previous: { runId: string; step: number } | undefined;
  private tracks: { distanceM: number; startStep: number }[] = [];
  constructor(readonly options: ModelStepPersistenceOptions) {
    if (
      !Number.isInteger(options.sustainModelSteps) ||
      options.sustainModelSteps <= 0 ||
      !Number.isInteger(options.observationIntervalSteps) ||
      options.observationIntervalSteps <= 0 ||
      !Number.isFinite(options.metresPerCell) ||
      options.metresPerCell <= 0 ||
      !Number.isFinite(options.maxDisplacementCells) ||
      options.maxDisplacementCells < 0
    )
      throw new RangeError("Invalid model-step persistence definition");
  }
  reset() {
    this.previous = undefined;
    this.tracks = [];
  }
  observe(observation: SlopeBreakObservation) {
    if (
      !observation.runId.trim() ||
      !Number.isInteger(observation.step) ||
      observation.step < 0 ||
      observation.candidates.some((c) => !Number.isFinite(c.distanceM) || c.distanceM < 0)
    )
      throw new RangeError("Invalid slope-break observation");
    const previous = this.previous;
    if (
      previous &&
      (previous.runId !== observation.runId ||
        observation.step !== previous.step + this.options.observationIntervalSteps)
    ) {
      // A view refresh at the same step cannot advance a track; a changed observation can reset it.
      if (previous.runId !== observation.runId || observation.step !== previous.step) this.tracks = [];
    }
    this.previous = { runId: observation.runId, step: observation.step };
    if (!observation.completePath || !observation.resolved) this.tracks = [];
    else {
      const radiusM = this.options.maxDisplacementCells * this.options.metresPerCell;
      this.tracks = this.tracks.filter((track) =>
        observation.candidates.some(
          (candidate) => Math.abs(candidate.distanceM - track.distanceM) <= radiusM,
        ),
      );
      for (const candidate of observation.candidates)
        if (!this.tracks.some((track) => Math.abs(candidate.distanceM - track.distanceM) <= radiusM))
          this.tracks.push({ distanceM: candidate.distanceM, startStep: observation.step });
    }
    const oldest = this.tracks.reduce<(typeof this.tracks)[number] | undefined>(
      (a, b) => (!a || b.startStep < a.startStep ? b : a),
      undefined,
    );
    const elapsedModelSteps = oldest ? observation.step - oldest.startStep : 0;
    return {
      passed: !!oldest && elapsedModelSteps >= this.options.sustainModelSteps,
      elapsedModelSteps,
      initialDistanceM: oldest?.distanceM ?? null,
    };
  }
}
