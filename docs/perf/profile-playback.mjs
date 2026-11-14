/* global window, performance */
/**
 * Session 6A diagnostic: where the main thread spends its time while the glacier plays.
 *
 * Profile an unminified build so function names survive (diagnostic only; it is slower than production):
 *
 *   pnpm --filter @uplift/book exec vite build --minify false --outDir <dir>
 *   pnpm --filter @uplift/book exec vite preview --outDir <dir> --host 127.0.0.1 --port 4191 --strictPort
 *   BOOK_BASE_URL=http://127.0.0.1:4191 node docs/perf/profile-playback.mjs [--query=/] [--seconds=6]
 *
 * Takes a V8 CPU profile of the page's main thread during 1x playback after a cold start and prints the top
 * functions by self time, with each one's share of the profiled wall time. Writes results/profile-*.json.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import console from "node:console";
import { chromium } from "@playwright/test";

const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const BASE = process.env.BOOK_BASE_URL ?? "http://127.0.0.1:4191";
const QUERY = arg("query", "/");
const SECONDS = Number(arg("seconds", 6));
const INSTRUMENT = fileURLToPath(new URL("./instrument.js", import.meta.url));

const dir = mkdtempSync(join(tmpdir(), "uplift-6a-prof-"));
const context = await chromium.launchPersistentContext(dir, {
  channel: "chrome",
  headless: false,
  viewport: null,
  args: ["--start-maximized"],
});
await context.addInitScript({ path: INSTRUMENT });
const page = context.pages()[0] ?? (await context.newPage());
const cdp = await context.newCDPSession(page);
await page.goto(BASE + QUERY);
await page.waitForSelector('.gs-desk[data-source="live"][data-transition="done"]', { timeout: 120_000 });
await page.waitForTimeout(1500);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await page.getByRole("button", { name: "Play", exact: true }).click();
await page.waitForSelector('.gs-desk[data-playing="true"]');
await cdp.send("Profiler.start");
const t0 = await page.evaluate(() => performance.now());
await page.waitForTimeout(SECONDS * 1000);
const { profile } = await cdp.send("Profiler.stop");
const t1 = await page.evaluate(() => performance.now());
const frames = await page.evaluate(([a, b]) => window.__perf.window(a, b), [t0, t1]);
await context.close();
rmSync(dir, { recursive: true, force: true });

// Self time per node from the sample timeline.
const self = new Map();
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
for (let i = 0; i < profile.samples.length; i++) {
  const dt = profile.timeDeltas[i + 1] ?? 0;
  self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + dt);
}
const fns = new Map();
for (const [id, us] of self) {
  const f = byId.get(id).callFrame;
  const key = `${f.functionName || "(anonymous)"} ${f.url.replace(/^.*\/assets\//, "")}:${f.lineNumber + 1}`;
  fns.set(key, (fns.get(key) ?? 0) + us);
}
const wallUs = profile.endTime - profile.startTime;
const top = [...fns.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .map(([fn, us]) => ({ fn, ms: Math.round(us / 1000), pctOfWall: Math.round((us / wallUs) * 1000) / 10 }));
const report = {
  session: "6A",
  sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  base: BASE,
  query: QUERY,
  build: "unminified diagnostic build (vite build --minify false)",
  seconds: SECONDS,
  frames,
  top,
};
const name = QUERY.includes("glacier=cpu") ? "profile-playback-cpu.json" : "profile-playback-webgpu.json";
writeFileSync(
  fileURLToPath(new URL(`./results/${name}`, import.meta.url)),
  JSON.stringify(report, null, 1) + "\n",
);
console.log(`fps ${frames.fps}, longest ${frames.frameMs.max} ms`);
for (const t of top)
  console.log(`${String(t.pctOfWall).padStart(5)} %  ${String(t.ms).padStart(5)} ms  ${t.fn}`);
