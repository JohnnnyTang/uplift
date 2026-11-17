/**
 * Records the drawing → block entrance of one lesson: a webm of the whole entrance as a reader sees it, a
 * settled still, and (for builds with the `seekEntrance` automation hook) close-up stills frozen at exact
 * times after the entrance starts. Evidence for D-W6-6H; not part of the test suite.
 *
 *   node docs/review/book-revision/uplift-transition/capture.mjs <base-url> <lesson> <label> [ms:name,…]
 *
 * `lesson` is `glacial` or `plates`; `label` prefixes the output files (for example `before` or `after`).
 * Stills given as `ms:name` are frozen with the hook; without the hook they are taken on the wall clock.
 * Set `CAPTURE_CHANNEL=chrome` to use an installed browser with a real GPU instead of the bundled Chromium
 * with SwiftShader, and `CAPTURE_BACKEND=webgl2` to force the WebGL2 path (`?backend=webgl2`).
 */
/* global console, process, URL, URLSearchParams */
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const [base, lesson, label, times = ""] = process.argv.slice(2);
if (!base || !lesson || !label)
  throw new Error("usage: capture.mjs <base-url> <glacial|plates> <label> [ms:name,…]");
const out = dirname(fileURLToPath(import.meta.url));
const stills = times
  .split(",")
  .filter(Boolean)
  .map((entry) => {
    const [ms, name] = entry.split(":");
    return { ms: Number(ms), name: name ?? `${ms}ms` };
  });
const backend = process.env.CAPTURE_BACKEND;
const query = new URLSearchParams(
  lesson === "plates" ? { spread: "tectonics.plate-boundaries", page: "spread" } : {},
);
if (backend) query.set("backend", backend);
const deskSelector = lesson === "plates" ? ".ps-desk" : ".gs-desk";
const channel = process.env.CAPTURE_CHANNEL;
const size = { width: 1440, height: 900 };

const browser = await chromium.launch({
  ...(channel ? { channel } : {}),
  args: channel
    ? ["--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-webgpu"]
    : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const videoDir = join(out, `.video-${label}-${lesson}`);
mkdirSync(videoDir, { recursive: true });
const context = await browser.newContext({
  viewport: size,
  deviceScaleFactor: 2,
  recordVideo: { dir: videoDir, size },
});
const page = await context.newPage();
page.on("pageerror", (error) => console.error("pageerror:", String(error)));
await page.goto(new URL(`?${query}`, base).href);
const desk = page.locator(deskSelector);
await page.locator(`${deskSelector}[data-transition]`).waitFor({ timeout: 120_000 });
const started = Date.now();
console.log("backend:", await desk.getAttribute("data-backend"));
const hasHook = await desk.evaluate((d) => typeof d.seekEntrance === "function");

/** The figure frame with room above it for the standing block. */
const closeUp = async () => {
  const box = await desk.locator(".gs-frame").boundingBox();
  const pad = box.width * 0.45;
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - box.height * 0.9);
  return {
    x,
    y,
    width: Math.min(size.width - x, box.width + pad * 2),
    height: Math.min(size.height - y, box.height * 2.1),
  };
};

if (!hasHook)
  for (const { ms, name } of stills) {
    const wait = started + ms - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: join(out, `${label}-${lesson}-${name}.png`), clip: await closeUp() });
    console.log(`still ${name}: asked ${ms} ms, taken by ${Date.now() - started} ms`);
  }
await page.locator(`${deskSelector}[data-transition="done"]`).waitFor({ timeout: 120_000 });
console.log("entrance done after", Date.now() - started, "ms");
await page.waitForTimeout(1200);
await page.screenshot({ path: join(out, `${label}-${lesson}-settled.png`), clip: await closeUp() });
await page.screenshot({ path: join(out, `${label}-${lesson}-settled-page.png`), scale: "css" });
if (hasHook)
  for (const { ms, name } of stills) {
    await desk.evaluate((d, at) => d.seekEntrance(at), ms);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(out, `${label}-${lesson}-${name}.png`), clip: await closeUp() });
    console.log(`still ${name}: frozen at ${ms} ms, phase`, await desk.getAttribute("data-transition-phase"));
  }
const video = page.video();
await context.close();
renameSync(await video.path(), join(out, `${label}-${lesson}.webm`));
rmSync(videoDir, { recursive: true, force: true });
await browser.close();
