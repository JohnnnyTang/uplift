/** <!-- expert-review --> Preregistered claims evaluated without tuning thresholds after the run. */
import { knickpointPersistence, type KnickpointCandidate } from "../probes/index";
import { SECONDS_PER_YEAR } from "../contract/index";
import { validationMedian } from "./metrics";
import { VALIDATION_PROTOCOL as P, VALIDATION_ARMS, type ValidationArm } from "./protocol";

type Width = { readonly resolved: false } | { readonly resolved: true; readonly widthM: number };
interface Candidate extends KnickpointCandidate {
  readonly eligibleReach: boolean;
}
export interface EvidenceSample {
  readonly step: number;
  readonly incisionM: number | null;
  readonly widths: readonly (Width & { readonly row: number })[];
  readonly bandWidth: Width;
  readonly baselineComplete: boolean | null;
  readonly currentComplete: boolean;
  readonly finiteNonnegativeStocks: boolean;
  readonly baselineKnickpointCandidates: readonly Candidate[];
  readonly reach: {
    readonly depositedChangeM3: number;
    readonly suspendedM3: number;
    readonly transfers: { readonly incomingM3: number; readonly outgoingM3: number } | null;
  };
}
export interface CalibrationEvidence {
  readonly status: string;
  readonly approval: {
    readonly status: string;
    readonly approver: string | null;
    readonly approvedAt: string | null;
  };
  readonly candidateMorphAccelerationFactor: number | null;
  readonly installedMorphAccelerationFactor: number;
  readonly medianPositiveIncisionM: number | null;
  readonly candidateWithinStorageBounds: boolean;
  readonly displayLabel: string;
}
export interface RunEvidence {
  readonly arm: ValidationArm;
  readonly seed: number;
  readonly configHash: string;
  readonly finalHash: string;
  readonly completedSteps: number;
  readonly horizonSteps: number;
  readonly halted: string | null;
  readonly allBudgetSamplesPassed: boolean;
  readonly initialSuspendedM3: number;
  readonly diagnostics: { readonly waveGuard: string; readonly waveGuardViolationSteps: number };
  readonly samples: readonly EvidenceSample[];
  readonly calibration: CalibrationEvidence | null;
  readonly config: {
    readonly metresPerCell: number;
    readonly dtSimSeconds: number;
    readonly morphAccelerationFactor: number;
  };
}
function healthy(run: RunEvidence): boolean {
  return (
    run.completedSteps === run.horizonSteps &&
    run.halted === null &&
    run.allBudgetSamplesPassed &&
    run.diagnostics.waveGuard === "halt" &&
    run.diagnostics.waveGuardViolationSteps === 0 &&
    run.samples.every((s) => s.finiteNonnegativeStocks)
  );
}
function matchedWidths(low: EvidenceSample, high: EvidenceSample) {
  const dry: number[] = [],
    wet: number[] = [];
  for (const a of low.widths) {
    const b = high.widths.find((b) => b.row === a.row);
    if (a.resolved && b?.resolved) {
      dry.push(a.widthM);
      wet.push(b.widthM);
    }
  }
  return dry.length >= 3
    ? { count: dry.length, dryM: validationMedian(dry), wetM: validationMedian(wet) }
    : null;
}
function incisionComparison(low: EvidenceSample, high: EvidenceSample) {
  if (low.step !== high.step || low.incisionM === null || high.incisionM === null)
    return { incisionDifferenceM: null, incisionMarginM: null };
  return {
    incisionDifferenceM: high.incisionM - low.incisionM,
    incisionMarginM: Math.max(P.incisionMinimumM, P.incisionRelativeMargin * Math.abs(low.incisionM)),
  };
}
function predictionSample(low: EvidenceSample, high: EvidenceSample, l: number) {
  const widths = matchedWidths(low, high);
  const incision = incisionComparison(low, high);
  const { incisionDifferenceM, incisionMarginM } = incision;
  if (incisionDifferenceM === null || incisionMarginM === null || !widths)
    return {
      classification: null,
      ...incision,
      widthDifferenceM: null,
      widthMarginM: null,
      resolvedSections: widths?.count ?? 0,
    };
  const widthDifferenceM = widths.wetM - widths.dryM;
  const widthMarginM = Math.max(P.widthMinimumCells * l, P.widthRelativeMargin * widths.dryM);
  const deeper = incisionDifferenceM >= incisionMarginM && high.incisionM! > 0;
  const wider = widthDifferenceM >= widthMarginM;
  const decreased = incisionDifferenceM < -incisionMarginM || widthDifferenceM < -widthMarginM;
  const classification = decreased ? null : deeper ? (wider ? "both" : "deeper") : wider ? "wider" : null;
  return {
    classification,
    incisionDifferenceM,
    incisionMarginM,
    widthDifferenceM,
    widthMarginM,
    resolvedSections: widths.count,
  };
}
export function assessSeed(runs: readonly RunEvidence[]) {
  const get = (arm: ValidationArm) => {
    const run = runs.find((r) => r.arm === arm);
    if (!run) throw new Error("Missing arm " + arm);
    return run;
  };
  const low = get("rain-low"),
    high = get("rain-high"),
    uniform = get("uniform"),
    band = get("hard-band"),
    flat = get("slope-low"),
    steep = get("slope-high");
  const seed = low.seed;
  if (runs.some((run) => run.seed !== seed)) throw new Error("Paired runs must share a seed");
  const rainHealthy = healthy(low) && healthy(high);
  const rainLastThree = low.samples
    .slice(-3)
    .map((s, index) =>
      predictionSample(s, high.samples[high.samples.length - 3 + index]!, low.config.metresPerCell),
    );
  const rainPassed =
    rainHealthy &&
    rainLastThree.length === 3 &&
    rainLastThree.every(
      (s) =>
        s.incisionDifferenceM !== null &&
        s.incisionMarginM !== null &&
        s.incisionDifferenceM >= s.incisionMarginM,
    ) &&
    high.samples.slice(-3).every((s) => s.incisionM !== null && s.incisionM > 0);
  const classes = rainLastThree.map((s) => s.classification);
  const classification =
    rainHealthy && classes.length === 3 && classes.every((c) => c !== null && c === classes[0])
      ? classes[0]!
      : null;
  const answer =
    classification === "deeper" ? 0 : classification === "wider" ? 1 : classification === "both" ? 2 : null;
  const uniformLast = uniform.samples.at(-1)!,
    bandLast = band.samples.at(-1)!;
  const widthPass =
    uniformLast.bandWidth.resolved &&
    bandLast.bandWidth.resolved &&
    bandLast.bandWidth.widthM <= P.hardBandWidthRatio * uniformLast.bandWidth.widthM &&
    uniformLast.bandWidth.widthM - bandLast.bandWidth.widthM >=
      P.widthMinimumCells * uniform.config.metresPerCell;
  const calibration = uniform.calibration;
  const approved =
    calibration?.approval.status === "approved" &&
    !!calibration.approval.approver &&
    !!calibration.approval.approvedAt;
  const persistence = (run: RunEvidence) =>
    knickpointPersistence({
      observations: run.samples
        .filter((s) => s.step >= P.warmupSteps)
        .map((s) => ({
          step: s.step,
          completePath: s.baselineComplete === true,
          candidates: s.baselineKnickpointCandidates.filter((c) => c.eligibleReach),
        })),
      calibrated: approved,
      simYearsPerStep: (run.config.dtSimSeconds * run.config.morphAccelerationFactor) / SECONDS_PER_YEAR,
      observationIntervalSteps: P.sampleIntervalSteps,
      metresPerCell: run.config.metresPerCell,
    });
  const bandPersistence = persistence(band),
    uniformPersistence = persistence(uniform);
  const bandPassed =
    healthy(band) &&
    healthy(uniform) &&
    widthPass &&
    approved &&
    bandPersistence.passed &&
    !uniformPersistence.passed;
  const flatLast = flat.samples.at(-1)!,
    steepLast = steep.samples.at(-1)!;
  const depositionDifferenceM3 = flatLast.reach.depositedChangeM3 - steepLast.reach.depositedChangeM3;
  const depositionMarginM3 = P.depositionFractionOfInitial * flat.initialSuspendedM3;
  const delivered =
    (flatLast.reach.transfers?.incomingM3 ?? 0) > 0 && (steepLast.reach.transfers?.incomingM3 ?? 0) > 0;
  const reachResidual = (s: EvidenceSample) =>
    s.reach.depositedChangeM3 +
    s.reach.suspendedM3 -
    (s.reach.transfers?.incomingM3 ?? 0) +
    (s.reach.transfers?.outgoingM3 ?? 0);
  const reachClosed = [flat, steep].every((r) =>
    r.samples.every((s) => Math.abs(reachResidual(s)) <= Math.max(1e-6, 0.01 * r.initialSuspendedM3)),
  );
  const slopePassed =
    healthy(flat) &&
    healthy(steep) &&
    delivered &&
    reachClosed &&
    depositionDifferenceM3 >= depositionMarginM3;
  return {
    seed,
    engineeringHealthy: runs.every(healthy),
    ac3a: { passed: rainPassed, status: rainPassed ? "passed" : "failed", finalSamples: rainLastThree },
    ac3b: {
      passed: bandPassed,
      status: bandPassed ? "passed" : !widthPass ? "failed" : "blocked-calibration",
      widthPassed: widthPass,
      uniformWidthM: uniformLast.bandWidth.resolved ? uniformLast.bandWidth.widthM : null,
      bandWidthM: bandLast.bandWidth.resolved ? bandLast.bandWidth.widthM : null,
      approvedCalibration: approved,
      bandPersistence,
      uniformPersistence,
      completeBaselinePaths: uniformLast.baselineComplete === true && bandLast.baselineComplete === true,
      bandEligibleCandidates: bandLast.baselineKnickpointCandidates.filter((c) => c.eligibleReach).length,
    },
    ac3c: {
      passed: slopePassed,
      status: slopePassed ? "passed" : "failed",
      depositionDifferenceM3,
      depositionMarginM3,
      delivered,
      reachClosed,
      flat: flatLast.reach,
      steep: steepLast.reach,
    },
    prediction: {
      status: answer === null ? "inconclusive" : "supported",
      classification,
      answer,
      expertApproved: false,
    },
    calibration,
    runs: VALIDATION_ARMS.map(get).map((r) => ({
      arm: r.arm,
      configHash: r.configHash,
      finalHash: r.finalHash,
      completedSteps: r.completedSteps,
      healthy: healthy(r),
    })),
  };
}
export function assessAll(runs: readonly RunEvidence[]) {
  const seeds = P.seeds.map((seed) => assessSeed(runs.filter((r) => r.seed === seed)));
  const first = seeds[0]!.prediction.answer;
  const answer = first !== null && seeds.every((s) => s.prediction.answer === first) ? first : null;
  return {
    protocolId: P.id,
    expertReview: "pending",
    seeds,
    allEngineeringChecksPassed: seeds.every((s) => s.engineeringHealthy),
    allQualitativeClaimsPassed: seeds.every((s) => s.ac3a.passed && s.ac3b.passed && s.ac3c.passed),
    prediction: { answer, status: answer === null ? "inconclusive" : "supported", expertApproved: false },
    landscapeTime: { status: "uncalibrated", displayLabel: "Landscape time not calibrated", approved: false },
  };
}
