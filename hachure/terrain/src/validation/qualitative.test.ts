import { describe, expect, it } from "vitest";
import { assessAll, assessSeed, type RunEvidence } from "./assessment";
import { VALIDATION_PROTOCOL as P, VALIDATION_ARMS } from "./protocol";

const files = import.meta.glob<RunEvidence>("../../../../docs/science/validation/seed-*-*.json", {
  eager: true,
  import: "default",
});
const runs = Object.values(files).filter((record) => "arm" in record);
const summaryFiles = import.meta.glob<{
  allQualitativeClaimsPassed: boolean;
  prediction: { answer: number | null };
}>("../../../../docs/science/validation/summary.json", { eager: true, import: "default" });

describe("preregistered qualitative evidence", () => {
  it("contains every seed and arm at the exact horizon with passing engineering guards", () => {
    expect(runs).toHaveLength(P.seeds.length * VALIDATION_ARMS.length);
    for (const seed of P.seeds)
      for (const arm of VALIDATION_ARMS) {
        const r = runs.find((r) => r.seed === seed && r.arm === arm)!;
        expect(r, seed + " " + arm).toBeDefined();
        expect(r.completedSteps).toBe(arm.startsWith("slope-") ? P.transportSteps : P.landscapeSteps);
        expect(r.halted).toBeNull();
        expect(r.allBudgetSamplesPassed).toBe(true);
        expect(r.samples.every((s) => s.finiteNonnegativeStocks)).toBe(true);
        expect(r.diagnostics.waveGuard).toBe("halt");
        expect(r.diagnostics.waveGuardViolationSteps).toBe(0);
        expect(r.samples.map((s) => s.step)).toEqual(
          Array.from(
            { length: r.horizonSteps / P.sampleIntervalSteps + 1 },
            (_, i) => i * P.sampleIntervalSteps,
          ),
        );
      }
  });
  it("recomputes the published outcomes without treating implementation tests as scientific passes", () => {
    const result = assessAll(runs);
    const published = Object.values(summaryFiles)[0]!;
    expect(published).toBeDefined();
    expect(result).toEqual(published);
    expect(result.landscapeTime.approved).toBe(false);
    expect(result.prediction.expertApproved).toBe(false);
    for (const s of result.seeds) expect(s.ac3b.approvedCalibration).toBe(false);
  });
  it("retains exact incision margins, comparable final samples and null for inconclusive outcomes", () => {
    const seedRuns = structuredClone(runs.filter((r) => r.seed === 1));
    const low = seedRuns.find((r) => r.arm === "rain-low")!;
    const high = seedRuns.find((r) => r.arm === "rain-high")!;
    // A synthetic fixture tests the acceptance boundary; it never changes evidence files.
    const patched = seedRuns.map((r) =>
      r === low
        ? { ...r, samples: r.samples.map((s) => ({ ...s, incisionM: 1 })) }
        : r === high
          ? { ...r, samples: r.samples.map((s) => ({ ...s, incisionM: 1.099 })) }
          : r,
    );
    const failed = assessSeed(patched);
    expect(failed.ac3a.passed).toBe(false);
    const passing = patched.map((r) =>
      r.arm === "rain-high" ? { ...r, samples: r.samples.map((s) => ({ ...s, incisionM: 1.101 })) } : r,
    );
    expect(assessSeed(passing).ac3a.passed).toBe(true);
    const mismatched = passing.map((r) =>
      r.arm === "rain-high" ? { ...r, samples: r.samples.map((s) => ({ ...s, step: s.step + 1 })) } : r,
    );
    expect(assessSeed(mismatched).ac3a.passed).toBe(false);
  });
  it("accepts resolved incision independently of unresolved prediction widths", () => {
    const patched = runs
      .filter((r) => r.seed === 1)
      .map((r) =>
        r.arm === "rain-low" || r.arm === "rain-high"
          ? {
              ...r,
              samples: r.samples.map((s) => ({
                ...s,
                incisionM: r.arm === "rain-low" ? 1 : 1.2,
                widths: s.widths.map((w) => ({ row: w.row, resolved: false as const })),
              })),
            }
          : r,
      );
    const result = assessSeed(patched);
    expect(result.ac3a.passed).toBe(true);
    expect(result.prediction.answer).toBeNull();
    expect(result.prediction.status).toBe("inconclusive");
  });
  it("requires delivered sediment and exact reach closure before accepting deposition", () => {
    const original = runs.filter((r) => r.seed === 1);
    const noDelivery = original.map((r) =>
      r.arm === "slope-low"
        ? {
            ...r,
            samples: r.samples.map((s) => ({
              ...s,
              reach: { ...s.reach, transfers: { incomingM3: 0, outgoingM3: 0 } },
            })),
          }
        : r,
    );
    expect(assessSeed(noDelivery).ac3c.passed).toBe(false);
    expect(assessSeed(noDelivery).ac3c.delivered).toBe(false);
  });
});
