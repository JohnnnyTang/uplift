/**
 * Captures the 7C review build (the three boundaries on the real block) for the owner's 7R look review.
 * From the repository root:
 *
 *   node uplift/book/src/scenes/plates/relief/review/capture.mjs [--backend=webgl2]
 *
 * Starts a Vite dev server for the book, opens the review page in Chromium (Playwright) for each frame, and
 * writes PNGs and an index of what was captured to docs/review/plates/relief/. Deterministic input: the
 * relief is seeded and the page is driven only by query parameters; the renderer may differ by GPU.
 */
/* global document, requestAnimationFrame, setTimeout -- used only inside page.evaluate (browser) */
import { writeFileSync, mkdirSync } from "node:fs";
import { URL, URLSearchParams, fileURLToPath } from "node:url";
import console from "node:console";
import process from "node:process";
import { createServer } from "vite";
import { chromium } from "playwright";

const bookRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const outDir = fileURLToPath(new URL("../../../../../../../docs/review/plates/relief/", import.meta.url));
const backendArg = process.argv.find((a) => a.startsWith("--backend="))?.slice("--backend=".length);

const STAGES = [
  ["0", "0"],
  ["0.5", "05"],
  ["1", "1"],
];
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
const SHOTS = [
  { file: "start.png", query: {}, note: "The shared starting landscape (no boundary chosen)." },
  ...["convergent", "divergent", "transform"].flatMap((b) =>
    STAGES.map(([stage, tag]) => ({
      file: `${b}-stage-${tag}.png`,
      query: { boundary: b, stage, ghosts: "0" },
      note: `${b}, stage ${stage}`,
    })),
  ),
  {
    file: "ghosts-stage-1.png",
    query: { boundary: "convergent", stage: "1", viewed: "divergent,transform" },
    note: "Convergent at stage 1 with the divergent and transform profiles at the same stage (ghosts).",
  },
  {
    file: "ghosts-stage-05.png",
    query: { boundary: "divergent", stage: "0.5", viewed: "convergent,transform" },
    note: "Divergent at stage 0.5 with the convergent and transform profiles (ghosts).",
  },
  {
    file: "convergent-stage-1-cut-half.png",
    query: { boundary: "convergent", stage: "1", cut: "0.5", ghosts: "0" },
    note: "Convergent at stage 1, front face slid halfway along the boundary.",
  },
  {
    file: "transform-stage-1-top.png",
    query: { boundary: "transform", stage: "1", ghosts: "0", tilt: "20" },
    note: "Transform at stage 1 from a steeper camera (the offset reads best from above).",
  },
  {
    file: "transform-stage-1-top-bare.png",
    query: { boundary: "transform", stage: "1", ghosts: "0", tilt: "20", trees: "0" },
    note: "Transform at stage 1 from the steep camera, without trees (look question: tree density).",
  },
  {
    file: "divergent-stage-1-bare.png",
    query: { boundary: "divergent", stage: "1", ghosts: "0", trees: "0" },
    note: "Divergent at stage 1 without trees (look question: tree density).",
  },
  {
    file: "transform-stage-1-hachure.png",
    query: { boundary: "transform", stage: "1", ghosts: "0", trees: "0", hachure: "1" },
    note: "Transform at stage 1, no trees, full-strength slope hachures (look question: does ink make the offset read?).",
  },
  {
    file: "divergent-stage-1-hachure.png",
    query: { boundary: "divergent", stage: "1", ghosts: "0", trees: "0", hachure: "1" },
    note: "Divergent at stage 1, no trees, full-strength slope hachures.",
  },
  {
    file: "probe-ridge-1500-transform-stage-1.png",
    query: { boundary: "transform", stage: "1", ghosts: "0", trees: "0", ridge: "1500" },
    note: "LOOK PROBE, not the 7A table: starting ridges 1,500 m (row 10 is 500 m), transform at stage 1, no trees.",
  },
  {
    file: "layers-side-wall-convergent-stage-1.png",
    query: { boundary: "convergent", stage: "1", ghosts: "0", orbit: "-24", zoom: "1.3" },
    note: "Convergent at stage 1, camera turned to show the right-hand side wall: far from the boundary, the layer offset is near zero, so the layers there are flat; the front face is covered by the crust band.",
  },
  {
    file: "probe-no-crust-convergent-stage-1.png",
    query: { boundary: "convergent", stage: "1", ghosts: "0", crust: "0", zoom: "1.3" },
    note: "LOOK PROBE: crust band off, so the front face shows the rock layers bent up by the layer offset under the range.",
  },
  {
    file: "probe-no-crust-divergent-stage-1.png",
    query: { boundary: "divergent", stage: "1", ghosts: "0", crust: "0", zoom: "1.3", trees: "0" },
    note: "LOOK PROBE: crust band off, divergent at stage 1: the layers drop in steps at each rift fault.",
  },
  {
    file: "convergent-stage-1-zoom.png",
    query: { boundary: "convergent", stage: "1", ghosts: "0", zoom: "1.5" },
    note: "Convergent at stage 1, camera zoomed in on the front face.",
  },
  {
    file: "convergent-stage-1-flat.png",
    query: { boundary: "convergent", stage: "1", ghosts: "0", mode: "flat" },
    note: "Convergent at stage 1 on the flat (untilted) page, for a closer look at the front face.",
  },
];

const server = await createServer({
  root: bookRoot,
  logLevel: "error",
  server: { port: 5187, strictPort: false },
});
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
mkdirSync(outDir, { recursive: true });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  for (const shot of SHOTS.filter((s) => !ONLY || s.file.includes(ONLY))) {
    const q = new URLSearchParams({ ...(backendArg ? { backend: backendArg } : {}), ...shot.query });
    await page.goto(`${base}src/scenes/plates/relief/review/?${q}`);
    await page.waitForSelector('.pr-desk[data-ready="true"]', { timeout: 120_000 });
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 400)))),
    );
    await page.screenshot({ path: `${outDir}${shot.file}` });
    const meta = await page.evaluate(() => {
      const d = document.querySelector(".pr-desk");
      return {
        backend: d?.dataset.backend,
        mode: d?.dataset.mode,
        text: document.querySelector(".pr-now")?.textContent,
      };
    });
    results.push({ ...shot, ...meta });
    console.log(`${shot.file} (${meta.backend}, ${meta.mode})`);
  }
} finally {
  await browser.close();
  await server.close();
}
writeFileSync(`${outDir}captures.json`, `${JSON.stringify(results, null, 2)}\n`);
