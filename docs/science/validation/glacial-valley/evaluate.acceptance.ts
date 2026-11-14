/**
 * Session 5N: evaluates the registered "From V to U" protocol on the arms this session ran on production code.
 * Gated (GLACIAL_VALLEY_EVALUATE=1); run through `node docs/science/validation/glacial-valley/run.mjs evaluate`.
 *
 * Reads cpu/runs/<arm>.json (and gpu/runs/<arm>.json when the GPU phase ran), evaluates them with the
 * registered evaluator (hachure/glacier/src/testing/evaluate.ts, unchanged), compares every arm's final state
 * hash and every verdict with the 5G2 registered record (docs/review/glacial/model), and writes results.json
 * with the commit, backend and device. Every arm and verdict is kept, pass or fail. This test fails only when
 * the evidence is incomplete (a missing arm) — a failed scientific verdict is a result, not a test failure.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { expect, it } from "vitest";
import {
  type ArmResult,
  type Verdict,
  evaluateProtocol,
} from "../../../../hachure/glacier/src/testing/evaluate";
import {
  PROTOCOL_ARMS,
  PROTOCOL_HORIZON_YEARS,
  PROTOCOL_MATCHED_YEARS,
  PROTOCOL_SECTIONS,
} from "../../../../hachure/glacier/src/testing/protocol";

const HERE = resolve("docs/science/validation/glacial-valley");
const RECORD = resolve("docs/review/glacial/model");
const read = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const sh = (cmd: string) => {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};

function loadArms(dir: string): Record<string, ArmResult & { backend?: string; adapter?: unknown }> {
  const arms: Record<string, ArmResult> = {};
  for (const arm of PROTOCOL_ARMS) {
    const path = join(dir, `${arm.id}.json`);
    if (existsSync(path)) arms[arm.id] = read<ArmResult>(path);
  }
  return arms;
}

function compareVerdicts(a: readonly Verdict[], b: readonly Verdict[]) {
  return a.map((v) => {
    const other = b.find((x) => x.id === v.id);
    return { id: v.id, pass: v.pass, other: other?.pass ?? null, same: other?.pass === v.pass };
  });
}

it.runIf(process.env.GLACIAL_VALLEY_EVALUATE === "1")("registered protocol on production code", () => {
  // ---- CPU: every registered arm ----
  const cpu = loadArms(join(HERE, "cpu", "runs"));
  const missing = PROTOCOL_ARMS.filter((a) => !cpu[a.id]).map((a) => a.id);
  const cpuEval = evaluateProtocol(cpu);

  // ---- Against the 5G2 registered record ----
  const recordSummary = read<{ verdicts: Verdict[] }>(join(RECORD, "summary.json"));
  const hashes = PROTOCOL_ARMS.map((arm) => {
    const recPath = join(RECORD, "runs", `${arm.id}.json`);
    const rec = existsSync(recPath) ? read<ArmResult>(recPath) : null;
    const now = cpu[arm.id];
    return {
      arm: arm.id,
      kind: arm.kind,
      finalHash: now?.finalHash ?? null,
      recordHash: rec?.finalHash ?? null,
      reproducesRecord: !!now && !!rec && now.finalHash === rec.finalHash,
      msPerModelYear: now?.msPerModelYear ?? null,
    };
  });
  const verdictsVsRecord = compareVerdicts(cpuEval.verdicts, recordSummary.verdicts);

  // ---- GPU (when the 5I registered suite ran into gpu/) ----
  const gpuDir = join(HERE, "gpu");
  const gpuArms = loadArms(join(gpuDir, "runs"));
  const gpuResultsPath = join(gpuDir, "results-local.json");
  let gpu: unknown = { ran: false, reason: "gpu phase not run on this machine" };
  if (Object.keys(gpuArms).length && existsSync(gpuResultsPath)) {
    const results = read<Record<string, unknown>>(gpuResultsPath);
    const gpuEval = evaluateProtocol(gpuArms);
    // Verdicts that only exist when every arm is present (attempts are not GPU product runs, so absent).
    const parity = compareVerdicts(
      gpuEval.verdicts,
      cpuEval.verdicts.filter((v) => gpuEval.verdicts.some((g) => g.id === v.id)),
    );
    gpu = {
      ran: true,
      arms: Object.keys(gpuArms),
      adapter: results.adapter ?? null,
      userAgent: results.userAgent ?? null,
      utc: results.utc ?? null,
      gates: results.gates ?? null,
      allGatesPass: results.allGatesPass ?? null,
      recommendedDefault: results.recommendedDefault ?? null,
      problems: results.problems ?? null,
      speed: results.speed
        ? {
            gpuMedianMsPerModelYear: (results.speed as Record<string, number>).gpuMedianMsPerModelYear,
            cpuBrowserMedianMsPerModelYear: (results.speed as Record<string, number>)
              .cpuBrowserMedianMsPerModelYear,
            speedup: (results.speed as Record<string, number>).speedup,
          }
        : null,
      verdictParityWithThisCpuRun: {
        identical: parity.filter((p) => p.same).length,
        compared: parity.length,
        differing: parity.filter((p) => !p.same),
      },
      verdicts: gpuEval.verdicts,
    };
  }

  // ---- Environment ----
  const sha = sh("git rev-parse HEAD");
  const environment = {
    utc: new Date().toISOString(),
    commit: sha,
    glacierSourceCleanAtCommit: sh("git status --porcelain -- hachure/glacier/src") === "",
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`,
    cpu: `${os.cpus()[0]?.model ?? "unknown"} × ${os.cpus().length} logical`,
    memoryGiB: Math.round(os.totalmem() / 2 ** 30),
    cpuBackend:
      "CPU reference (@hachure/glacier createCpuGlacier, Node, one core per arm, parallel processes)",
  };

  const tally = (vs: readonly Verdict[]) => ({
    pass: vs.filter((v) => v.pass).length,
    fail: vs.filter((v) => !v.pass).length,
  });
  const results = {
    protocol: "docs/science/glacial/acceptance-protocol.md (5G registration, 5G2 re-registration)",
    definitions: "hachure/glacier/src/testing/protocol.ts, evaluate.ts",
    horizonYears: PROTOCOL_HORIZON_YEARS,
    matchedYears: PROTOCOL_MATCHED_YEARS,
    sections: PROTOCOL_SECTIONS,
    environment,
    missingArms: missing,
    cpu: {
      tally: tally(cpuEval.verdicts),
      verdicts: cpuEval.verdicts,
      matchedEroded: cpuEval.matchedEroded,
      table: cpuEval.table,
      attempts: cpuEval.attempts,
    },
    record: {
      armsReproducingRecordHash: hashes.filter((h) => h.reproducesRecord).length,
      arms: hashes,
      verdictsIdenticalToRecord: verdictsVsRecord.filter((v) => v.same).length,
      verdictsCompared: verdictsVsRecord.length,
      verdictsDiffering: verdictsVsRecord.filter((v) => !v.same),
    },
    gpu,
  };
  writeFileSync(join(HERE, "results.json"), JSON.stringify(results, null, 2) + "\n");
  for (const v of cpuEval.verdicts)
    process.stderr.write(`${v.pass ? "PASS" : "FAIL"} ${v.id}: ${v.detail}\n`);
  expect(missing).toEqual([]);
});
