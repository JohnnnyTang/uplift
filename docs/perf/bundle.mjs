/**
 * Session 6A: production bundle report. Run after `pnpm build` from the repository root:
 *
 *   node docs/perf/bundle.mjs
 *
 * Writes docs/perf/results/bundle.json: every file in uplift/book/dist with its raw, gzip (level 9) and
 * Brotli (quality 11) size, the total against the repository budget (e2e/check-bundle.mjs) and the git SHA.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import console from "node:console";
import { BUNDLE_LIMIT_BYTES } from "../../e2e/check-bundle.mjs";

const dist = fileURLToPath(new URL("../../uplift/book/dist/", import.meta.url));
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const files = walk(dist)
  .map((path) => {
    const bytes = readFileSync(path);
    return {
      file: relative(dist, path).replace(/\\/g, "/"),
      raw: bytes.length,
      gzip: gzipSync(bytes, { level: 9 }).length,
      brotli: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
    };
  })
  .sort((a, b) => b.raw - a.raw);
const total = (k) => files.reduce((s, f) => s + f[k], 0);
const report = {
  sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  limitBytes: BUNDLE_LIMIT_BYTES,
  totalRaw: total("raw"),
  totalGzip: total("gzip"),
  totalBrotli: total("brotli"),
  withinBudget: total("raw") < BUNDLE_LIMIT_BYTES,
  files,
};
mkdirSync(fileURLToPath(new URL("./results/", import.meta.url)), { recursive: true });
writeFileSync(
  fileURLToPath(new URL("./results/bundle.json", import.meta.url)),
  JSON.stringify(report, null, 1) + "\n",
);
console.log(
  `bundle ${report.totalRaw} / ${BUNDLE_LIMIT_BYTES} bytes raw (${report.withinBudget ? "within" : "OVER"} budget); gzip ${report.totalGzip}; brotli ${report.totalBrotli}`,
);
