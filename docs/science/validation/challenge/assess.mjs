import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import console from "node:console";
const root = "docs/science/validation/challenge/";
const records = [];
for (const seed of [1, 17, 101])
  for (const arm of ["uniform", "hard-band"]) {
    const path = root + `results/seed-${seed}-${arm}.json`,
      text = readFileSync(path, "utf8"),
      r = JSON.parse(text);
    assert.equal(r.protocolId, "s1-w4-model-step-slope-break-v1");
    assert.equal(r.seed, seed);
    assert.equal(r.arm, arm);
    assert.equal(r.completedSteps, 22000);
    assert.equal(r.samples.length, 111);
    assert.deepEqual(
      r.samples.map((s) => s.step),
      Array.from({ length: 111 }, (_, i) => i * 200),
    );
    for (const [source, hash] of Object.entries(r.sourceHashes))
      assert.equal(
        createHash("sha256").update(readFileSync(source, "utf8")).digest("hex"),
        hash,
        `Source changed since execution: ${source}`,
      );
    const last = r.samples.at(-1);
    records.push({
      seed,
      arm,
      registrationCommit: r.registrationCommit,
      sha256: createHash("sha256").update(text).digest("hex"),
      path,
      configHash: r.configHash,
      initialHash: r.initialHash,
      finalHash: r.finalHash,
      completedSteps: r.completedSteps,
      endpointPassed: r.endpointPassed,
      everPassed: r.everPassed,
      maxCandidates: Math.max(...r.samples.map((s) => s.candidates.length)),
      allNumericallyValid: r.allNumericallyValid,
      erodedM3: last.budget.erodedM3,
      exportedSedimentM3: last.budget.exportedSedimentM3,
      peakWaveCourant: r.diagnostics.peakWaveCourant,
      maxSolidResidualM3: Math.max(...r.samples.map((s) => Math.abs(s.residual.solidM3))),
      maxWaterResidualM3: Math.max(...r.samples.map((s) => Math.abs(s.residual.waterM3))),
      toolGroundChangeM: r.toolGroundChangeM,
    });
  }
for (const seed of [1, 17, 101]) {
  const [uniform, band] = records.filter((r) => r.seed === seed);
  assert.equal(uniform.initialHash, band.initialHash, "Paired initial states must agree");
}
const numericalGatePassed = records.every(
  (r) => r.allNumericallyValid && (r.arm === "hard-band" ? r.endpointPassed : !r.everPassed),
);
const summary = {
  protocolId: "s1-w4-model-step-slope-break-v1",
  numericalGatePassed,
  teachingReleasePassed: false,
  realBookChallenge: "pending",
  reason: numericalGatePassed
    ? "Numerical candidate requires renderer legibility and expert/human review before release."
    : "No qualifying slope-break candidate in any of the six arms. Numerical health is not a morphology pass.",
  records,
};
writeFileSync(root + "summary.json", JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
if (!numericalGatePassed) process.exitCode = 1;
