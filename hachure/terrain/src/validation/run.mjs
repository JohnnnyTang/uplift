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
  const out = resolve("docs/science/validation");
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
    "validation/metrics.ts",
    "validation/runner.ts",
  ];
  await runValidation(Number(process.argv[3]), {
    sha256,
    solverCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    sourceHashes: Object.fromEntries(
      fingerprintFiles.map((path) => [
        path,
        sha256(readFileSync(resolve("hachure/terrain/src", path), "utf8")),
      ]),
    ),
    writeFile: (name, content) => writeFileSync(resolve(out, name), content),
    log: (value) => console.log(value),
  });
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
  const selected = process.argv.slice(2).map(Number);
  const seeds = selected.length ? selected : [1, 17, 101];
  await Promise.all(
    seeds.map(
      (seed) =>
        new Promise((done, reject) => {
          const child = spawn(process.execPath, [process.argv[1], "--worker", String(seed)], {
            stdio: "inherit",
          });
          child.on("error", reject);
          child.on("exit", (code) =>
            code === 0 ? done() : reject(new Error("Seed " + seed + " failed with " + code)),
          );
        }),
    ),
  );
}
