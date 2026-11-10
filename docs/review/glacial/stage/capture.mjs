/* global document, console, setTimeout, fetch */
/**
 * R1 review build captures for session 5H (book stage, look and transition) on 5G's recorded runs.
 * One command, from the repository root, redoes everything (build, server, stills, video, results.json):
 *
 *   node docs/review/glacial/stage/capture.mjs
 *
 * By default it runs `vite build` for the book and serves the production build with `vite preview` on a
 * free local port, so the captures show exactly what a reader gets (including the capture files emitted
 * as assets). Options (environment variables):
 *   STAGE_BASE_URL=http://127.0.0.1:5190   use an already running dev or preview server instead
 *   STAGE_SERVER=dev                       start the dev server instead of build + preview
 *   ONLY=stills|video                      redo one part (writes results-<part>.json)
 *
 * Uses installed Chrome (headless). Every view states its provenance on the page (recorded model run, or
 * the authored fixture when `&fixture=1`). Rock, time and front-face positions are chosen per capture
 * below; every number on the page comes from the run.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const bookDir = fileURLToPath(new URL("../../../../uplift/book/", import.meta.url));
const require = createRequire(new URL("../../../../uplift/book/package.json", import.meta.url));
const playwright = await import(pathToFileURL(require.resolve("playwright")).href);
const chromium = playwright.chromium ?? playwright.default.chromium;
const out = new URL("./", import.meta.url);
const only = process.env.ONLY;

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
      source: desk?.dataset.source ?? null,
      provenance: document.querySelector(".gs-provenance")?.textContent,
      marginNotes: document.querySelector(".gs-margin")?.innerText.split(/\n+/).filter(Boolean),
      textAlternative: document.querySelector(".gs-sr")?.textContent,
    };
  });
async function shot(
  name,
  query,
  viewport,
  { wait = 3800, full = false, element, scale, before, reducedMotion } = {},
) {
  const { context, page } = await open(query, viewport, { scale, reducedMotion });
  if (before) await before(page);
  await page.waitForTimeout(wait);
  const path = fileURLToPath(new URL(name, out));
  if (element) await page.locator(element).screenshot({ path });
  else await page.screenshot({ path, fullPage: full });
  results.captures.push({ name, query, viewport, scale: scale ?? 1, ...(await state(page)) });
  await context.close();
}

// Where the front face shows the clearest U in the recorded runs (shale, 200 model years, near the head),
// and the same place in the other rocks. Found by scanning `measureSection` over the captures (shape
// exponent 1.86 at grid column i = 106, block row 21 of 127 from the head); when the captures are
// regenerated (5G2), recheck these two numbers against the new runs.
const U_FRAME = 10;
const U_CUT = 21 / 127;
const desktop = { width: 1440, height: 900 };

try {
  await mkdir(out, { recursive: true });
  if (!only || only === "stills") {
    // Desktop, tilted book: the drawing, mid-transition (ink), and the finished scene.
    for (const [name, ms] of [
      ["desktop-1440-1-drawing.png", 0],
      ["desktop-1440-2-ink.png", 1250],
      ["desktop-1440-3-colour.png", 3600],
    ]) {
      await shot(name, "", desktop, {
        wait: 0,
        before: async (page) => {
          await page.waitForTimeout(3600);
          await page.getByRole("button", { name: "Replay the drawing" }).click();
          await page.waitForTimeout(ms);
        },
      });
    }
    await shot("desktop-1366.png", "", { width: 1366, height: 768 });
    await shot("desktop-1440-flat.png", "&mode=flat", desktop, { full: true });
    await shot("reduced-motion-1440.png", "", desktop, { wait: 1200, reducedMotion: true, full: true });
    await shot("zoom-200-equivalent.png", "", { width: 720, height: 450 }, { full: true });
    // Phone at the actual page size: the first screen, and the whole page.
    await shot("phone-390.png", "", { width: 390, height: 844 }, { scale: 2 });
    await shot("phone-390-full.png", "", { width: 390, height: 844 }, { full: true });
    await shot("static-fallback-1440.png", "&static=1", desktop, { wait: 300 });
    await shot("fixture-1440.png", "&fixture=1", desktop);
    // The recorded run, frame by frame (front face at the mouth, below the snout).
    for (const k of [0, 5, 10, 15])
      await shot(
        `run-shale-frame-${String(k).padStart(2, "0")}.png`,
        `&mode=flat&rock=shale&frame=${k}`,
        desktop,
        {
          element: ".gs-frame",
          scale: 2,
        },
      );
    // The front face: V below the snout (full block) against U under the ice (cut moved up the valley).
    await shot("front-face-v-below-snout.png", `&mode=flat&rock=shale&frame=${U_FRAME}&cut=1`, desktop, {
      element: ".gs-frame",
      scale: 2,
    });
    await shot("front-face-u-under-ice.png", `&mode=flat&rock=shale&frame=${U_FRAME}&cut=${U_CUT}`, desktop, {
      element: ".gs-frame",
      scale: 2,
    });
    await shot("tilted-u-under-ice.png", `&rock=shale&frame=${U_FRAME}&cut=${U_CUT}`, desktop);
    await shot("under-the-ice.png", `&mode=flat&rock=shale&frame=${U_FRAME}&cut=${U_CUT}`, desktop, {
      element: ".gs-frame",
      scale: 2,
      before: async (page) => {
        await page.waitForTimeout(3800);
        await page.getByLabel("See under the ice").check();
      },
    });
    // The three recorded runs at the same time and front face, ice hidden to show the rock.
    for (const rock of ["shale", "sandstone", "granite"])
      await shot(`rock-${rock}.png`, `&mode=flat&rock=${rock}&frame=${U_FRAME}&cut=${U_CUT}`, desktop, {
        element: ".gs-frame",
        scale: 2,
        before: async (page) => {
          await page.waitForTimeout(3800);
          await page.getByLabel("See under the ice").check();
        },
      });
  }

  // Video: open → transition → the recorded run playing → front face from V (below the snout) to U (under
  // the ice) → ice hidden → the same place in granite.
  if (!only || only === "video") {
    const dir = fileURLToPath(new URL("./video-tmp/", out));
    const context = await browser.newContext({
      viewport: desktop,
      recordVideo: { dir, size: desktop },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => results.errors.push(`video: ${e.message}`));
    await page.goto(base + "&rock=shale");
    await page.waitForSelector(".gs-desk[data-ready]", { timeout: 60000 });
    await page.waitForTimeout(4200);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".gs-desk")?.dataset.playing === "false", null, {
      timeout: 60000,
    });
    await page.waitForTimeout(1200);
    const time = page.getByRole("slider", { name: "Recorded time" });
    await time.focus();
    const last = Number(await time.getAttribute("max"));
    for (let k = last; k > U_FRAME; k--) {
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(800);
    const slider = page.getByRole("slider", { name: "Front face" });
    await slider.focus();
    // One arrow press moves the front face one grid cell up the valley.
    for (let i = 0; i < 400 && Number(await slider.inputValue()) > U_CUT + 1e-6; i++) {
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(1500);
    await page.getByLabel("See under the ice").check();
    await page.waitForTimeout(1500);
    await page.getByLabel("Granite").check();
    await page.waitForTimeout(2000);
    await page.getByLabel("See under the ice").uncheck();
    await page.waitForTimeout(1500);
    results.captures.push({
      name: "open-transition-run-front-face.webm",
      query: "&rock=shale",
      viewport: desktop,
      ...(await state(page)),
    });
    const video = page.video();
    await context.close();
    await rename(await video.path(), fileURLToPath(new URL("open-transition-run-front-face.webm", out)));
    await rm(dir, { recursive: true, force: true });
  }
} finally {
  await browser.close();
  stopServer();
}

// Drop captures of an earlier build that this script no longer makes.
const made = new Set(results.captures.map((c) => c.name));
if (!only)
  for (const f of await readdir(out)) if (/\.(png|webm)$/.test(f) && !made.has(f)) await rm(new URL(f, out));

// Formatted with the repository's Prettier, so `pnpm check` stays clean after a recapture.
const resultsUrl = new URL(only ? `results-${only}.json` : "results.json", out);
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
