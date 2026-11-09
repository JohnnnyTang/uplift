/* global document, URL, console */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
const here = fileURLToPath(new URL(".", import.meta.url));
const evidence = fileURLToPath(new URL("../../docs/review/book-revision/feasibility/", import.meta.url));
await mkdir(evidence, { recursive: true });
const server = await createServer({ configFile: here + "vite.config.ts" });
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = {
  status: "exploratory; not science acceptance or learner evidence",
  browser: browser.version(),
  runs: [],
  errors: [],
};
async function open(viewport, reducedMotion = "no-preference", video = false) {
  const ctx = await browser.newContext({
    viewport,
    reducedMotion,
    ...(video ? { recordVideo: { dir: evidence + "video/", size: viewport } } : {}),
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => results.errors.push(e.message));
  await page.goto("http://127.0.0.1:5188");
  await page.waitForFunction(() => globalThis.__trial?.ready || globalThis.__trial?.error);
  const error = await page.evaluate(() => globalThis.__trial.error);
  if (error) throw new Error(error);
  return { page, ctx };
}
try {
  const { page, ctx } = await open({ width: 1366, height: 768 }, "no-preference", true);
  await page.screenshot({ path: evidence + "contour-flat-1366.png" });
  const before = await page.evaluate(() => globalThis.__trial.stats());
  const ring = await page.locator("#handle").boundingBox();
  await page.mouse.move(ring.x + ring.width / 2, ring.y + ring.height / 2);
  await page.mouse.down();
  await page.mouse.move(ring.x + ring.width / 2, ring.y + ring.height / 2 - 160, { steps: 40 });
  await page.mouse.up();
  await page.waitForTimeout(350);
  await page.screenshot({ path: evidence + "contour-lifted-1366.png" });
  results.runs.push({
    name: "pointer-lift",
    before,
    after: await page.evaluate(() => globalThis.__trial.stats()),
  });
  await page.click("#water");
  await page.screenshot({ path: evidence + "water-dry-1366.png" });
  const times = [];
  for (let i = 0; i < 8; i++) {
    const start = Date.now();
    await page.click("#advance");
    await page.waitForFunction(() => !document.getElementById("advance").disabled);
    times.push(Date.now() - start);
    if (i === 1) await page.screenshot({ path: evidence + "water-500-1366.png" });
  }
  results.runs.push({
    name: "left-source-2000",
    batchesWallMs: times,
    state: await page.evaluate(() => globalThis.__trial.stats()),
  });
  await page.screenshot({ path: evidence + "water-left-2000-1366.png" });
  // Actual terrain picking; select a world point through the same projection.
  const point = await page.evaluate(() => globalThis.__trial.point(47, 9));
  const bounds = await page.locator("#terrain").boundingBox();
  await page.mouse.click(bounds.x + point[0], bounds.y + point[1]);
  for (let i = 0; i < 8; i++) {
    await page.click("#advance");
    await page.waitForFunction(() => !document.getElementById("advance").disabled);
  }
  results.runs.push({
    name: "source-moved-right-4000",
    state: await page.evaluate(() => globalThis.__trial.stats()),
  });
  await page.screenshot({ path: evidence + "water-moved-4000-1366.png" });
  const video = page.video();
  await ctx.close();
  await video.saveAs(evidence + "interaction-1366.webm");
  await video.delete();
  const reduced = await open({ width: 1366, height: 768 }, "reduce");
  await reduced.page.locator("#lift").focus();
  await reduced.page.keyboard.press("End");
  results.runs.push({
    name: "reduced-motion-keyboard-lift",
    state: await reduced.page.evaluate(() => globalThis.__trial.stats()),
  });
  await reduced.page.screenshot({ path: evidence + "keyboard-reduced-motion-1366.png" });
  await reduced.page.click("#water");
  await reduced.page.locator("#source").focus();
  await reduced.page.keyboard.press("ArrowRight");
  await reduced.page.keyboard.press("ArrowDown");
  await reduced.page.locator("#advance").focus();
  await reduced.page.keyboard.press("Enter");
  await reduced.page.waitForFunction(() => !document.getElementById("advance").disabled);
  results.runs.push({
    name: "reduced-motion-keyboard-source",
    state: await reduced.page.evaluate(() => globalThis.__trial.stats()),
  });
  await reduced.page.screenshot({ path: evidence + "water-keyboard-reduced-motion-1366.png" });
  await reduced.ctx.close();
  const large = await open({ width: 1440, height: 900 });
  await large.page.locator("#lift").fill("1");
  await large.page.locator("#lift").dispatchEvent("input");
  await large.page.screenshot({ path: evidence + "contour-lifted-1440.png" });
  await large.ctx.close();
} finally {
  await browser.close();
  await server.close();
}
await writeFile(evidence + "results.json", JSON.stringify(results, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      errors: results.errors,
      runs: results.runs.map((r) => ({
        name: r.name,
        step: r.state?.step,
        water: r.state?.water,
        diagnostics: r.state?.diagnostics,
      })),
    },
    null,
    2,
  ),
);
