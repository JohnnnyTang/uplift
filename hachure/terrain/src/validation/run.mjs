/** Build once without the Vitest module runner, then run independent seeded experiments. */
import { build } from "vite";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import console from "node:console";

if (process.argv[2] === "--worker") {
  const { runValidation } = await import(
    pathToFileURL(resolve("node_modules/.cache/uplift-validation/run.js")).href
  );
  const followup = process.argv.includes("--followup");
  const revised = process.argv.includes("--revised");
  const out = resolve(
    "docs/science/validation",
    followup ? "followup/" + (revised ? "revised" : "baseline-replay") : ".",
  );
  mkdirSync(out, { recursive: true });
  const sha256 = (text) => createHash("sha256").update(text).digest("hex");
  const fingerprintFiles = [
    "cpu/kernel.ts",
    "cpu/solver.ts",
    "cpu/guards.ts",
    "cpu/constants.ts",
    "contract/config.ts",
    "presets/tilted-plateau.ts",
    "validation/protocol.ts",
    "validation/followup-protocol.ts",
    "validation/assessment.ts",
    "validation/run.mjs",
    "validation/metrics.ts",
    "validation/runner.ts",
  ];
  await runValidation(
    Number(process.argv[3]),
    {
      sha256,
      solverCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      sourceHashes: Object.fromEntries(
        fingerprintFiles.map((path) => [
          path,
          sha256(readFileSync(resolve("hachure/terrain/src", path), "utf8")),
        ]),
      ),
      writeFile: (name, content) => writeFileSync(resolve(out, name), content),
      log: (value) => console.log((revised ? "revised " : "baseline ") + value),
    },
    revised,
  );
  if (followup && !revised) {
    const child = spawn(
      process.execPath,
      [process.argv[1], "--worker", process.argv[3], "--followup", "--revised"],
      { stdio: "inherit" },
    );
    await new Promise((done, reject) => {
      child.on("error", reject);
      child.on("exit", (code) => (code === 0 ? done() : reject(new Error("Revised run failed: " + code))));
    });
  }
} else {
  await build({
    configFile: false,
    logLevel: "warn",
    build: {
      ssr: "hachure/terrain/src/validation/runner.ts",
      outDir: "node_modules/.cache/uplift-validation",
      minify: false,
      emptyOutDir: true,
      rollupOptions: { output: { entryFileNames: "run.js" } },
    },
  });
  const followup = process.argv.includes("--followup");
  const selected = process.argv
    .slice(2)
    .filter((arg) => arg !== "--followup")
    .map(Number);
  const seeds = selected.length ? selected : [1, 17, 101];
  await Promise.all(
    seeds.map(
      (seed) =>
        new Promise((done, reject) => {
          const child = spawn(
            process.execPath,
            [process.argv[1], "--worker", String(seed), ...(followup ? ["--followup"] : [])],
            {
              stdio: "inherit",
            },
          );
          child.on("error", reject);
          child.on("exit", (code) =>
            code === 0 ? done() : reject(new Error("Seed " + seed + " failed with " + code)),
          );
        }),
    ),
  );
}
