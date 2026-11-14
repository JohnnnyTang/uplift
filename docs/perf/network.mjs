/* global window, performance */
/**
 * Session 6A: network startup of the default route under emulated network conditions, in visible installed
 * Chrome. Each load is a fresh browser process with an empty profile (cold HTTP cache).
 *
 *   node docs/perf/network.mjs --reps=3        # with the preview server from measure.mjs running
 *
 * The preview server (vite preview) serves gzip; the profiles below throttle that transfer with the DevTools
 * protocol (Network.emulateNetworkConditions). They are emulations, labelled as such, not field measurements.
 * Writes docs/perf/results/network.json.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import console from "node:console";
import { chromium } from "@playwright/test";

const BASE = process.env.BOOK_BASE_URL ?? "http://127.0.0.1:4190";
const REPS = Number((process.argv.find((a) => a.startsWith("--reps=")) ?? "--reps=3").slice(7));
const INSTRUMENT = fileURLToPath(new URL("./instrument.js", import.meta.url));
const kbps = (megabits) => (megabits * 1_000_000) / 8;
const PROFILES = [
  { name: "local (no throttling)", conditions: null },
  {
    name: "emulated 10 Mbit/s, 40 ms RTT",
    conditions: { latency: 40, downloadThroughput: kbps(10), uploadThroughput: kbps(5) },
  },
  {
    name: "emulated 1.6 Mbit/s, 150 ms RTT (DevTools 'Slow 4G'-like)",
    conditions: { latency: 150, downloadThroughput: kbps(1.6), uploadThroughput: kbps(0.75) },
  },
];

const results = {
  session: "6A",
  sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  base: BASE,
  startedAt: new Date().toISOString(),
  loads: [],
};
for (const profile of PROFILES)
  for (let rep = 1; rep <= REPS; rep++) {
    const dir = mkdtempSync(join(tmpdir(), "uplift-6a-net-"));
    const context = await chromium.launchPersistentContext(dir, {
      channel: "chrome",
      headless: false,
      viewport: null,
      args: ["--start-maximized"],
    });
    results.chrome ??= context.browser()?.version();
    await context.addInitScript({ path: INSTRUMENT });
    const page = context.pages()[0] ?? (await context.newPage());
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    if (profile.conditions)
      await cdp.send("Network.emulateNetworkConditions", { offline: false, ...profile.conditions });
    await page.goto(BASE + "/");
    await page.waitForSelector('.gs-desk[data-source="live"][data-transition="done"]', { timeout: 300_000 });
    await page.waitForTimeout(1000);
    const load = await page.evaluate(() => {
      const p = window.__perf;
      const nav = performance.getEntriesByType("navigation")[0];
      const res = performance.getEntriesByType("resource");
      const first = (attr, value) => p.marks.find((m) => m.attr === attr && m.value === value);
      const r = Math.round;
      return {
        fcpMs: r(p.paints["first-contentful-paint"]),
        drawingVisibleMs: r(p.drawingAt?.painted ?? NaN),
        stageReadyMs: r(first("data-ready", "true")?.painted ?? NaN),
        interactiveMs: r(
          Math.max(
            first("data-transition", "done")?.painted ?? 0,
            first("data-source", "live")?.painted ?? 0,
          ),
        ),
        requests: res.length + 1,
        transferKB: r((res.reduce((s, e) => s + e.transferSize, 0) + nav.transferSize) / 1024),
        lastResponseEndMs: r(Math.max(nav.responseEnd, ...res.map((e) => e.responseEnd))),
        resources: res.map((e) => ({
          name: e.name.replace(/^.*\/assets\//, ""),
          endMs: r(e.responseEnd),
          transferB: e.transferSize,
        })),
      };
    });
    results.loads.push({ profile: profile.name, rep, ...load });
    console.log(profile.name, rep, load.drawingVisibleMs, load.interactiveMs, `${load.transferKB} KB`);
    await context.close();
    rmSync(dir, { recursive: true, force: true });
  }
writeFileSync(
  fileURLToPath(new URL("./results/network.json", import.meta.url)),
  JSON.stringify(results, null, 1) + "\n",
);
