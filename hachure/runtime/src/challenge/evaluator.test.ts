import { describe, expect, it } from "vitest";
import { ChallengeEvaluator, type ChallengeObservation } from "./evaluator";
import type { ChallengeCheck } from "../schema/spread";
const threshold = (duration = 0): ChallengeCheck => ({
  kind: "probe-threshold",
  probe: "value",
  threshold: 2,
  comparator: ">=",
  sustainSimYears: duration,
});
const calibration = {
  status: "approved" as const,
  recordId: "test-fixture-only",
  approver: "fixture",
  approvedAt: "fixture",
};
const observation = (step: number, value: number | null = 3): ChallengeObservation => ({
  runId: "fixture",
  step,
  simYears: step,
  calibration,
  probes: { value },
});
describe("challenge evaluator engineering fixtures, not scientific evidence", () => {
  it("cannot pass a pending definition even when nested in an any check", () => {
    const check: ChallengeCheck = {
      kind: "any",
      checks: [threshold(), { kind: "pending", reason: "Scientific validation pending" }],
    };
    expect(new ChallengeEvaluator(check, 1).observe(observation(0))).toMatchObject({
      status: "pending",
      passed: false,
    });
  });
  it("evaluates all comparators and composites against live finite probes", () => {
    for (const [comparator, value, expected] of [
      [">", 2, false],
      [">=", 2, true],
      ["<", 2, false],
      ["<=", 2, true],
    ] as const) {
      const check = { ...threshold(), comparator } as ChallengeCheck;
      expect(new ChallengeEvaluator(check, 1).observe(observation(0, value)).passed).toBe(expected);
    }
    const all: ChallengeCheck = {
      kind: "all",
      checks: [threshold(), { ...threshold(), probe: "other" } as ChallengeCheck],
    };
    expect(new ChallengeEvaluator(all, 1).observe(observation(0))).toMatchObject({
      status: "unavailable",
      passed: false,
    });
    expect(new ChallengeEvaluator({ ...all, kind: "any" }, 1).observe(observation(0)).passed).toBe(true);
    for (const value of [NaN, Infinity, null])
      expect(new ChallengeEvaluator(threshold(), 1).observe(observation(0, value)).passed).toBe(false);
  });
  it("requires actual approved metadata for geological-time persistence", () => {
    const evaluator = new ChallengeEvaluator(threshold(2), 1);
    const { calibration: _approval, ...uncalibrated } = observation(0);
    expect(evaluator.observe(uncalibrated).status).toBe("unavailable");
    expect(
      evaluator.observe({ ...observation(2), calibration: { ...calibration, approver: "" } }).passed,
    ).toBe(false);
    expect(evaluator.observe(observation(3)).passed).toBe(false);
    expect(evaluator.observe(observation(4)).passed).toBe(false);
    expect(evaluator.observe(observation(5)).passed).toBe(true);
  });
  it("does not accrue time for duplicate views, gaps, false values or run resets", () => {
    const e = new ChallengeEvaluator(threshold(2), 1);
    expect(e.observe(observation(0)).passed).toBe(false);
    expect(e.observe(observation(0)).passed).toBe(false);
    expect(e.observe(observation(1)).passed).toBe(false);
    expect(e.observe(observation(3)).passed).toBe(false);
    expect(e.observe(observation(4, null)).passed).toBe(false);
    expect(e.observe(observation(5)).passed).toBe(false);
    expect(e.observe(observation(6)).passed).toBe(false);
    expect(e.observe(observation(7)).passed).toBe(true);
    expect(e.observe({ ...observation(8), runId: "new-run" }).passed).toBe(false);
    e.reset();
    expect(e.observe(observation(100)).passed).toBe(false);
  });
  it("rejects malformed definitions and inconsistent clocks", () => {
    expect(() => new ChallengeEvaluator({ kind: "all", checks: [] }, 1)).toThrow();
    expect(() => new ChallengeEvaluator(threshold(-1), 1)).toThrow();
    expect(() => new ChallengeEvaluator(threshold(), 0)).toThrow();
    const e = new ChallengeEvaluator(threshold(1), 1);
    e.observe(observation(0));
    expect(e.observe({ ...observation(0), simYears: 10 }).status).toBe("unavailable");
    expect(e.observe({ ...observation(1), step: NaN }).passed).toBe(false);
  });
});
