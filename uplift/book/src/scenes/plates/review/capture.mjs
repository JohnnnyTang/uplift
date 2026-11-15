/**
 * Captures lesson 2's production scene (session 7D) for review: docs/review/plates/scene/. From the
 * repository root:
 *
 *   node uplift/book/src/scenes/plates/review/capture.mjs [--only=<name>] [--gpu]
 *
 * Starts the e2e fixture server (the scene in the reader shell, as 7F mounts it), drives the page through
 * its own controls, and writes PNGs plus captures.json. `--gpu` uses the machine's GPU instead of
 * SwiftShader. The scene is deterministic; the renderer may differ by GPU.
 */
/* global document -- used only inside page.evaluate (browser) */
import { mkdirSync, writeFileSync } from "node:fs";
import { URL, fileURLToPath } from "node:url";
import console from "node:console";
import process from "node:process";
import { createServer } from "vite";
import { chromium } from "playwright";

const repo = fileURLToPath(new URL("../../../../../../", import.meta.url));
const outDir = fileURLToPath(new URL("../../../../../../docs/review/plates/scene/", import.meta.url));
const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
const gpu = process.argv.includes("--gpu");

const stage = (v) => ({
  eval: `const i=document.querySelector('#ps-stage');i.value='${v}';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))`,
});
const choose = (b) => ({ click: `.ps-choice[data-boundary=${b}]` });
const viewHeight = (max) => ({
  eval: `const h=document.querySelectorAll('.gs-view-controls input')[0];h.value=${max ? "h.max" : "h.min"};h.dispatchEvent(new Event('input',{bubbles:true}))`,
});
const BLOCK = { x: 690, y: 190, width: 330, height: 320 };

/** name, note, query, actions, viewport/clip options. */
const SHOTS = [
  {
    name: "drawing-static",
    note: "Fig. 2 as the static fallback, with the enlarged front face.",
    query: "static=1",
    full: true,
  },
  {
    name: "transition-ink",
    note: "Mid-transition: the block rising in ink over the fading drawing.",
    transition: 1700,
  },
  { name: "start", note: "The starting landscape on the tilted book, no boundary chosen (neutral arrows)." },
  {
    name: "convergent-stage-05",
    note: "Convergent, middle stage.",
    actions: [choose("convergent"), stage(0.5)],
  },
  {
    name: "convergent-stage-1",
    note: "Convergent, late stage: range, snow, layers bent up, root.",
    actions: [choose("convergent"), stage(1)],
  },
  {
    name: "convergent-stage-1-block",
    note: "Convergent, late stage, the block at 2×.",
    actions: [choose("convergent"), stage(1)],
    clip: BLOCK,
    dpr: 2,
  },
  {
    name: "divergent-stage-1",
    note: "Divergent, late stage: rift, inked scarps with ticks, lakes.",
    actions: [choose("divergent"), stage(1)],
  },
  {
    name: "divergent-stage-1-block",
    note: "Divergent, late stage, the block at 2×.",
    actions: [choose("divergent"), stage(1)],
    clip: BLOCK,
    dpr: 2,
  },
  {
    name: "transform-stage-1",
    note: "Transform, late stage, default camera.",
    actions: [choose("transform"), stage(1)],
  },
  {
    name: "transform-stage-1-block",
    note: "Transform, late stage, default camera, the block at 2×: ridges and streams offset at the fault.",
    actions: [choose("transform"), stage(1)],
    clip: BLOCK,
    dpr: 2,
  },
  {
    name: "transform-stage-1-above",
    note: "Transform, late stage, from above (view height at its top).",
    actions: [choose("transform"), stage(1), viewHeight(true)],
    dpr: 2,
  },
  {
    name: "ghosts-stage-075",
    note: "Divergent at stage ¾ with convergent (dotted) and transform (dash-dot) ghosts, labelled on the block and in the key.",
    actions: [
      choose("convergent"),
      stage(0.75),
      choose("transform"),
      stage(0.75),
      choose("divergent"),
      stage(0.75),
    ],
  },
  {
    name: "phone-convergent",
    note: "Phone (390 × 844): one readable page.",
    actions: [choose("convergent"), stage(1)],
    viewport: { width: 390, height: 844 },
    dpr: 2,
    scroll: ".gs-page-figure .gs-frame",
  },
  {
    name: "reduced-motion",
    note: "Reduced motion: the flat page; the stage steps in quarters.",
    query: "motion=reduce",
    reduce: true,
    actions: [choose("divergent"), stage(0.75)],
  },
  {
    name: "university",
    note: "University level: words change, the scene does not.",
    query: "level=uni",
    actions: [choose("transform"), stage(1)],
  },
];

const server = await createServer({
  configFile: `${repo}e2e/fixture.config.ts`,
  root: repo,
  server: { port: 4195, strictPort: false },
});
await server.listen();
const origin = server.resolvedUrls.local[0].replace(/\/$/, "");
const args = gpu
  ? ["--enable-gpu", "--ignore-gpu-blocklist"]
  : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const browser = await chromium.launch({ args, headless: !gpu });
mkdirSync(outDir, { recursive: true });
const index = [];
try {
  for (const s of SHOTS) {
    if (only && s.name !== only) continue;
    const page = await browser.newPage({
      viewport: s.viewport ?? { width: 1366, height: 900 },
      deviceScaleFactor: s.dpr ?? 1,
    });
    if (s.reduce) await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${origin}/e2e/fixtures/plates-scene.html?start=plates${s.query ? `&${s.query}` : ""}`);
    await page.waitForSelector(".ps-desk[data-ready='true']", { timeout: 90000 });
    if (s.transition) await page.waitForTimeout(s.transition);
    else if (!s.query?.includes("static=1"))
      await page.waitForFunction(
        () => document.querySelector(".ps-desk")?.dataset.transition === "done",
        null,
        { timeout: 90000 },
      );
    for (const a of s.actions ?? []) {
      if (a.click) await page.click(a.click);
      if (a.eval) await page.evaluate(a.eval);
      await page.waitForTimeout(300);
    }
    if (!s.transition) await page.waitForTimeout(1500);
    if (s.scroll)
      await page.evaluate(
        (sel) => document.querySelector(sel)?.scrollIntoView({ block: "center" }),
        s.scroll,
      );
    await page.screenshot({
      path: `${outDir}${s.name}.png`,
      timeout: 180000,
      fullPage: !!s.full,
      ...(s.clip ? { clip: s.clip } : {}),
    });
    const state = await page.evaluate(() => {
      const d = document.querySelector(".ps-desk").dataset;
      return {
        boundary: d.boundary,
        stage: d.stage,
        ghosts: d.ghosts,
        mode: d.stageMode,
        backend: d.backend ?? "",
        text: document.querySelector(".ps-scene [role=status]")?.textContent ?? "",
      };
    });
    index.push({ file: `${s.name}.png`, note: s.note, ...state });
    console.log(s.name, state.boundary, state.stage, state.mode);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (!only)
  writeFileSync(
    `${outDir}captures.json`,
    `${JSON.stringify({ gpu: gpu ? "machine GPU" : "SwiftShader", captures: index }, null, 2)}\n`,
  );
