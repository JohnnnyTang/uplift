/* global document, navigator, window */
/**
 * Session 5N owner scene-review captures: the default book (no query string) on the live glacier runtime.
 * From the repository root:
 *
 *   pnpm build && pnpm --filter @uplift/book preview --host 127.0.0.1 --port 4180 --strictPort
 *   node docs/review/glacial/acceptance/capture.mjs            # in a second terminal
 *
 * Options: BOOK_BASE_URL (default http://127.0.0.1:4180); UPLIFT_E2E_CHANNEL (default "chrome": installed
 * Chrome, WebGPU on the hardware adapter; set it empty for Playwright's bundled Chromium, the labelled CPU path).
 * Writes PNGs and results.json into ./captures. Every number on the page comes from the live run.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { URL, fileURLToPath } from "node:url";
import process from "node:process";
import console from "node:console";
import { chromium } from "@playwright/test";

const base = process.env.BOOK_BASE_URL ?? "http://127.0.0.1:4180";
const channel = process.env.UPLIFT_E2E_CHANNEL ?? "chrome";
const dir = fileURLToPath(new URL("./captures/", import.meta.url));
await mkdir(dir, { recursive: true });
const out = (name) => `${dir}${name}`;
const browser = await chromium.launch({
  channel: channel || undefined,
  args: channel ? ["--enable-unsafe-webgpu"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = { base, channel: channel || "bundled chromium", browser: browser.version(), captures: [] };

async function open({ width = 1440, height = 900, reduce = false, query = "", scale = 1 } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  if (reduce) await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${base}/${query}`);
  await page.waitForSelector('.gs-desk[data-source="live"][data-transition="done"]', { timeout: 60_000 });
  await page.waitForTimeout(600);
  return page;
}
const desk = (page) => page.locator(".gs-desk");
const years = (page) => desk(page).getAttribute("data-model-years").then(Number);
async function playUntil(page, atLeast) {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const deadline = Date.now() + 300_000;
  while ((await years(page)) < atLeast && Date.now() < deadline) await page.waitForTimeout(250);
  const pause = page.getByRole("button", { name: "Pause", exact: true });
  if (await pause.isVisible()) await pause.click();
  await page.waitForSelector('.gs-desk[data-playing="false"]');
  await page.waitForTimeout(500);
}
async function cutTo(page, column) {
  await page.getByRole("slider", { name: "Front face" }).focus();
  for (let k = 0; k < 200; k++) {
    const now = Number(await desk(page).getAttribute("data-cut-column"));
    if (now === column) break;
    await page.keyboard.press(now > column ? "ArrowRight" : "ArrowLeft");
  }
  await page.waitForTimeout(300);
}
async function scrubTo(page, target) {
  await page.getByRole("slider", { name: "Recorded time" }).focus();
  await page.keyboard.press("Home");
  for (let t = 0; t < target; t += 20) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(400);
}
async function record(page, name, note, options = {}) {
  await page.screenshot({ path: out(name), ...options });
  const d = desk(page);
  const attr = (a) => d.getAttribute(a).catch(() => null);
  results.captures.push({
    file: `captures/${name}`,
    note,
    viewport: page.viewportSize(),
    stageMode: await attr("data-stage-mode"),
    renderer: await attr("data-backend"),
    liveRock: await attr("data-live-rock"),
    ghost: await attr("data-ghost"),
    modelYears: await attr("data-model-years"),
    view: await attr("data-view"),
    cutColumn: await attr("data-cut-column"),
    runId: await attr("data-run-id"),
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
/** The figure page alone, at twice the pixels, so the owner can read the scene and controls. */
async function figureCrop(page, name, note) {
  const box = await page.locator(".gs-page-figure").boundingBox();
  const blockTop = await page.evaluate(() =>
    Math.min(
      ...document
        .querySelector(".gs-desk")
        .blockScreenGeometry()
        .outline.map((p) => p.y),
    ),
  );
  const top = Math.max(0, Math.min(box.y, blockTop) - 16);
  await record(page, name, note, {
    clip: { x: box.x - 8, y: top, width: box.width + 16, height: box.y + box.height - top + 8 },
  });
}

