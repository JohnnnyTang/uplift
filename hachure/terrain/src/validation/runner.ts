/** <!-- expert-review --> Reproducible preregistered evidence; failed claims stay failed. */
import { FOLLOWUP_PROTOCOL_ID, followupPreset } from "./followup-protocol";
import { createCpuSolver, type ReferenceLayers } from "../cpu/index";
import type { BudgetCounters, StateSnapshot } from "../contract/index";
import { createTiltedPlateauPreset } from "../presets/index";
import {
  extractChannel,
  sampleChannelProfile,
  halfDepthWidth,
  detectKnickpoints,
  type ChannelResult,
} from "../probes/index";
import {
  measureFixedSectionIncision,
  validationMedian,
  validationSectionRows,
  type SectionSurface,
} from "./metrics";
import { VALIDATION_PROTOCOL as P, VALIDATION_ARMS, validationConfig, validationPreset } from "./protocol";

const surface = (layers: ReferenceLayers): SectionSurface => ({
  gridSize: P.gridSize,
  metresPerCell: P.metresPerCell,
  ...layers,
});
const csv = (rows: readonly (readonly (number | string | boolean | null)[])[]) =>
  rows
    .map((row) =>
      row.map((v) => (v === null ? "" : typeof v === "string" ? JSON.stringify(v) : String(v))).join(","),
    )
    .join("\n") + "\n";
function sum(a: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]!;
  return s;
}
function delta(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += b[i]! - a[i]!;
  return s;
}
function residuals(initial: ReferenceLayers, current: ReferenceLayers, b: BudgetCounters) {
  const area = P.metresPerCell ** 2;
  const solidM3 =
    area *
      (delta(initial.bedrockM, current.bedrockM) +
        delta(initial.sedimentM, current.sedimentM) +
        delta(initial.suspendedSedimentM, current.suspendedSedimentM)) +
    b.exportedSedimentM3 -
    b.toolNetM3;
  const waterM3 =
    area * delta(initial.waterM, current.waterM) -
    b.rainedWaterM3 -
    b.sourcedWaterM3 +
    b.evaporatedWaterM3 +
    b.outflowedWaterM3;
  const solidReferenceM3 = Math.max(b.erodedM3, area * sum(initial.suspendedSedimentM), b.exportedSedimentM3);
  const waterReferenceM3 = Math.max(area * sum(initial.waterM), b.rainedWaterM3 + b.sourcedWaterM3);
  return {
    solidM3,
    waterM3,
    solidReferenceM3,
    waterReferenceM3,
    solidPassed: Math.abs(solidM3) <= Math.max(1e-6, 0.01 * solidReferenceM3),
    waterPassed: Math.abs(waterM3) <= Math.max(1e-6, 0.01 * waterReferenceM3),
  };
}
function reachStocks(layers: ReferenceLayers) {
  let deposited = 0,
    suspended = 0;
  for (let i = 64 * 128; i < 120 * 128; i++) {
    deposited += layers.sedimentM[i]!;
    suspended += layers.suspendedSedimentM[i]!;
  }
  return { depositedM3: deposited * 100, suspendedM3: suspended * 100 };
}
function widths(snapshot: StateSnapshot) {
  return validationSectionRows(P.gridSize).map((row) => ({ row, ...halfDepthWidth(snapshot, { row }) }));
}
function profile(snapshot: StateSnapshot, path: ChannelResult | null) {
  if (!path || path.path.length < 2) return null;
  return sampleChannelProfile(snapshot, path);
}
function candidatesFor(snapshot: StateSnapshot, path: ChannelResult | null) {
  const p = profile(snapshot, path);
  if (!p || !path) return [];
  return detectKnickpoints(p, P.metresPerCell).candidates.map((candidate) => {
    let remaining = candidate.distanceM,
      yM = path.path[0]!.yM;
    for (let j = 1; j < path.path.length; j++) {
      const a = path.path[j - 1]!,
        b = path.path[j]!,
        length = Math.hypot(b.xM - a.xM, b.yM - a.yM);
      if (remaining <= length) {
        yM = a.yM + ((b.yM - a.yM) * remaining) / length;
        break;
      }
      remaining -= length;
    }
    return { ...candidate, yM, eligibleReach: yM >= 64 * 10 && yM < 76 * 10 };
  });
}
function stocksValid(layers: ReferenceLayers): boolean {
  for (let i = 0; i < layers.bedrockM.length; i++) {
    if (!Number.isFinite(layers.bedrockM[i])) return false;
    for (const layer of [layers.sedimentM, layers.suspendedSedimentM, layers.waterM])
      if (!(layer[i]! >= 0) || !Number.isFinite(layer[i])) return false;
  }
  return true;
}

