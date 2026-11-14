#!/usr/bin/env node
/**
 * Session 5N: runs the registered "From V to U" protocol (docs/science/glacial/acceptance-protocol.md, the
 * 5G2 re-registration) on the production glacier code and keeps every arm, including failures.
 *
 *   node docs/science/validation/glacial-valley/run.mjs cpu        # all 18 arms on the CPU reference (parallel)
 *   node docs/science/validation/glacial-valley/run.mjs evaluate   # verdicts, record comparison, environment
 *   node docs/science/validation/glacial-valley/run.mjs gpu        # registered CPU/GPU comparison (WebGPU)
 *   node docs/science/validation/glacial-valley/run.mjs all
 *
 * Nothing here defines the protocol. The arms, horizon, sections and criteria come from
 * hachure/glacier/src/testing/protocol.ts and evaluate.ts (frozen at the 5G2 registration); the arm runner is
 * the 5G review runner, unchanged; the GPU run is 5I's registered suite with its evidence directory redirected
 * here. Optional: GLACIER_JOBS (parallel CPU processes, default 6).
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../../..");
const CPU_OUT = join(HERE, "cpu", "runs");
const GPU_OUT = join(HERE, "gpu");

/** Same ids as PROTOCOL_ARMS (protocol.ts); evaluate checks that none is missing. */
const ARMS = [
  "shale-s1",
  "shale-s2",
  "shale-s3",
  "sandstone-s1",
  "sandstone-s2",
  "sandstone-s3",
  "granite-s1",
  "granite-s2",
  "granite-s3",
  "control-no-ice",
  "control-no-erosion",
  "attempt-a0-plain-sia",
  "attempt-a0-plain-sia-shale",
  "attempt-a2a-surface-balance",
  "attempt-a2a-surface-balance-shale",
  "attempt-5g-open-head-shale",
  "attempt-5g-open-head-granite",
  "check-half-step",
];

function run(cmd, args, env) {
  return new Promise((ok, fail) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("exit", (code) =>
      code === 0 ? ok() : fail(new Error(`${cmd} ${args.join(" ")} exited ${code}`)),
    );
  });
}

async function cpu() {
  mkdirSync(CPU_OUT, { recursive: true });
  const jobs = Math.max(1, Number(process.env.GLACIER_JOBS ?? 6));
  // Longest arms first (half step, then the 128 × 96 open-head arms), round-robin over the jobs.
  const order = ["check-half-step", ...ARMS.filter((a) => a !== "check-half-step")];
  const groups = Array.from({ length: jobs }, () => []);
  order.forEach((arm, k) => groups[k % jobs].push(arm));
  await Promise.all(
    groups
      .filter((g) => g.length)
      .map((g) =>
        run("pnpm", ["exec", "vitest", "run", "hachure/glacier/src/testing/review/run-arm.review.test.ts"], {
          GLACIER_REVIEW: "1",
          GLACIER_ARMS: g.join(","),
          GLACIER_OUT: CPU_OUT,
        }),
      ),
  );
}

async function evaluate() {
  await run(
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "--config",
      relative(ROOT, join(HERE, "vitest.config.mjs")).replaceAll("\\", "/"),
    ],
    { GLACIAL_VALLEY_EVALUATE: "1" },
  );
}

async function gpu() {
  mkdirSync(join(GPU_OUT, "runs"), { recursive: true });
  await run("pnpm", ["--filter", "@hachure/glacier", "test:gpu"], {
    GLACIER_GPU_FULL: "1",
    // Relative to the Vitest root (hachure/glacier).
    GLACIER_GPU_OUT: relative(join(ROOT, "hachure", "glacier"), GPU_OUT).replaceAll("\\", "/"),
  });
}

const phase = process.argv[2] ?? "all";
const phases = { cpu, evaluate, gpu, all: async () => (await cpu(), await gpu(), await evaluate()) };
if (!phases[phase]) {
  process.stderr.write(`unknown phase ${phase}; use cpu | evaluate | gpu | all\n`);
  process.exit(2);
}
await phases[phase]();
