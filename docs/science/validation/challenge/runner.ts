/** <!-- expert-review --> Preregistered real process-solver experiment; no synthetic morphology. */
import {
  createCpuSolver,
  createTiltedPlateauPreset,
  extractChannel,
  sampleChannelProfile,
  detectKnickpoints,
  type ReferenceLayers,
  type BudgetCounters,
  type ChannelResult,
} from "@hachure/terrain";
import { ModelStepSlopeBreakTracker } from "../../../../hachure/runtime/src/challenge/model-steps";
import { CHALLENGE_PROTOCOL as P, challengeConfig } from "./protocol";
const delta = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let v = 0;
  for (let i = 0; i < a.length; i++) v += b[i]! - a[i]!;
  return v;
};
const sum = (a: ArrayLike<number>) => {
  let v = 0;
  for (let i = 0; i < a.length; i++) v += a[i]!;
  return v;
};
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
    passed:
      Math.abs(solidM3) <= Math.max(1e-6, 0.01 * solidReferenceM3) &&
      Math.abs(waterM3) <= Math.max(1e-6, 0.01 * waterReferenceM3),
  };
}
function stocksValid(layers: ReferenceLayers) {
  return Object.entries(layers).every(([key, values]) =>
    Array.from(values).every((v) => Number.isFinite(v) && (key === "bedrockM" || v >= 0)),
  );
}
function yAt(path: ChannelResult, distanceM: number) {
  for (let i = 1; i < path.path.length; i++) {
    const a = path.path[i - 1]!,
      b = path.path[i]!,
      length = Math.hypot(b.xM - a.xM, b.yM - a.yM);
    if (distanceM <= length) return a.yM + ((b.yM - a.yM) * distanceM) / length;
    distanceM -= length;
  }
  return path.path.at(-1)!.yM;
}
export interface ExperimentIO {
  readonly registrationCommit: string;
  readonly sourceHashes: Record<string, string>;
  sha256(value: string): string;
  write(name: string, value: unknown): void;
  log(value: unknown): void;
}
export async function runChallengeSeed(seed: number, io: ExperimentIO) {
  if (!(P.seeds as readonly number[]).includes(seed)) throw new Error("Unregistered seed");
  for (const arm of P.arms) {
    const started = performance.now(),
      config = challengeConfig(seed);
    const preset = createTiltedPlateauPreset({ looseThicknessM: 0 }),
      layout = preset.layout(config);
    const solver = createCpuSolver(config, preset, { waveGuard: "halt" });
    await solver.applyTool(layout.source);
    const initial = solver.referenceLayers(),
      initialHash = await solver.hash();
    const tracker = new ModelStepSlopeBreakTracker(P);
    const tools = [];
    const samples = [];
    let rejected: string | null = null,
      interventionHash: string | null = null,
      toolGroundChangeM = 0;
    for (let step = 0; step <= P.horizonSteps; step += P.observationIntervalSteps) {
      try {
        if (step > 0) solver.step(P.observationIntervalSteps);
        if (step === P.warmupSteps) {
          const before = solver.referenceLayers();
          for (const row of [73, 74])
            for (let x = 0; x < P.gridSize; x++) {
              const op = {
                kind: "harden" as const,
                at: { xM: (x + 0.5) * P.metresPerCell, yM: (row + 0.5) * P.metresPerCell },
                radiusM: P.metresPerCell,
                hardness: arm === "hard-band" ? P.bandHardness : P.uniformHardness,
              };
              tools.push({ op, result: await solver.applyTool(op) });
            }
          const after = solver.referenceLayers();
          for (let i = 0; i < before.bedrockM.length; i++)
            toolGroundChangeM = Math.max(
              toolGroundChangeM,
              Math.abs(
                after.bedrockM[i]! + after.sedimentM[i]! - (before.bedrockM[i]! + before.sedimentM[i]!),
              ),
            );
          interventionHash = await solver.hash();
        }
        const snapshot = await solver.snapshot(),
          layers = solver.referenceLayers(),
          budget = await solver.budget();
        const path = extractChannel(snapshot, { source: layout.source.at });
        const profile = path.path.length >= 2 ? sampleChannelProfile(snapshot, path) : null;
        const detection = profile
          ? detectKnickpoints(profile, P.metresPerCell)
          : { resolved: false, candidates: [] };
        const candidates = detection.candidates.map((c) => ({ ...c, yM: yAt(path, c.distanceM) }));
        const eligible = candidates.filter(
          (c) =>
            c.yM >= P.firstEligibleRow * P.metresPerCell && c.yM < P.toBandRowExclusive * P.metresPerCell,
        );
        const persistence =
          step >= P.warmupSteps
            ? tracker.observe({
                runId: `${seed}/${arm}`,
                step,
                completePath: path.complete,
                resolved: detection.resolved,
                candidates: eligible,
              })
            : { passed: false, elapsedModelSteps: 0, initialDistanceM: null };
        const validStocks = stocksValid(layers),
          residual = residuals(initial, layers, budget);
        samples.push({
          step,
          path: { complete: path.complete, stoppedAt: path.stoppedAt, method: path.method },
          resolved: detection.resolved,
          candidates,
          eligible,
          persistence,
          budget,
          residual,
          validStocks,
          profile: profile
            ? { distanceM: Array.from(profile.distanceM), groundM: Array.from(profile.groundM) }
            : null,
        });
      } catch (error) {
        rejected = error instanceof Error ? error.message : String(error);
        break;
      }
    }
    const last = samples.at(-1)!;
    const record = {
      protocolId: P.id,
      registrationCommit: io.registrationCommit,
      sourceHashes: io.sourceHashes,
      config,
      configHash: io.sha256(JSON.stringify(config)),
      seed,
      arm,
      initialHash,
      interventionHash,
      finalHash: await solver.hash(),
      completedSteps: solver.stepCount,
      rejected,
      toolGroundChangeM,
      tools,
      diagnostics: solver.diagnostics(),
      samples,
      endpointPassed: last.persistence.passed,
      everPassed: samples.some((s) => s.persistence.passed),
      allNumericallyValid:
        !rejected &&
        samples.every((s) => s.validStocks && s.residual.passed) &&
        toolGroundChangeM === 0 &&
        last.budget.toolNetM3 === 0,
      elapsedWallSeconds: (performance.now() - started) / 1000,
    };
    io.write(`seed-${seed}-${arm}.json`, record);
    io.log({
      seed,
      arm,
      endpointPassed: record.endpointPassed,
      everPassed: record.everPassed,
      allNumericallyValid: record.allNumericallyValid,
      candidates: Math.max(...samples.map((s) => s.candidates.length)),
      completedSteps: record.completedSteps,
      wallSeconds: record.elapsedWallSeconds,
    });
    solver.dispose();
  }
}
