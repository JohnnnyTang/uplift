/* global window, performance */
/**
 * Session 6A diagnostic: a Chrome trace of the cold start and of glacier playback, to explain long frames that
 * the Long Animation Frame API reports without any script or rendering work.
 *
 *   node docs/perf/trace-playback.mjs [--query=/?glacier=cpu] [--out=FILE]
 *
 * Writes the trace (Chrome trace-event JSON, openable in DevTools' Performance panel) and prints, for each frame
 * gap over 100 ms in the page's rAF loop, the longest trace events overlapping it on the renderer main thread,
 * the compositor and the GPU process.
 */
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import console from "node:console";
import { chromium } from "@playwright/test";

const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const BASE = process.env.BOOK_BASE_URL ?? "http://127.0.0.1:4190";
const QUERY = arg("query", "/");
const OUT = arg("out", join(tmpdir(), `uplift-6a-trace-${Date.now()}.json`));
const INSTRUMENT = fileURLToPath(new URL("./instrument.js", import.meta.url));

const dir = mkdtempSync(join(tmpdir(), "uplift-6a-trace-"));
const context = await chromium.launchPersistentContext(dir, {
  channel: "chrome",
  headless: false,
  viewport: null,
  args: ["--start-maximized"],
});
const browser = context.browser();
await context.addInitScript({ path: INSTRUMENT });
const page = context.pages()[0] ?? (await context.newPage());
await browser.startTracing(page, {
  path: OUT,
  screenshots: false,
  categories: [
    "devtools.timeline",
    "blink.user_timing",
    "disabled-by-default-devtools.timeline",
    "disabled-by-default-devtools.timeline.frame",
    "toplevel",
    "gpu",
    "viz",
    "cc",
    "benchmark",
    "v8",
    "disabled-by-default-v8.gc",
  ],
});
await page.goto(BASE + QUERY);
await page.waitForSelector('.gs-desk[data-source="live"][data-transition="done"]', { timeout: 120_000 });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "Play", exact: true }).click();
await page.waitForTimeout(6000);
await page.getByRole("button", { name: "Pause", exact: true }).click();
await page.waitForTimeout(500);
const gaps = await page.evaluate(() => {
  const sync = performance.mark("uplift-6a-sync").startTime;
  const f = window.__perf.frames;
  const out = [];
  for (let i = 1; i < f.length; i++) if (f[i] - f[i - 1] > 100) out.push([f[i - 1], f[i]]);
  return {
    sync,
    gaps: out,
    marks: window.__perf.marks.filter((m) => m.attr === "data-transition" || m.attr === "data-playing"),
  };
});
await browser.stopTracing();
await context.close();
rmSync(dir, { recursive: true, force: true });

// ---- Analysis: map the page clock onto trace time through the navigation start. ----
const trace = JSON.parse(readFileSync(OUT, "utf8"));
const events = trace.traceEvents ?? trace;
const names = new Map();
for (const e of events)
  if (e.ph === "M" && e.name === "thread_name") names.set(`${e.pid}:${e.tid}`, e.args.name);
  else if (e.ph === "M" && e.name === "process_name") names.set(`${e.pid}`, e.args.name);
// Align the page clock with trace time through a User Timing mark made at a known page time.
const mark = events.find((e) => e.name === "uplift-6a-sync");
if (!mark) throw new Error("no sync mark in trace");
const toTrace = (pageMs) => mark.ts + (pageMs - gaps.sync) * 1000;
const summary = [];
for (const [a, b] of gaps.gaps) {
  const [t0, t1] = [toTrace(a), toTrace(b)];
  const overlap = events
    .filter((e) => e.ph === "X" && e.dur > 20_000 && e.ts < t1 && e.ts + e.dur > t0)
    .map((e) => ({
      thread: `${names.get(`${e.pid}`) ?? e.pid}/${names.get(`${e.pid}:${e.tid}`) ?? e.tid}`,
      name: e.name,
      ms: Math.round(e.dur / 100) / 10,
      startOffsetMs: Math.round((e.ts - t0) / 100) / 10,
    }))
    .sort((x, y) => y.ms - x.ms)
    .slice(0, 12);
  summary.push({ gapAtMs: Math.round(a), gapMs: Math.round(b - a), overlap });
}
const report = { query: QUERY, trace: OUT, marks: gaps.marks, gaps: summary };
writeFileSync(OUT.replace(/\.json$/, "-gaps.json"), JSON.stringify(report, null, 1) + "\n");
console.log(JSON.stringify(report, null, 1));