// 1. Opening on the real device: transition mid-way, then at rest; backend and adapter recorded.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`${base}/`);
  await page.waitForSelector('.gs-desk[data-transition="running"]', { timeout: 60_000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: out("01-desktop-1440-transition.png") });
  results.captures.push({ file: "captures/01-desktop-1440-transition.png", note: "mid-transition" });
  await page.waitForSelector('.gs-desk[data-source="live"][data-transition="done"]', { timeout: 60_000 });
  await page.waitForTimeout(600);
  results.device = await page.evaluate(async () => {
    const adapter = await navigator.gpu?.requestAdapter({ powerPreference: "high-performance" });
    return {
      userAgent: navigator.userAgent,
      webgpu: Boolean(adapter),
      adapter: adapter
        ? {
            vendor: adapter.info.vendor,
            architecture: adapter.info.architecture,
            device: adapter.info.device,
            description: adapter.info.description,
          }
        : null,
      devicePixelRatio: window.devicePixelRatio,
    };
  });
  await record(
    page,
    "02-desktop-1440-open.png",
    "default route at rest: live run 1, sandstone, model time 0",
  );
  await figureCrop(page, "03-figure-open-2x.png", "figure page at model time 0 (crop)");

  // 2. Shale to the horizon, granite dropped as a second run, compared at matched model time.
  await page.getByRole("radio", { name: /Shale/ }).check();
  await playUntil(page, 300);
  await record(page, "04-desktop-1440-shale-300.png", "shale run complete at the horizon");
  await figureCrop(page, "05-figure-shale-300-2x.png", "shale at 300 model years, default cut (crop)");
  await page.getByRole("radio", { name: /Granite/ }).check();
  await playUntil(page, 300);
  await scrubTo(page, 300);
  await figureCrop(
    page,
    "06-figure-granite-vs-shale-300-2x.png",
    "granite at 300 model years with the kept shale run as ghost at the same time, default cut i = 51",
  );
  await cutTo(page, 74);
  await figureCrop(
    page,
    "07-figure-registered-section-300-2x.png",
    "same, front face moved to the registered section i = 74",
  );
  await scrubTo(page, 100);
  await figureCrop(page, "08-figure-matched-100-2x.png", "granite vs shale at 100 model years, i = 74");
  await page.getByRole("button", { name: "Back to the latest moment" }).click();
  await page.getByLabel("See under the ice").check();
  await page.waitForTimeout(400);
  await figureCrop(page, "09-figure-under-the-ice-2x.png", "see under the ice (X-ray view)");
  await page.getByLabel("See under the ice").uncheck();
  await cutTo(page, 14);
  await figureCrop(page, "10-figure-below-snout-2x.png", "front face below the snout (i = 14): the V stays");
  await cutTo(page, 51);
  // 3. Zoomed view (frozen R2 zoom 1–1.5) and the reading panel.
  const zoom = page.getByRole("slider", { name: "Zoom" });
  await zoom.focus();
  await page.keyboard.press("End");
  await page.waitForTimeout(500);
  await record(page, "11-desktop-1440-zoom-max.png", "view zoom at its maximum (1.5)");
  await page.getByRole("button", { name: "Reset view" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "University level" }).click();
  await page.waitForTimeout(300);
  await record(page, "12-desktop-1440-university.png", "university level: same runs");
  await page.getByRole("button", { name: "Read deeper level ↗" }).click();
  await page.waitForTimeout(600);
  results.solverLine = await page
    .locator(".gs-reading-panel")
    .innerText()
    .then((t) => t.split("\n").find((l) => l.includes("Solver")) ?? null);
  await record(page, "13-desktop-1440-deeper-panel.png", "deeper level: bound parameters, equations, graphs");
  await page.close();
}
// 4. Laptop, phone, narrow reflow, reduced motion, contrast. (Capture 20, the water lesson as spread 2, was
// taken by 5N and stays in captures/ as the record; the water lesson was removed by 5N2, D-W5-5N2.)
{
  const page = await open({ width: 1366, height: 768 });
  await record(page, "14-laptop-1366x768-open.png", "short laptop");
  await page.close();
}
{
  const page = await open({ width: 390, height: 844, scale: 2 });
  await page.getByRole("radio", { name: /Shale/ }).check();
  await playUntil(page, 200);
  await record(page, "15-phone-390.png", "phone: flat single page, shale at 200 model years");
  await page.screenshot({ path: out("16-phone-390-full.png"), fullPage: true });
  results.captures.push({ file: "captures/16-phone-390-full.png", note: "phone full page" });
  await page.close();
}
{
  const page = await open({ width: 320, height: 640 });
  results.reflow320 = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  await page.screenshot({ path: out("17-reflow-320-full.png"), fullPage: true });
  results.captures.push({ file: "captures/17-reflow-320-full.png", note: "320 CSS px (200 % zoom reflow)" });
  await page.close();
}
{
  const page = await open({ reduce: true, width: 1366, height: 900 });
  await record(page, "18-reduced-motion-1366.png", "reduced motion: flat page");
  await page.getByRole("button", { name: "More contrast" }).click();
  await page.waitForTimeout(200);
  await record(page, "19-reduced-motion-contrast.png", "more contrast (book setting)");
  await page.close();
}
await writeFile(
  fileURLToPath(new URL("./results.json", import.meta.url)),
  JSON.stringify(results, null, 2) + "\n",
);
await browser.close();
