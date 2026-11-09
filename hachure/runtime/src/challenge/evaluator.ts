import type { ChallengeCheck, Comparator } from "../schema/spread";
import type { LandscapeTimeApproval } from "../bindings/terrain-scene";
export interface ChallengeObservation {
  readonly runId: string;
  readonly step: number;
  readonly simYears: number;
  readonly calibration?: LandscapeTimeApproval;
  readonly probes: Readonly<Record<string, number | null | undefined>>;
}
export interface ChallengeEvaluation {
  readonly status: "pending" | "unavailable" | "waiting" | "in-progress" | "passed";
  readonly passed: boolean;
  readonly reason: string;
}
const result = (status: ChallengeEvaluation["status"], reason: string): ChallengeEvaluation => ({
  status,
  passed: status === "passed",
  reason,
});
const compare = (a: number, b: number, op: Comparator) =>
  op === ">" ? a > b : op === ">=" ? a >= b : op === "<" ? a < b : a <= b;
function validate(check: ChallengeCheck, depth = 0): void {
  if (depth > 8) throw new RangeError("Challenge nesting exceeds the schema limit");
  if (check.kind === "pending") {
    if (!check.reason.trim()) throw new Error("Pending checks need a reason");
    return;
  }
  if (check.kind === "all" || check.kind === "any") {
    if (!check.checks.length) throw new Error("Composite challenges need checks");
    check.checks.forEach((child) => validate(child, depth + 1));
    return;
  }
  if (
    check.kind !== "probe-threshold" ||
    !check.probe.trim() ||
    ![">", ">=", "<", "<="].includes(check.comparator) ||
    !Number.isFinite(check.threshold) ||
    !Number.isFinite(check.sustainSimYears) ||
    check.sustainSimYears < 0
  )
    throw new RangeError("Invalid challenge threshold");
}
function pendingReason(check: ChallengeCheck): string | undefined {
  if (check.kind === "pending") return check.reason;
  if (check.kind === "all" || check.kind === "any") return check.checks.map(pendingReason).find(Boolean);
}
function approved(calibration: LandscapeTimeApproval | undefined) {
  return (
    calibration?.status === "approved" &&
    !!calibration.recordId.trim() &&
    !!calibration.approver.trim() &&
    !!calibration.approvedAt.trim()
  );
}
/** Scheduled observations, never wall time. Reading-level updates at the same step accrue no time. */
export class ChallengeEvaluator {
  private readonly check: ChallengeCheck;
  private previous: ChallengeObservation | undefined;
  private readonly since = new Map<string, number>();
  constructor(
    check: ChallengeCheck,
    readonly observationIntervalSteps: number,
  ) {
    validate(check);
    if (!Number.isInteger(observationIntervalSteps) || observationIntervalSteps <= 0)
      throw new RangeError("Challenge needs a fixed observation cadence");
    this.check = structuredClone(check);
  }
  get pendingReason() {
    return pendingReason(this.check);
  }
  reset() {
    this.previous = undefined;
    this.since.clear();
  }
  observe(observation: ChallengeObservation): ChallengeEvaluation {
    const pending = pendingReason(this.check);
    if (pending) return result("pending", pending);
    if (
      !observation.runId.trim() ||
      !Number.isInteger(observation.step) ||
      observation.step < 0 ||
      !Number.isFinite(observation.simYears) ||
      observation.simYears < 0
    ) {
      this.reset();
      return result("unavailable", "The simulation observation is invalid.");
    }
    const last = this.previous;
    if (
      last &&
      (last.runId !== observation.runId ||
        (observation.step !== last.step && observation.step !== last.step + this.observationIntervalSteps) ||
        JSON.stringify(last.calibration) !== JSON.stringify(observation.calibration))
    )
      this.since.clear();
    if (
      last &&
      last.runId === observation.runId &&
      ((observation.step === last.step && observation.simYears !== last.simYears) ||
        (observation.step > last.step && observation.simYears < last.simYears))
    ) {
      this.reset();
      return result("unavailable", "The simulation clock is inconsistent.");
    }
    this.previous = observation;
    return this.evaluate(this.check, observation, "root");
  }
  private evaluate(check: ChallengeCheck, o: ChallengeObservation, path: string): ChallengeEvaluation {
    if (check.kind === "pending") return result("pending", check.reason);
    if (check.kind === "all" || check.kind === "any") {
      const values = check.checks.map((child, i) => this.evaluate(child, o, `${path}/${i}`));
      if (check.kind === "all" ? values.every((v) => v.passed) : values.some((v) => v.passed))
        return result("passed", "The simulation meets the registered challenge check.");
      if (values.some((v) => v.status === "unavailable"))
        return result("unavailable", "A required observation or approved landscape clock is unavailable.");
      return result(
        values.some((v) => v.status === "in-progress") ? "in-progress" : "waiting",
        "The simulation has not yet met the complete challenge check.",
      );
    }
    const value = o.probes[check.probe];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      this.since.delete(path);
      return result("unavailable", "A required probe is unavailable.");
    }
    if (!compare(value, check.threshold, check.comparator)) {
      this.since.delete(path);
      return result("waiting", "The simulation has not yet met the challenge check.");
    }
    if (check.sustainSimYears === 0)
      return result("passed", "The simulation meets the registered challenge check.");
    if (!approved(o.calibration)) {
      this.since.delete(path);
      return result("unavailable", "Landscape-time persistence requires an approved calibration.");
    }
    const start = this.since.get(path) ?? o.simYears;
    this.since.set(path, start);
    return o.simYears - start >= check.sustainSimYears
      ? result("passed", "The simulation meets the registered persistence check.")
      : result("in-progress", "The condition is present; registered persistence is still being observed.");
  }
}
