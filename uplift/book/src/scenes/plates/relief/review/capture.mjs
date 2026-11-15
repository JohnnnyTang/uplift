/**
 * Captures the 7C review build (the three boundaries on the real block) for the owner's 7R look review.
 * From the repository root:
 *
 *   node uplift/book/src/scenes/plates/relief/review/capture.mjs [--backend=webgl2] [--only=<name part>]
 *   node uplift/book/src/scenes/plates/relief/review/capture.mjs --gpu --only=zoom
 *
 * Starts a Vite dev server for the book, opens the review page in Chromium (Playwright) for each frame, and
 * writes PNGs and an index of what was captured to docs/review/plates/relief/. Deterministic input: the
 * relief is seeded and the page is driven only by query parameters; the renderer may differ by GPU.
 * By default Chromium renders on SwiftShader (software), so every machine gives the same pixels. `--gpu`
 * renders on the machine's own GPU instead (ANGLE/Direct3D 11 on Windows) and writes to the `gpu/`
 * subfolder, with the GPU's name in its captures.json (7R2 used it to check the mantle streaks).
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
const gpu = process.argv.includes("--gpu");
const shotDir = gpu ? `${outDir}gpu/` : outDir;
const launchArgs = gpu
  ? ["--ignore-gpu-blocklist", "--enable-gpu", ...(process.platform === "win32" ? ["--use-angle=d3d11"] : [])]
  : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];

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
    file: "front-face-convergent-stage-1.png",
    query: { boundary: "convergent", stage: "1", ghosts: "0", zoom: "1.5" },
    note: "Front face, convergent at stage 1, zoomed: the layered cover rock bends up under the range, over the crust band and its root.",
  },
  {
    file: "front-face-divergent-stage-1.png",
    query: { boundary: "divergent", stage: "1", ghosts: "0", zoom: "1.5" },
    note: "Front face, divergent at stage 1, zoomed: the cover steps down at each rift fault; the crust thins beneath.",
  },
  {
    file: "front-face-transform-stage-1.png",
    query: { boundary: "transform", stage: "1", ghosts: "0", zoom: "1.5" },
    note: "Front face, transform at stage 1, zoomed: cover, crust and mantle unchanged.",
  },
  {
    file: "transform-stage-1-top.png",
    query: { boundary: "transform", stage: "1", ghosts: "0", tilt: "20" },
    note: "Transform at stage 1 from a steep camera (from above).",
  },
  {
    file: "transform-stage-1-oblique.png",
    query: { boundary: "transform", stage: "1", ghosts: "0", orbit: "-30", zoom: "1.2" },
    note: "Transform at stage 1, camera turned to an oblique view along the ridges.",
  },
  {
    file: "transform-stage-1-top-bare.png",
    query: { boundary: "transform", stage: "1", ghosts: "0", tilt: "20", trees: "0" },
    note: "Transform at stage 1 from above, without trees (tree density is 7D's).",
  },
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
    file: "convergent-stage-1-flat.png",
    query: { boundary: "convergent", stage: "1", ghosts: "0", mode: "flat" },
    note: "Convergent at stage 1 on the flat (untilted) page.",
  },
];

const server = await createServer({
  root: bookRoot,
  logLevel: "error",
  server: { port: 5187, strictPort: false },
});
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: launchArgs });
mkdirSync(shotDir, { recursive: true });
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
    await page.screenshot({ path: `${shotDir}${shot.file}` });
    const meta = await page.evaluate(() => {
      const d = document.querySelector(".pr-desk");
      const probe = document.createElement("canvas").getContext("webgl2");
      const info = probe?.getExtension("WEBGL_debug_renderer_info");
      return {
        renderer: info ? probe.getParameter(info.UNMASKED_RENDERER_WEBGL) : undefined,
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
writeFileSync(`${shotDir}captures.json`, `${JSON.stringify(results, null, 2)}\n`);
