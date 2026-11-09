import { build } from "vite";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import console from "node:console";
const root = "docs/science/validation/challenge/";
if (process.argv[2] === "--worker") {
  const { runChallengeSeed } = await import(
    pathToFileURL(resolve("node_modules/.cache/challenge-experiment/run.js")).href
  );
  const registrationCommit = execFileSync(
    "git",
    ["log", "-1", "--format=%H", "--", root + "preregistration.md"],
    { encoding: "utf8" },
  ).trim();
  const files = [
    root + "preregistration.md",
    root + "protocol.ts",
    root + "runner.ts",
    root + "run.mjs",
    "hachure/runtime/src/challenge/model-steps.ts",
    ...[
      "cpu/kernel.ts",
      "cpu/solver.ts",
      "cpu/guards.ts",
      "cpu/constants.ts",
      "contract/config.ts",
      "probes/knickpoint.ts",
      "probes/channel.ts",
      "probes/profile.ts",
      "presets/tilted-plateau.ts",
    ].map((p) => "hachure/terrain/src/" + p),
  ];
  const sha256 = (text) => createHash("sha256").update(text).digest("hex");
  mkdirSync(root + "results", { recursive: true });
  await runChallengeSeed(Number(process.argv[3]), {
    registrationCommit,
    sourceHashes: Object.fromEntries(files.map((p) => [p, sha256(readFileSync(p, "utf8"))])),
    sha256,
    write: (name, value) => writeFileSync(root + "results/" + name, JSON.stringify(value, null, 2) + "\n"),
    log: (value) => console.log(JSON.stringify(value)),
  });
} else {
  await build({
    configFile: false,
    logLevel: "warn",
    build: {
      ssr: root + "runner.ts",
      outDir: "node_modules/.cache/challenge-experiment",
      emptyOutDir: true,
      rollupOptions: { output: { entryFileNames: "run.js" } },
    },
  });
  await Promise.all(
    [1, 17, 101].map(
      (seed) =>
        new Promise((done, reject) => {
          const child = spawn(process.execPath, [process.argv[1], "--worker", String(seed)], {
            stdio: "inherit",
          });
          child.on("error", reject);
          child.on("exit", (code) =>
            code === 0 ? done() : reject(new Error(`Seed ${seed} failed: ${code}`)),
          );
        }),
    ),
  );
}
