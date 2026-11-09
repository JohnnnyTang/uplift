import { describe, expect, it } from "vitest";
import { ModelStepSlopeBreakTracker } from "./model-steps";
import { detectKnickpoints, type ProfileResult } from "@hachure/terrain";
const options = {
  sustainModelSteps: 400,
  observationIntervalSteps: 200,
  metresPerCell: 10,
  maxDisplacementCells: 2,
};
const frame = (step: number, distances = [100]) => ({
  runId: "synthetic-engineering-fixture",
  step,
  completePath: true,
  resolved: true,
  candidates: distances.map((distanceM) => ({ distanceM })),
});
function profile(dropM: number): ProfileResult {
  const groundM = Float64Array.from({ length: 40 }, (_, i) => 100 - 0.01 * i * 10 - (i >= 20 ? dropM : 0));
  return {
    kind: "long-profile",
    distanceM: Float64Array.from(groundM, (_, i) => i * 10),
    groundM,
    bedrockM: groundM,
    waterM: new Float64Array(40),
  };
}
describe("model-step proxy synthetic engineering fixtures only", () => {
  it("shares the unchanged detector and distinguishes a step fixture from a uniform slope", () => {
    const detection = detectKnickpoints(profile(2), 10);
    expect(detection.candidates.length).toBeGreaterThan(0);
    const e = new ModelStepSlopeBreakTracker(options);
    for (const step of [0, 200])
      expect(e.observe({ ...frame(step), candidates: detection.candidates }).passed).toBe(false);
    expect(e.observe({ ...frame(400), candidates: detection.candidates }).passed).toBe(true);
    const uniform = detectKnickpoints(profile(0), 10);
    expect(uniform.candidates).toEqual([]);
    expect(e.observe({ ...frame(600), candidates: uniform.candidates }).passed).toBe(false);
  });
  it("resets on absent, missed, unresolved and incomplete observations and new runs", () => {
    for (const broken of [
      { ...frame(200), completePath: false },
      { ...frame(200), resolved: false },
      frame(200, []),
      frame(400),
      { ...frame(200), runId: "another" },
    ]) {
      const e = new ModelStepSlopeBreakTracker(options);
      e.observe(frame(0));
      e.observe(broken);
      expect(e.observe(frame(broken.step + 200)).passed).toBe(false);
    }
  });
  it("anchors displacement to the initial location and repeated frames never add time", () => {
    const e = new ModelStepSlopeBreakTracker(options);
    e.observe(frame(0));
    expect(e.observe(frame(0)).elapsedModelSteps).toBe(0);
    e.observe(frame(200, [120]));
    expect(e.observe(frame(400, [140])).passed).toBe(false);
    e.reset();
    expect(e.observe(frame(1000)).passed).toBe(false);
  });
});
