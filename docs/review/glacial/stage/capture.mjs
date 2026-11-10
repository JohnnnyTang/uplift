/* global document, console */
/**
 * Review captures for session 5H (book stage, look and transition). Run against a dev or preview server:
 *
 *   pnpm --filter @uplift/book exec vite --port 5190 --host 127.0.0.1
 *   STAGE_BASE_URL=http://127.0.0.1:5190 node docs/review/glacial/stage/capture.mjs
 *
 * Writes PNGs, a transition video and results.json next to this file. Uses installed Chrome (headless).
 * Every capture on the authored fixture says so on the page; these are not model runs.
 */
import { createRequire } from "node:module";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

const require = createRequire(new URL("../../../../uplift/book/package.json", import.meta.url));
const playwright = await import(pathToFileURL(require.resolve("playwright")).href);
const chromium = playwright.chromium ?? playwright.default.chromium;
const out = new URL("./", import.meta.url);
const base = (process.env.STAGE_BASE_URL ?? "http://127.0.0.1:5190") + "/?review=glacial-stage";
const results = { base, captures: [], errors: [], browser: "" };
const browser = await chromium.launch({ channel: "chrome", headless: true });
results.browser = browser.version();

async function open(query, viewport, options = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: options.scale ?? 1,
    ...options.context,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => results.errors.push(`${query}: ${e.message}`));
  await page.goto(base + query);
  await page.waitForSelector(".gs-desk[data-ready], .gs-tray[disabled]", { timeout: 30000 });
  return { context, page };
}
const state = (page) =>
  page.evaluate(() => {
    const desk = document.querySelector(".gs-desk");
    return {
      mode: desk?.dataset.stageMode,
      backend: desk?.dataset.backend ?? null,
      textAlternative: document.querySelector(".gs-sr")?.textContent,
    };
  });
async function shot(name, query, viewport, { wait = 3800, full = false, element, scale, before } = {}) {
  const { context, page } = await open(query, viewport, { scale });
  if (before) await before(page);
  await page.waitForTimeout(wait);
  const path = fileURLToPath(new URL(name, out));
  if (element) await page.locator(element).screenshot({ path });
  else await page.screenshot({ path, fullPage: full });
  results.captures.push({ name, query, viewport, ...(await state(page)) });
  await context.close();
}

await mkdir(out, { recursive: true });
const only = process.env.ONLY;
if (!only || only === "stills") {
  // Desktop, tilted book: the drawing, mid-transition (ink), and the finished scene.
  for (const [name, ms] of [
    ["desktop-1440-1-drawing.png", 0],
    ["desktop-1440-2-ink.png", 1250],
    ["desktop-1440-3-colour.png", 3600],
  ]) {
    await shot(
      name,
      "",
      { width: 1440, height: 900 },
      {
        wait: 0,
        before: async (page) => {
          await page.waitForTimeout(3600);
          await page.getByRole("button", { name: "Replay the drawing" }).click();
          await page.waitForTimeout(ms);
        },
      },
    );
  }
  await shot("desktop-1366.png", "", { width: 1366, height: 768 });
  await shot("desktop-1440-flat.png", "&mode=flat", { width: 1440, height: 900 });
  await shot("reduced-motion-1440.png", "&motion=reduce", { width: 1440, height: 900 }, { wait: 1200 });
  await shot("zoom-200-equivalent.png", "", { width: 720, height: 450 }, { full: true });
  await shot("phone-390.png", "", { width: 390, height: 844 }, { full: true });
  await shot("static-fallback-1440.png", "&static=1", { width: 1440, height: 900 }, { wait: 300 });
  // The front face: V below the snout (full block) against U under the ice (cut moved up the valley).
  await shot(
    "front-face-v-below-snout.png",
    "&mode=flat&cut=1",
    { width: 1440, height: 900 },
    { element: ".gs-frame", scale: 2 },
  );
  await shot(
    "front-face-u-under-ice.png",
    "&mode=flat&cut=0.4",
    { width: 1440, height: 900 },
    { element: ".gs-frame", scale: 2 },
  );
  await shot("tilted-u-under-ice.png", "&cut=0.4", { width: 1440, height: 900 });
  await shot(
    "under-the-ice.png",
    "&mode=flat&cut=0.4",
    { width: 1440, height: 900 },
    {
      element: ".gs-frame",
      scale: 2,
      before: async (page) => {
        await page.waitForTimeout(3800);
        await page.getByLabel("See under the ice").check();
      },
    },
  );
  for (const rock of ["Granite", "Limestone", "Shale"])
    await shot(
      `rock-${rock.toLowerCase()}.png`,
      "&mode=flat&cut=0.4",
      { width: 1440, height: 900 },
      {
        element: ".gs-frame",
        scale: 2,
        before: async (page) => {
          await page.waitForTimeout(3800);
          await page.getByLabel(rock).check();
        },
      },
    );
}

// Video: open → transition → cut moved from below the snout to under the ice → rock look preview.
if (!only || only === "video") {
  const dir = fileURLToPath(new URL("./video-tmp/", out));
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await page.goto(base);
  page.on("pageerror", (e) => results.errors.push(`video: ${e.message}`));
  await page.waitForSelector(".gs-desk[data-ready]", { timeout: 30000 });
  await page.waitForTimeout(4200);
  console.log("video state", await state(page));
  const slider = page.getByRole("slider", { name: "Front face" });
  await slider.focus();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(1200);
  await page.getByLabel("See under the ice").check();
  await page.waitForTimeout(1200);
  await page.getByLabel("See under the ice").uncheck();
  await page.getByLabel("Limestone").check();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Replay the drawing" }).click();
  await page.waitForTimeout(4000);
  const video = page.video();
  await context.close();
  await rename(await video.path(), fileURLToPath(new URL("transition-and-cut.webm", out)));
  await rm(dir, { recursive: true, force: true });
  results.captures.push({
    name: "transition-and-cut.webm",
    query: "",
    viewport: { width: 1440, height: 900 },
  });
}

await browser.close();
await writeFile(
  new URL(only ? `results-${only}.json` : "results.json", out),
  JSON.stringify(results, null, 2) + "\n",
);
console.log(`${results.captures.length} captures, ${results.errors.length} page errors`);
if (results.errors.length) process.exitCode = 1;
