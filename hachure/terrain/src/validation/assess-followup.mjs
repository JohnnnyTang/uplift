/** Assess frozen cohorts. --require-pass checks legacy numeric criteria, not educational acceptance. */
import { build } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import console from "node:console";
await build({
  configFile: false,
  logLevel: "warn",
  build: {
    ssr: "hachure/terrain/src/validation/followup-assessment.ts",
    outDir: "node_modules/.cache/uplift-followup-assessment",
    minify: false,
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "assess.js" } },
  },
});
const { assessFollowup } = await import(
  pathToFileURL(resolve("node_modules/.cache/uplift-followup-assessment/assess.js")).href
);
const arms = ["rain-low", "rain-high", "uniform", "hard-band", "slope-low", "slope-high"];
const read = (dir) =>
  [1, 17, 101].flatMap((seed) =>
    arms.map((arm) =>
      JSON.parse(readFileSync(resolve("docs/science/validation", dir, `seed-${seed}-${arm}.json`), "utf8")),
    ),
  );
const result = assessFollowup(read("."), read("followup/baseline-replay"), read("followup/revised"));
writeFileSync(
  resolve("docs/science/validation/followup/summary.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      reproducibilityPassed: result.reproducibilityPassed,
      baselineLegacyCriteriaPassed: result.baseline.allQualitativeClaimsPassed,
      revisedLegacyCriteriaPassed: result.conditional.allQualitativeClaimsPassed,
      educationalAcceptance: result.educationalAcceptance,
      seeds: result.conditional.seeds.map((s) => ({
        seed: s.seed,
        ac3a: s.ac3a.status,
        ac3b: s.ac3b.status,
        ac3c: s.ac3c.status,
        prediction: s.prediction.status,
        calibration: s.calibration?.status,
      })),
    },
    null,
    2,
  ),
);
if (
  !result.reproducibilityPassed ||
  (process.argv.includes("--require-pass") &&
    (!result.baseline.allQualitativeClaimsPassed || !result.conditional.allQualitativeClaimsPassed))
)
  process.exitCode = 1;