export interface ValidationRunIO {
  readonly solverCommit: string;
  readonly sourceHashes: Readonly<Record<string, string>>;
  sha256(text: string): string;
  writeFile(name: string, content: string): void;
  log(value: string): void;
}
export async function runValidation(seed: number, io: ValidationRunIO, revised = false): Promise<void> {
  if (!(P.seeds as readonly number[]).includes(seed)) throw new Error("Run only preregistered seeds");
  const { solverCommit, sourceHashes } = io;
  const sha = io.sha256;
  const records = [];
  for (const arm of VALIDATION_ARMS) {
    const started = performance.now();
    const config = validationConfig(seed, arm),
      preset = revised ? followupPreset(arm) : validationPreset(arm),
      layout = createTiltedPlateauPreset().layout(config);
    const transport = arm.startsWith("slope-");
    const solver = createCpuSolver(
      config,
      preset,
      transport ? { sedimentReach: { firstRow: 64, lastRowExclusive: 120 } } : {},
    );
    await solver.applyTool(layout.source);
    const initial = solver.referenceLayers();
    const initialHash = await solver.hash();
    const initialReach = reachStocks(initial);
    let warmup: ReferenceLayers | null = null,
      baselinePath: ChannelResult | null = null;
    const samples = [];
    const profileRows: (number | string | boolean | null)[][] = [
      ["step", "pathKind", "complete", "distanceM", "groundM", "waterM"],
    ];
    const sectionRows: (number | string | boolean | null)[][] = [
      ["step", "row", "xM", "groundM", "waterM", "southDischargeM3PerS"],
    ];
    let halted: string | null = null;
    const horizon = transport ? P.transportSteps : P.landscapeSteps;
    for (let step = 0; step <= horizon; step += P.sampleIntervalSteps) {
      if (step > 0) {
        try {
          solver.step(P.sampleIntervalSteps);
        } catch (error) {
          halted = String(error);
          break;
        }
      }
      const current = solver.referenceLayers(),
        snapshot = await solver.snapshot(),
        budget = await solver.budget();
      const currentPath = extractChannel(snapshot, { source: layout.source.at });
      if (step === P.warmupSteps) {
        warmup = current;
        baselinePath = currentPath;
      }
      const fixedProfile = profile(snapshot, baselinePath),
        liveProfile = profile(snapshot, currentPath);
      const incision = measureFixedSectionIncision(surface(initial), surface(current));
      const closure = residuals(initial, current, budget);
      const bandWidth = halfDepthWidth(snapshot, { row: 74 });
      const reach = reachStocks(current);
      let bandMinimumCoverM = Infinity,
        bandBedrockErodedM3 = 0,
        wetExposedBandCells = 0;
      for (let i = 72 * 128; i < 76 * 128; i++) {
        bandMinimumCoverM = Math.min(bandMinimumCoverM, current.sedimentM[i]!);
        bandBedrockErodedM3 += (initial.bedrockM[i]! - current.bedrockM[i]!) * 100;
        if (current.sedimentM[i]! === 0 && current.waterM[i]! > 1e-6) wetExposedBandCells++;
      }
      const sample = {
        mechanism: {
          bedrockErodedM3: -delta(initial.bedrockM, current.bedrockM) * 100,
          bandBedrockErodedM3,
          bandMinimumCoverM,
          wetExposedBandCells,
        },
        step,
        hydraulicSeconds: step * config.dtSimSeconds,
        incisionM: incision.medianIncisionM,
        sections: incision.sections,
        widths: widths(snapshot),
        bandWidth,
        baselineComplete: baselinePath?.complete ?? null,
        currentComplete: currentPath.complete,
        currentStoppedAt: currentPath.stoppedAt,
        knickpointCandidates: candidatesFor(snapshot, currentPath),
        baselineKnickpointCandidates: candidatesFor(snapshot, baselinePath),
        finiteNonnegativeStocks: stocksValid(current),
        closure,
        budget,
        peakWaveCourant: solver.diagnostics().peakWaveCourant,
        reach: {
          ...reach,
          depositedChangeM3: reach.depositedM3 - initialReach.depositedM3,
          transfers: solver.sedimentReachBudget() ?? null,
        },
      };
      samples.push(sample);
      if (step === 0 || step === P.warmupSteps || step === horizon) {
        for (const [kind, p, path] of [
          ["baseline", fixedProfile, baselinePath],
          ["current", liveProfile, currentPath],
        ] as const)
          if (p)
            for (let j = 0; j < p.distanceM.length; j++)
              profileRows.push([
                step,
                kind,
                path?.complete ?? false,
                p.distanceM[j]!,
                p.groundM[j]!,
                p.waterM[j]!,
              ]);
        for (const row of validationSectionRows(P.gridSize))
          for (let x = 0; x < P.gridSize; x++) {
            const i = row * P.gridSize + x;
            sectionRows.push([
              step,
              row,
              (x + 0.5) * 10,
              current.bedrockM[i]! + current.sedimentM[i]!,
              current.waterM[i]!,
              snapshot.layers.fluxSouthM3PerS![i]!,
            ]);
          }
      }
    }
    const final = solver.referenceLayers();
    const calibration = warmup ? measureFixedSectionIncision(surface(warmup), surface(final)) : null;
    const last = samples.at(-1)!;
    const validCalibrationSections =
      calibration?.sections.map((section) => {
        const row = section.row;
        let min = Infinity,
          minimum = -1;
        for (let x = 0; x < 128; x++)
          if ((x + 0.5) / 128 >= 0.35 && (x + 0.5) / 128 <= 0.65) {
            const i = row * 128 + x,
              z = final.bedrockM[i]! + final.sedimentM[i]!;
            if (z < min) {
              min = z;
              minimum = i;
            }
          }
        const reasons: string[] = [];
        if (!(section.incisionM > 0)) reasons.push("nonpositive-incision");
        if (minimum < 0 || final.waterM[minimum]! <= 1e-6) reasons.push("dry-section");
        if (!last.widths.find((w) => w.row === row)?.resolved) reasons.push("unresolved-width");
        if (!baselinePath?.complete) reasons.push("incomplete-baseline-path");
        if (halted || last.step !== horizon) reasons.push("incomplete-run");
        return { ...section, valid: reasons.length === 0, reasons };
      }) ?? [];
    const validDrops = validCalibrationSections.filter((s) => s.valid).map((s) => s.incisionM);
    const D = validDrops.length >= 3 ? validationMedian(validDrops) : null;
    const candidateFactor =
      D === null
        ? null
        : ((D / (P.landscapeSteps - P.warmupSteps) / P.calibrationTargetMPerYear) * 31_557_600) /
          config.dtSimSeconds;
    const calibrationRecord =
      arm === "uniform"
        ? {
            status: candidateFactor === null ? "failed" : "pending-expert-review",
            approval: { status: "pending", approver: null, approvedAt: null },
            sectionBaselineStep: P.warmupSteps,
            measuredSteps: P.landscapeSteps - P.warmupSteps,
            sections: validCalibrationSections,
            medianPositiveIncisionM: D,
            targetMPerYear: P.calibrationTargetMPerYear,
            targetRangeMPerYear: P.calibrationTargetRangeMPerYear,
            targetSource:
              "docs/science/time-scale.md; provisional K01 catchment-denudation analogy, not local incision data",
            candidateMorphAccelerationFactor: candidateFactor,
            candidateWithinStorageBounds:
              candidateFactor !== null && candidateFactor >= 1 && candidateFactor <= 1e9,
            installedMorphAccelerationFactor: config.morphAccelerationFactor,
            displayLabel: "Landscape time not calibrated",
          }
        : null;
    const record = {
      arm,
      seed,
      protocolId: revised ? FOLLOWUP_PROTOCOL_ID : P.id,
      solverCommit,
      sourceHashes,
      config,
      configHash: sha(JSON.stringify(config)),
      presetId: preset.id,
      presetHash: initialHash,
      finalHash: await solver.hash(),
      outletBaseLevelM: solver.outletBaseLevelM,
      source: layout.source,
      toolLog: [],
      horizonSteps: horizon,
      sampleIntervalSteps: P.sampleIntervalSteps,
      completedSteps: solver.stepCount,
      halted,
      diagnostics: solver.diagnostics(),
      allBudgetSamplesPassed: samples.every((s) => s.closure.solidPassed && s.closure.waterPassed),
      initialSuspendedM3: sum(initial.suspendedSedimentM) * 100,
      baselinePath,
      samples,
      calibration: calibrationRecord,
      elapsedWallSeconds: (performance.now() - started) / 1000,
    };
    io.writeFile(`seed-${seed}-${arm}.json`, JSON.stringify(record, null, 2) + "\n");
    io.writeFile(
      `seed-${seed}-${arm}.csv`,
      csv([
        [
          "step",
          "hydraulicSeconds",
          "incisionM",
          "widthMedianM",
          "solidResidualM3",
          "waterResidualM3",
          "erodedM3",
          "depositedM3",
          "exportedM3",
          "reachDepositM3",
          "reachIncomingM3",
          "reachOutgoingM3",
          "reachSuspendedM3",
          "baselineComplete",
          "currentComplete",
        ],
        ...samples.map((s) => {
          const w = s.widths.flatMap((w) => (w.resolved ? [w.widthM] : []));
          return [
            s.step,
            s.hydraulicSeconds,
            s.incisionM,
            w.length ? validationMedian(w) : null,
            s.closure.solidM3,
            s.closure.waterM3,
            s.budget.erodedM3,
            s.budget.depositedM3,
            s.budget.exportedSedimentM3,
            s.reach.depositedChangeM3,
            s.reach.transfers?.incomingM3 ?? null,
            s.reach.transfers?.outgoingM3 ?? null,
            s.reach.suspendedM3,
            s.baselineComplete,
            s.currentComplete,
          ];
        }),
      ]),
    );
    io.writeFile(`seed-${seed}-${arm}-profiles.csv`, csv(profileRows));
    io.writeFile(`seed-${seed}-${arm}-sections.csv`, csv(sectionRows));
    records.push(record);
    io.log(
      JSON.stringify({
        seed,
        arm,
        steps: solver.stepCount,
        incisionM: last.incisionM,
        budgets: record.allBudgetSamplesPassed,
        halted,
        wallSeconds: record.elapsedWallSeconds,
      }),
    );
    solver.dispose();
  }
  io.writeFile(
    `seed-${seed}-complete.json`,
    JSON.stringify(
      {
        seed,
        arms: records.map((r) => ({
          arm: r.arm,
          completedSteps: r.completedSteps,
          configHash: r.configHash,
          finalHash: r.finalHash,
        })),
      },
      null,
      2,
    ) + "\n",
  );
}
