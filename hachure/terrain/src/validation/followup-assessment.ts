/** <!-- expert-review --> Diagnostic cohorts never replace the original lesson gate. */
import { assessAll, type RunEvidence, type EvidenceSample } from "./assessment";
import { FOLLOWUP_PROTOCOL_ID } from "./followup-protocol";
import { VALIDATION_ARMS, VALIDATION_PROTOCOL as P } from "./protocol";

interface FollowupSample extends EvidenceSample {
  readonly mechanism: {
    readonly bedrockErodedM3: number;
    readonly bandBedrockErodedM3: number;
    readonly bandMinimumCoverM: number;
    readonly wetExposedBandCells: number;
  };
}
export interface FollowupRun extends RunEvidence {
  readonly protocolId: string;
  readonly solverCommit: string;
  readonly samples: readonly FollowupSample[];
}
function validateCohort(runs: readonly RunEvidence[], protocolId: string) {
  if (runs.length !== P.seeds.length * VALIDATION_ARMS.length) throw new Error("Incomplete cohort");
  for (const seed of P.seeds)
    for (const arm of VALIDATION_ARMS) {
      const matches = runs.filter((r) => r.seed === seed && r.arm === arm);
      if (matches.length !== 1) throw new Error("Duplicate or missing seed/arm");
      if ((matches[0] as FollowupRun).protocolId !== protocolId) throw new Error("Wrong protocol");
    }
}
export function assessFollowup(
  originals: readonly RunEvidence[],
  replay: readonly FollowupRun[],
  revised: readonly FollowupRun[],
) {
  validateCohort(originals, P.id);
  validateCohort(replay, P.id);
  validateCohort(revised, FOLLOWUP_PROTOCOL_ID);
  const ordered = (runs: readonly FollowupRun[]) =>
    P.seeds.flatMap((seed) =>
      VALIDATION_ARMS.map((arm) => runs.find((r) => r.seed === seed && r.arm === arm)!),
    );
  replay = ordered(replay);
  revised = ordered(revised);
  const reproducibility = replay.map((r) => {
    const original = originals.find((o) => o.seed === r.seed && o.arm === r.arm)!;
    const stripped = r.samples.map(({ mechanism: _mechanism, ...s }) => s);
    return {
      seed: r.seed,
      arm: r.arm,
      configMatches: r.configHash === original.configHash,
      finalHashMatches: r.finalHash === original.finalHash,
      samplesMatch: JSON.stringify(stripped) === JSON.stringify(original.samples),
      calibrationMatches: JSON.stringify(r.calibration) === JSON.stringify(original.calibration),
    };
  });
  const baseline = assessAll(replay);
  const conditional = { ...assessAll(revised), protocolId: FOLLOWUP_PROTOCOL_ID };
  const mechanism = (runs: readonly FollowupRun[]) =>
    runs.map((r) => {
      const last = r.samples.at(-1)!;
      return {
        seed: r.seed,
        arm: r.arm,
        ...last.mechanism,
        minimumBandCoverOverSamplesM: Math.min(...r.samples.map((s) => s.mechanism.bandMinimumCoverM)),
        reachIncomingFractionOfInitial:
          r.initialSuspendedM3 > 0 ? (last.reach.transfers?.incomingM3 ?? 0) / r.initialSuspendedM3 : null,
        netReachDepositM3: last.reach.depositedChangeM3,
      };
    });
  return {
    protocolId: FOLLOWUP_PROTOCOL_ID,
    preregistrationCommits: [...new Set([...replay, ...revised].map((r) => r.solverCommit))],
    expertReview: "pending",
    thresholds: {
      hardBandWidthRatio: P.hardBandWidthRatio,
      widthMinimumCells: P.widthMinimumCells,
      metresPerCell: P.metresPerCell,
    },
    historicalPredicatesChanged: false,
    educationalAcceptance: {
      status: "pending-visual-and-lesson-evidence",
      policyPath: "docs/science/education-policy.md",
      fieldCalibrationRequiredForQualitativeLesson: false,
    },
    reproducibilityPassed: reproducibility.every(
      (r) => r.configMatches && r.finalHashMatches && r.samplesMatch && r.calibrationMatches,
    ),
    reproducibility,
    baseline,
    conditional,
    mechanism: { baseline: mechanism(replay), revised: mechanism(revised) },
  };
}
