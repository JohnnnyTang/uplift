/* global document, console, setTimeout, fetch */
/**
 * Session 5K captures: the production glacial scene on 5G2's recorded runs. One command, from the
 * repository root, redoes everything (build, server, stills, results.json):
 *
 *   node docs/review/glacial/scene/capture.mjs
 *
 * By default it runs `vite build` for the book and serves the production build with `vite preview` on a
 * free local port. Options (environment variables):
 *   STAGE_BASE_URL=http://127.0.0.1:5190   use an already running dev or preview server instead
 *   STAGE_SERVER=dev                       start the dev server instead of build + preview
 *
 * Uses installed Chrome (headless). Rock, time and front-face positions are grid columns and model years
 * chosen below; every number on the page comes from the run.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const bookDir = fileURLToPath(new URL("../../../../uplift/book/", import.meta.url));
const require = createRequire(new URL("../../../../uplift/book/package.json", import.meta.url));
const playwright = await import(pathToFileURL(require.resolve("playwright")).href);
const chromium = playwright.chromium ?? playwright.default.chromium;
const out = new URL("./", import.meta.url);

// ---- Server -------------------------------------------------------------------------------------------
const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
const run = (cmd, args, cwd) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")}: ${code}`)),
    );
  });
let server = null;
let origin = process.env.STAGE_BASE_URL;
if (!origin) {
  const port = await freePort();
  const kind = process.env.STAGE_SERVER === "dev" ? "dev" : "preview";
  if (kind === "preview") await run("pnpm", ["--filter", "@uplift/book", "build"], repo);
  const args = ["exec", "vite", ...(kind === "preview" ? ["preview"] : []), "--port", String(port)];
  server = spawn("pnpm", [...args, "--host", "127.0.0.1", "--strictPort"], {
    cwd: bookDir,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  origin = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {
      /* not up yet */
    }
    if (i > 120) throw new Error(`server at ${origin} did not start`);
    await new Promise((r) => setTimeout(r, 500));
  }
}
const stopServer = () => {
  if (!server) return;
  if (process.platform === "win32") spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
  else server.kill();
};

