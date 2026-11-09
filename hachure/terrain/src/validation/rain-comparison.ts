/** <!-- expert-review --> Gross erosion, not incision. See rain-comparison/protocol.md. */
import type { TerrainConfig, BudgetCounters } from "../contract/index";
import { VALIDATION_PROTOCOL as P, validationConfig } from "./protocol";
import { FOLLOWUP_PROTOCOL_ID } from "./followup-protocol";

export interface RainRun {
  readonly arm: string;
  readonly seed: number;
  readonly protocolId: string;
  readonly solverCommit: string;
  readonly sourceHashes: Readonly<Record<string, string>>;
  readonly presetHash: string;
  readonly config: TerrainConfig;
  readonly source: unknown;
  readonly toolLog: readonly unknown[];
  readonly horizonSteps: number;
  readonly completedSteps: number;
  readonly halted: string | null;
  readonly diagnostics: { readonly waveGuard: string; readonly waveGuardViolationSteps: number };
  readonly samples: readonly {
    readonly step: number;
    readonly finiteNonnegativeStocks: boolean;
    readonly closure: {
      readonly solidM3: number;
      readonly waterM3: number;
      readonly solidReferenceM3: number;
      readonly waterReferenceM3: number;
    };
    readonly budget: BudgetCounters;
  }[];
}

/** Fail closed: never build a scored lesson from a partial or unmatched cohort. */
export function extractRainComparison(runs: readonly RainRun[]) {
  if (runs.length !== P.seeds.length * 2) throw new Error("Incomplete rain cohort");
  const pairs = P.seeds.map((seed) => {
    const arms = ["rain-low", "rain-high"].map((arm) => {
      const matches = runs.filter((r) => r.seed === seed && r.arm === arm);
      if (matches.length !== 1) throw new Error("Duplicate or missing rain arm");
      const r = matches[0]!;
      if (
        r.protocolId !== FOLLOWUP_PROTOCOL_ID ||
        r.horizonSteps !== P.landscapeSteps ||
        r.completedSteps !== P.landscapeSteps ||
        r.halted !== null ||
        r.diagnostics.waveGuard !== "halt" ||
        r.diagnostics.waveGuardViolationSteps !== 0 ||
        r.config.gridSize !== P.gridSize ||
        r.config.metresPerCell !== P.metresPerCell ||
        r.config.dtSimSeconds !== P.dtSimSeconds ||
        JSON.stringify(r.config) !==
          JSON.stringify(validationConfig(seed, arm === "rain-low" ? "rain-low" : "rain-high")) ||
        r.solverCommit !== runs[0]!.solverCommit ||
        JSON.stringify(r.sourceHashes) !== JSON.stringify(runs[0]!.sourceHashes) ||
        r.samples.length !== P.landscapeSteps / P.sampleIntervalSteps + 1
      )
        throw new Error("Incomplete or unhealthy rain run");
      for (const [i, s] of r.samples.entries()) {
        const c = s.closure;
        if (
          s.step !== i * P.sampleIntervalSteps ||
          !s.finiteNonnegativeStocks ||
          !Number.isFinite(s.budget.erodedM3) ||
          s.budget.erodedM3 < 0 ||
          (i === 0 && s.budget.erodedM3 !== 0) ||
          (i > 0 && s.budget.erodedM3 < r.samples[i - 1]!.budget.erodedM3) ||
          ![c.solidM3, c.waterM3, c.solidReferenceM3, c.waterReferenceM3].every(Number.isFinite) ||
          c.solidReferenceM3 < 0 ||
          c.waterReferenceM3 < 0 ||
          Math.abs(c.solidM3) > Math.max(1e-6, 0.01 * c.solidReferenceM3) ||
          Math.abs(c.waterM3) > Math.max(1e-6, 0.01 * c.waterReferenceM3)
        )
          throw new Error("Invalid rain sample or conservation failure");
      }
      return r;
    });
    const [low, high] = arms as [RainRun, RainRun];
    const { rainMmPerHr: lowRain, ...lowConfig } = low.config;
    const { rainMmPerHr: highRain, ...highConfig } = high.config;
    if (
      lowRain !== 5 ||
      highRain !== 20 ||
      JSON.stringify(lowConfig) !== JSON.stringify(highConfig) ||
      low.presetHash !== high.presetHash ||
      low.solverCommit !== high.solverCommit ||
      JSON.stringify(low.sourceHashes) !== JSON.stringify(high.sourceHashes) ||
      JSON.stringify(low.source) !== JSON.stringify(high.source) ||
      low.toolLog.length !== 0 ||
      high.toolLog.length !== 0
    )
      throw new Error("Rain must be the only paired intervention");
    const samples = low.samples.map((s, i) => ({
      step: s.step,
      values: [s.budget.erodedM3, high.samples[i]!.budget.erodedM3],
    }));
    for (const s of samples.slice(-3)) {
      const margin = 64 * Number.EPSILON * Math.max(1, ...s.values);
      if (s.values[1]! - s.values[0]! <= margin)
        throw new Error("Rain comparison does not support the teaching answer");
    }
    return { seed, inputs: [lowRain, highRain], samples };
  });
  return {
    id: "rain-gross-erosion-v1",
    evidencePath: "docs/science/validation/rain-comparison/README.md",
    answer: 1,
    expertApproved: false,
    playbackSeconds: 20,
    dtSimSeconds: P.dtSimSeconds,
    maxValue: Math.max(...pairs.flatMap((p) => p.samples.flatMap((s) => s.values))),
    pairs,
  };
}
