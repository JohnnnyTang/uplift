/* global window, performance, setTimeout */
/**
 * Session 6A diagnostic: does the measurement harness itself cause long frames during WebGPU playback?
 *
 *   node docs/perf/playback-ab.mjs [--reps=3] [--query=/]
 *
 * Plays the glacier at 1x for 8 s after a cold start, alternating two conditions per repetition:
 *   --mode=harness (default)
 *     quiet:    nothing but the page-side instrument (instrument.js);
 *     watchdog: plus measure.mjs's window watchdog (Browser.getWindowForTarget + getWindowBounds every 500 ms)
 *               and its per-window DevTools reads (Performance.getMetrics, SystemInfo.getProcessInfo).
 *   --mode=runs
 *     quiet:    play the first run straight away;
 *     after-runs: first choose a rock 7 times before the run advances (each choice replaces the unadvanced
 *               run with a new one), as measure.mjs's journey does, then play.
 *   --mode=manip
 *     quiet:    play the first run straight away;
 *     after-manip: first move the front face 5 cells (keyboard), orbit the camera by dragging the desk for
 *               about 1 s, and press Reset view, as measure.mjs's journey does, then play.
 * Before playing, the window is brought to the front and maximised (a minimised window is throttled).
 * Prints frames over 50 / 100 ms and the longest frame for each, and writes results/playback-ab.json.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import console from "node:console";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const BASE = process.env.BOOK_BASE_URL ?? "http://127.0.0.1:4190";
const REPS = Number(arg("reps", 3));
const QUERY = arg("query", "/");
const MODE = arg("mode", "harness");
const INSTRUMENT = fileURLToPath(new URL("./instrument.js", import.meta.url));
const results = {
  session: "6A",
  sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  query: QUERY,
  startedAt: new Date().toISOString(),
  runs: [],
};

async function once(condition) {
  const dir = mkdtempSync(join(tmpdir(), "uplift-6a-ab-"));
  const context = await chromium.launchPersistentContext(dir, {
    channel: "chrome",
    headless: false,
    viewport: null,
    args: ["--start-maximized"],
  });
  await context.addInitScript({ path: INSTRUMENT });
  const page = context.pages()[0] ?? (await context.newPage());
  const cdp = await context.newCDPSession(page);
  const bcdp = await context.browser().newBrowserCDPSession();
  await page.goto(BASE + QUERY);
  await page.waitForSelector('.gs-desk[data-source="live"][data-transition="done"]', { timeout: 120_000 });
  await page.waitForTimeout(1500);
  if (condition === "after-runs")
    for (const rock of ["shale", "granite", "sandstone", "shale", "granite", "sandstone", "shale"]) {
      await page
        .locator(".gs-tray")
        .getByRole("radio", { name: new RegExp(rock, "i") })
        .click();
      await page.waitForSelector(`.gs-desk[data-live-rock="${rock}"]`);
      await page.waitForTimeout(400);
    }
  if (condition === "after-manip") {
    await page.getByRole("slider", { name: "Front face" }).focus();
    for (let k = 0; k < 5; k++) {
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(150);
    }
    const box = await page.locator(".gs-desk").boundingBox();
    const start = { x: box.x + 60, y: box.y + box.height * 0.5 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let i = 1; i <= 60; i++) {
      await page.mouse.move(start.x + Math.sin(i / 10) * 120, start.y - Math.min(i, 30) * 2);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.getByRole("button", { name: "Reset view" }).click();
    await page.waitForTimeout(400);
  }
  await page.bringToFront();
  try {
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
    await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "maximized" } });
  } catch {
    /* headless */
  }
  await page.waitForTimeout(500);
  let polling = condition === "watchdog";
  const poller = (async () => {
    if (polling) await cdp.send("Performance.enable");
    while (polling) {
      try {
        const { windowId } = await cdp.send("Browser.getWindowForTarget");
        await cdp.send("Browser.getWindowBounds", { windowId });
      } catch {
        /* closing */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  })();
  if (condition === "watchdog") {
    await cdp.send("Performance.getMetrics");
    await bcdp.send("SystemInfo.getProcessInfo");
  }
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForSelector('.gs-desk[data-playing="true"]');
  const t0 = await page.evaluate(() => performance.now());
  await page.waitForTimeout(8000);
  const t1 = await page.evaluate(() => performance.now());
  if (condition === "watchdog") {
    await cdp.send("Performance.getMetrics");
    await bcdp.send("SystemInfo.getProcessInfo");
  }
  polling = false;
  await poller;
  const w = await page.evaluate(([a, b]) => window.__perf.window(a, b), [t0, t1]);
  await context.close();
  rmSync(dir, { recursive: true, force: true });
  return {
    condition,
    fps: w.fps,
    over50: w.over50,
    over100: w.over100,
    maxMs: w.frameMs.max,
    loafTop: w.loafTop,
  };
}

for (let rep = 1; rep <= REPS; rep++)
  for (const condition of {
    runs: ["quiet", "after-runs"],
    manip: ["quiet", "after-manip"],
    harness: ["quiet", "watchdog"],
  }[MODE][rep % 2 ? "slice" : "reverse"]()) {
    const r = await once(condition);
    results.runs.push({ rep, ...r });
    console.log(rep, condition, `fps ${r.fps} >50ms ${r.over50} >100ms ${r.over100} max ${r.maxMs}`);
  }
writeFileSync(
  fileURLToPath(new URL(`./results/playback-ab-${MODE}${QUERY === "/" ? "" : "-cpu"}.json`, import.meta.url)),
  JSON.stringify(results, null, 1) + "\n",
);