// ---- Browser helpers ------------------------------------------------------------------------------------
const base = origin + "/?review=glacial-stage";
const results = {
  base: "/?review=glacial-stage",
  server: server ? "local" : origin,
  captures: [],
  errors: [],
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
results.browser = browser.version();

async function open(query, viewport, options = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: options.scale ?? 1,
    ...(options.reducedMotion ? { reducedMotion: "reduce" } : {}),
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => results.errors.push(`${query}: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().endsWith("/favicon.ico"))
      results.errors.push(`${query}: HTTP ${r.status()} ${r.url().replace(origin, "")}`);
  });
  await page.goto(base + query);
  await page.waitForSelector(".gs-desk[data-ready], .gs-tray[disabled]", { timeout: 60000 });
  return { context, page };
}
const state = (page) =>
  page.evaluate(() => {
    const desk = document.querySelector(".gs-desk");
    return {
      mode: desk?.dataset.stageMode,
      backend: desk?.dataset.backend ?? null,
      cutColumn: desk?.dataset.cutColumn ?? null,
      liveRock: desk?.dataset.liveRock ?? null,
      ghost: desk?.dataset.ghost || null,
      overdeepened: desk?.dataset.overdeepened ?? null,
      provenance: document.querySelector(".gs-provenance")?.textContent,
      marginNotes: document.querySelector(".gs-margin")?.innerText.split(/\n+/).filter(Boolean),
      textAlternative: document.querySelector(".gs-sr")?.textContent,
    };
  });
async function shot(
  name,
  query,
  viewport,
  { wait = 4200, full = false, element, scale, before, reducedMotion, label } = {},
) {
  const { context, page } = await open(query, viewport, { scale, reducedMotion });
  await page.waitForTimeout(wait);
  if (before) await before(page);
  const path = fileURLToPath(new URL(name, out));
  if (element) await page.locator(element).first().screenshot({ path });
  else await page.screenshot({ path, fullPage: full });
  results.captures.push({
    name,
    ...(label ? { label } : {}),
    query,
    viewport,
    scale: scale ?? 1,
    ...(await state(page)),
  });
  await context.close();
}
/** Carries a specimen from the tray over the block; drops it if `drop`. */
async function carry(page, rock, drop) {
  const g = await page.evaluate(() => document.querySelector(".gs-desk").blockScreenGeometry());
  const n = g.outline.length;
  const c = g.outline.reduce((s, p) => ({ x: s.x + p.x / n, y: s.y + p.y / n }), { x: 0, y: 0 });
  const b = await page.locator(`.gs-specimen[data-rock="${rock}"]`).boundingBox();
  const sx = b.x + 12;
  const sy = b.y + b.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) await page.mouse.move(sx + ((c.x - sx) * i) / 14, sy + ((c.y - sy) * i) / 14);
  if (drop) {
    await page.mouse.up();
    await page.waitForTimeout(900);
  }
}

// ---- Framing ---------------------------------------------------------------------------------------------
// Grid columns and model years only; grid, cell size and times come from the capture manifests.
// DEFAULT_COLUMN = 51 at the last snapshot: the reader default (D-W5-R1 item 4), a display choice.
// MOUTH_COLUMN = 10: below the snout in every run, the V the river cut.
// OVERDEEPENED_COLUMN = 35: inside the reach of the shale trough that the model wears below the floor
//   further down by 300 model years (measureOverdeepening on the three-column floor fires at i = 26–43
//   there; never in granite or sandstone).
const DEFAULT_COLUMN = 51;
const MOUTH_COLUMN = 10;
const OVERDEEPENED_COLUMN = 35;
const manifest = JSON.parse(
  readFileSync(
    new URL("../../../../hachure/glacier/src/testing/captured-runs/shale.json", import.meta.url),
    "utf8",
  ),
);
const LAST_FRAME = manifest.snapshots.length - 1;
results.framing = {
  grid: manifest.grid,
  defaultColumn: DEFAULT_COLUMN,
  mouthColumn: MOUTH_COLUMN,
  overdeepenedColumn: OVERDEEPENED_COLUMN,
};
const desktop = { width: 1440, height: 900 };
const laptop = { width: 1366, height: 768 };
const phone = { width: 390, height: 844 };

try {
  await mkdir(out, { recursive: true });
  // Desktop and laptop, tilted book.
  await shot("desktop-1440-default.png", "", desktop, {
    label: "Reader default: sandstone, last snapshot, front face at grid column 51",
  });
  await shot("desktop-1440-compare.png", "&rock=shale&kept=granite", desktop, {
    label: "Shale run with the kept granite run as the dotted ghost",
  });
  await shot("desktop-1440-specimen-drag.png", "", desktop, {
    label: "Carrying the shale specimen over the block (drop outline shown)",
    before: (page) => carry(page, "shale", false),
  });
  await shot("desktop-1440-specimen-dropped.png", "", desktop, {
    label: "Shale dropped on the block: the selector's command; sandstone becomes the kept run",
    before: (page) => carry(page, "shale", true),
  });
  await shot("desktop-1440-under-the-ice.png", "&rock=shale&kept=granite", desktop, {
    before: async (page) => {
      await page.getByLabel("See under the ice").check();
      await page.waitForTimeout(600);
    },
  });
  await shot("laptop-1366-compare.png", "&rock=shale&kept=granite", laptop);
  // Phone at page size.
  await shot("phone-390.png", "&rock=shale&kept=granite", phone, { scale: 2 });
  await shot("phone-390-full.png", "&rock=shale&kept=granite", phone, { full: true });
  // The figure at page size (flat), 2× for detail: the morphology change over the run, V against U.
  for (const k of [0, 5, 10, LAST_FRAME])
    await shot(
      `figure-shale-frame-${String(k).padStart(2, "0")}.png`,
      `&mode=flat&rock=shale&frame=${k}`,
      desktop,
      {
        element: ".gs-figure",
        scale: 2,
      },
    );
  await shot("figure-v-below-snout.png", `&mode=flat&rock=shale&column=${MOUTH_COLUMN}`, desktop, {
    element: ".gs-figure",
    scale: 2,
  });
  await shot("figure-u-under-ice.png", `&mode=flat&rock=shale&column=${DEFAULT_COLUMN}`, desktop, {
    element: ".gs-figure",
    scale: 2,
  });
  for (const [rock, kept] of [
    ["shale", "granite"],
    ["sandstone", "shale"],
    ["granite", "shale"],
  ])
    await shot(`lens-${rock}-ghost-${kept}.png`, `&mode=flat&rock=${rock}&kept=${kept}`, desktop, {
      element: ".gs-lens",
      scale: 2,
    });
  await shot("overdeepening-note.png", `&mode=flat&rock=shale&column=${OVERDEEPENED_COLUMN}`, desktop, {
    label: "Overdeepening note, shown because the model's floor here lies below the floor further down",
    element: ".gs-spread",
  });
  await shot("reduced-motion-1440.png", "", desktop, { reducedMotion: true, full: true, wait: 1500 });
  await shot("static-fallback-1440.png", "&static=1", desktop, { wait: 400 });
  await shot("fig1-labels.png", "&static=1", desktop, { element: ".gs-frame", scale: 2, wait: 400 });
} finally {
  await browser.close();
  stopServer();
}

// Drop captures this script no longer makes.
const made = new Set(results.captures.map((c) => c.name));
for (const f of await readdir(out)) if (/\.(png|webm)$/.test(f) && !made.has(f)) await rm(new URL(f, out));

// Formatted with the repository's Prettier, so `pnpm check` stays clean after a recapture.
const resultsUrl = new URL("results.json", out);
const prettierModule = await import(
  pathToFileURL(createRequire(repo + "package.json").resolve("prettier")).href
);
const prettier = prettierModule.default ?? prettierModule;
const prettierOptions = (await prettier.resolveConfig(fileURLToPath(resultsUrl))) ?? {};
await writeFile(
  resultsUrl,
  await prettier.format(JSON.stringify(results), { ...prettierOptions, parser: "json" }),
);
console.log(`${results.captures.length} captures, ${results.errors.length} page errors`);
if (results.errors.length) {
  console.log(results.errors.join("\n"));
  process.exitCode = 1;
}
