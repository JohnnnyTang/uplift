/* global document */
/**
 * Session 5M captures: the default book on the live glacier runtime. From the repository root:
 *
 *   pnpm build && pnpm --filter @uplift/book preview --host 127.0.0.1 --port 4180 --strictPort
 *   node docs/review/glacial/integration/capture.mjs            # in a second terminal
 *
 * Options: BOOK_BASE_URL (default http://127.0.0.1:4180), UPLIFT_E2E_CHANNEL=chrome (installed Chrome, for
 * WebGPU on a hardware adapter; default: Playwright's bundled Chromium, which runs the labelled CPU path).
 * Writes the PNGs and results.json next to this file. Every number on the page comes from the live run.
 */
import { writeFile } from "node:fs/promises";
import { URL, fileURLToPath } from "node:url";
import process from "node:process";
import console from "node:console";
import { chromium } from "@playwright/test";

const base = process.env.BOOK_BASE_URL ?? "http://127.0.0.1:4180";
const out = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));
const browser = await chromium.launch({
  channel: process.env.UPLIFT_E2E_CHANNEL || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = { base, browser: browser.version(), captures: [] };

async function open({ width = 1440, height = 900, reduce = false, query = "" } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  if (reduce) await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${base}/${query}`);
  await page.waitForSelector('.gs-desk[data-transition="done"]', { timeout: 60_000 });
  await page.waitForTimeout(600);
  return page;
}
const years = (page) => page.locator(".gs-desk").getAttribute("data-model-years").then(Number);
async function playUntil(page, atLeast) {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const deadline = Date.now() + 180_000;
  while ((await years(page)) < atLeast && Date.now() < deadline) await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForSelector('.gs-desk[data-playing="false"]');
  await page.waitForTimeout(400);
}
async function record(page, name, note) {
  await page.screenshot({ path: out(name) });
  const desk = page.locator(".gs-desk");
  results.captures.push({
    file: name,
    note,
    viewport: page.viewportSize(),
    stageMode: await desk.getAttribute("data-stage-mode").catch(() => null),
    renderer: await desk.getAttribute("data-backend").catch(() => null),
    liveRock: await desk.getAttribute("data-live-rock").catch(() => null),
    ghost: await desk.getAttribute("data-ghost").catch(() => null),
    modelYears: await desk.getAttribute("data-model-years").catch(() => null),
    view: await desk.getAttribute("data-view").catch(() => null),
    cutColumn: await desk.getAttribute("data-cut-column").catch(() => null),
    marginNotes: await page
      .locator(".gs-margin")
      .innerText()
      .catch(() => null),
    textAlternative: await page
      .locator(".gs-sr")
      .textContent()
      .catch(() => null),
  });
  console.log("wrote", name);
}

// 1. Opening: the drawing → ink → colour transition is captured mid-way and at rest.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/`);
  await page.waitForSelector('.gs-desk[data-transition="running"]', { timeout: 60_000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: out("desktop-1440-transition.png") });
  results.captures.push({ file: "desktop-1440-transition.png", note: "mid-transition (ink rising)" });
  await page.waitForSelector('.gs-desk[data-transition="done"]');
  await page.waitForTimeout(600);
  await record(page, "desktop-1440-open.png", "default route at rest: live run 1, sandstone, model time 0");
  await page.getByRole("button", { name: "Contents" }).click();
  await record(page, "desktop-1440-contents.png", "contents list over the bottom bar");
  await page.keyboard.press("Escape");
  // 2. Shale, played, then granite dropped as a specimen; compared at a matched recorded time.
  await page.getByRole("radio", { name: /Shale/ }).check();
  await playUntil(page, 120);
  await record(page, "desktop-1440-shale-played.png", "shale run after play, paused at the live head");
  await page.getByRole("radio", { name: /Granite/ }).check();
  await playUntil(page, 120);
  const time = page.getByRole("slider", { name: "Recorded time" });
  await time.focus();
  await page.keyboard.press("Home");
  for (let k = 0; k < 6; k++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(400);
  await record(
    page,
    "desktop-1440-compare-matched.png",
    "granite at a recorded time, shale ghost at the same time",
  );
  await page.getByRole("button", { name: "Back to the latest moment" }).click();
  await page.getByRole("button", { name: "University level" }).click();
  await page.waitForTimeout(300);
  await record(page, "desktop-1440-university.png", "university level: same runs, notes add b, step control");
  await page.getByRole("button", { name: "Read deeper level ↗" }).click();
  await page.waitForTimeout(500);
  await record(
    page,
    "desktop-1440-deeper-panel.png",
    "deeper level: bound parameters, equations, run graphs",
  );
  await page.close();
}
// 3. Laptop, phone, reduced motion, contrast, water spread.
{
  const page = await open({ width: 1366, height: 768 });
  await record(page, "laptop-1366x768-open.png", "short laptop");
  await page.close();
}
{
  const page = await open({ width: 390, height: 844 });
  await record(page, "phone-390-open.png", "phone: flat page with the bottom bar");
  await page.screenshot({ path: out("phone-390-full.png"), fullPage: true });
  await page.close();
}
{
  const page = await open({ reduce: true, width: 1366, height: 900 });
  await record(page, "reduced-motion-1366.png", "reduced motion: flat page, crossfade");
  await page.getByRole("button", { name: "More contrast" }).click();
  await page.waitForTimeout(200);
  await record(page, "reduced-motion-1366-contrast.png", "more contrast (book setting)");
  await page.close();
}
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/?spread=hydrology.water-path`);
  await page.waitForSelector(".reader-spread[data-spread='hydrology.water-path']");
  await page.waitForFunction(() => !document.querySelector(".reader-scene-status")?.textContent);
  await page.screenshot({ path: out("desktop-1440-water-spread-2.png") });
  results.captures.push({ file: "desktop-1440-water-spread-2.png", note: "the water lesson as spread 2" });
  await page.close();
}
await writeFile(out("results.json"), JSON.stringify(results, null, 2) + "\n");
await browser.close();
