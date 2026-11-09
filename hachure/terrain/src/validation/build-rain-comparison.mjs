import { build } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
await build({
  configFile: false,
  logLevel: "warn",
  build: {
    ssr: "hachure/terrain/src/validation/rain-comparison.ts",
    outDir: "node_modules/.cache/rain-comparison",
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "run.js" } },
  },
});
const { extractRainComparison } = await import(
  pathToFileURL(resolve("node_modules/.cache/rain-comparison/run.js")).href
);
const sources = [1, 17, 101].flatMap((seed) =>
  ["rain-low", "rain-high"].map((arm) => {
    const path = `docs/science/validation/followup/revised/seed-${seed}-${arm}.json`;
    const text = readFileSync(path, "utf8");
    const run = JSON.parse(text);
    return { path, sha256: createHash("sha256").update(text).digest("hex"), run };
  }),
);
const data = extractRainComparison(sources.map((s) => s.run));
writeFileSync(
  "hachure/terrain/src/validation/rain-comparison-data.json",
  JSON.stringify(data, null, 2) + "\n",
);
writeFileSync(
  "docs/science/validation/rain-comparison/manifest.json",
  JSON.stringify(
    {
      presentationProtocolCommit: execFileSync(
        "git",
        ["log", "-1", "--format=%H", "--", "docs/science/validation/rain-comparison/protocol.md"],
        { encoding: "utf8" },
      ).trim(),
      sources: sources.map(({ run, ...source }) => ({
        ...source,
        solverCommit: run.solverCommit,
        config: run.config,
        initialHash: run.presetHash,
        finalHash: run.finalHash,
      })),
    },
    null,
    2,
  ) + "\n",
);
