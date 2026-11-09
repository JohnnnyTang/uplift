import { describe, expect, it } from "vitest";
import { assessFollowup, type FollowupRun } from "./followup-assessment";
import type { RunEvidence } from "./assessment";

const originals = Object.values(
  import.meta.glob<RunEvidence>("../../../../docs/science/validation/seed-*-*.json", {
    eager: true,
    import: "default",
  }),
).filter((r) => "arm" in r);
const replay = Object.values(
  import.meta.glob<FollowupRun>(
    "../../../../docs/science/validation/followup/baseline-replay/seed-*-*.json",
    { eager: true, import: "default" },
  ),
).filter((r) => "arm" in r);
const revised = Object.values(
  import.meta.glob<FollowupRun>("../../../../docs/science/validation/followup/revised/seed-*-*.json", {
    eager: true,
    import: "default",
  }),
).filter((r) => "arm" in r);
const summaries = Object.values(
  import.meta.glob<ReturnType<typeof assessFollowup>>(
    "../../../../docs/science/validation/followup/summary.json",
    { eager: true, import: "default" },
  ),
);

describe("mechanism-isolation evidence integrity (not scientific acceptance)", () => {
  it("recomputes every assessment and preserves all original replay measurements", () => {
    const result = assessFollowup(originals, replay, revised);
    expect(result).toEqual(summaries[0]);
    expect(result.reproducibilityPassed).toBe(true);
    expect(result.historicalPredicatesChanged).toBe(false);
    expect(result.conditional.landscapeTime.approved).toBe(false);
    expect(result.conditional.prediction.expertApproved).toBe(false);
    for (const r of revised) {
      const base = replay.find((b) => b.seed === r.seed && b.arm === r.arm)!;
      expect(r.configHash).toBe(base.configHash);
      expect(r.horizonSteps).toBe(base.horizonSteps);
      expect(r.samples.map((s) => s.step)).toEqual(base.samples.map((s) => s.step));
    }
  });
  it("rejects incomplete, duplicated and mixed-protocol cohorts", () => {
    expect(() => assessFollowup(originals, replay, revised.slice(1))).toThrow("Incomplete cohort");
    expect(() => assessFollowup(originals, replay, [revised[0]!, ...revised.slice(0, -1)])).toThrow(
      "Duplicate or missing",
    );
    expect(() => assessFollowup(originals, replay, replay)).toThrow("Wrong protocol");
  });
  it("flags altered replay evidence rather than silently accepting it", () => {
    const modified = replay.map((r, i) => (i === 0 ? { ...r, finalHash: "altered" } : r));
    expect(assessFollowup(originals, modified, revised).reproducibilityPassed).toBe(false);
  });
});
