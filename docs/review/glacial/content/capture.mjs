/* global document, console, setTimeout, fetch */
/**
 * Copy-fit captures for session 5L (lesson content). One command, from the repository root:
 *
 *   node docs/review/glacial/content/capture.mjs
 *
 * Starts the book's Vite dev server on a free port, opens the R1 review build (`?review=glacial-stage`,
 * owned by 5H/5K and not modified here) and, in the page, replaces its draft layout copy with the 5L lesson
 * content imported straight from `uplift/spreads/geomorph.u-valley` (Vite serves workspace source under
 * `/@fs/`). Margin notes are rendered through the runtime's BindingEngine from the model's own section
 * probe (`measureSection`), averaged over `noteColumns()` at the default front face and rounded with
 * `roundForNote()`, on the recorded shale run, with the sandstone run as the kept, compared run. That
 * averaging is a stand-in for 5K's helper (D-W5-R1 item 9), so the values are real model output.
 *
 * Captures: desktop 1440 × 900 and short laptop 1366 × 768 (tilted book), phone 390 × 844 (flat page), at
 * both reading levels on desktop. Each records whether the text page or the margin overflows
 * (`results.json`). Option: STAGE_BASE_URL=http://127.0.0.1:5190 to use a running dev server.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

const repo = fileURLToPath(new URL("../../../../", import.meta.url))
  .replace(/\\/g, "/")
  .replace(/\/$/, "");
const bookDir = fileURLToPath(new URL("../../../../uplift/book/", import.meta.url));
const require = createRequire(new URL("../../../../uplift/book/package.json", import.meta.url));
const playwright = await import(pathToFileURL(require.resolve("playwright")).href);
const chromium = playwright.chromium ?? playwright.default.chromium;
const out = new URL("./", import.meta.url);

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
let server = null;
let origin = process.env.STAGE_BASE_URL;
if (!origin) {
  const port = await freePort();
  server = spawn("pnpm", ["exec", "vite", "--port", String(port), "--host", "127.0.0.1", "--strictPort"], {
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

const shale = JSON.parse(
  readFileSync(
    new URL("../../../../hachure/glacier/src/testing/captured-runs/shale.json", import.meta.url),
    "utf8",
  ),
);
const DEFAULT_COLUMN = 51; // checked in-page against U_VALLEY_VIEW.defaultFrontFace.gridColumn
const cut = (shale.grid.nx - 1 - DEFAULT_COLUMN) / (shale.grid.nx - 1);
const lastFrame = shale.snapshots.length - 1;

const results = { origin, captures: [], errors: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true });
results.browser = browser.version();

/** In-page: swap the review build's draft copy for the 5L lesson at one reading level. */
async function inject(page, level) {
  return page.evaluate(
    async ({ root, level, column }) => {
      const fs = (p) => `/@fs/${root}/${p}`;
      const L = await import(fs("uplift/spreads/geomorph.u-valley/lesson.ts"));
      const C = await import(fs("uplift/spreads/geomorph.u-valley/content.ts"));
      const V = await import(fs("uplift/spreads/geomorph.u-valley/config.ts"));
      const B = await import(fs("uplift/spreads/geomorph.u-valley/bindings.ts"));
      const G = await import(fs("hachure/glacier/src/index.ts"));
      const E = await import(fs("hachure/runtime/src/bindings/engine.ts"));
      if (V.U_VALLEY_VIEW.defaultFrontFace.gridColumn !== column) throw new Error("default column moved");

      const load = async (rock) => {
        const base = fs("hachure/glacier/src/testing/captured-runs/");
        const manifest = await (await fetch(`${base}${rock}.json`)).json();
        const bin = await (await fetch(`${base}${manifest.binFile}`)).arrayBuffer();
        return G.decodeCapturedRun(manifest, bin);
      };
      const measure = (run) => {
        const face = V.resolveDefaultFrontFace(run.manifest);
        const now = run.snapshot(face.snapshotIndex);
        const start = run.snapshot(0);
        const cols = V.noteColumns(face.gridColumn);
        const m = (snap, ice) =>
          cols.map((i) =>
            G.measureSection(snap.bedM, ice ? snap.iceThicknessM : undefined, run.manifest.grid, i),
          );
        const a = m(now, true);
        const s = m(start, false);
        const mean = (xs) => xs.reduce((t, x) => t + x, 0) / xs.length;
        const grid = run.manifest.grid;
        return {
          modelYears: face.modelYears,
          rock: run.manifest.rockId,
          faceKm: ((grid.nx - 1 - face.gridColumn) * grid.metresPerCell) / 1000,
          floorWidth: V.roundForNote(mean(a.map((x) => x.floorWidthM))),
          depth: V.roundForNote(mean(a.map((x) => x.depthM))),
          lowered: V.roundForNote(
            mean(s.map((x) => x.floorElevationM)) - mean(a.map((x) => x.floorElevationM)),
          ),
          wall: Math.round(mean(a.map((x) => x.maxWallSlopeDeg))),
          b: mean(a.map((x) => x.shapeExponent)),
          ice: V.roundForNote(mean(a.map((x) => x.maxIceThicknessM))),
          spanM: V.noteSpanM(grid.metresPerCell),
        };
      };
      const live = measure(await load("shale"));
      const kept = measure(await load("sandstone"));
      const engine = new E.BindingEngine({ probes: B.uValleyProbes, controls: [] });
      engine.update({
        probe: {
          modelTime: live.modelYears,
          rockName: live.rock,
          faceDistance: live.faceKm,
          floorWidth: live.floorWidth,
          valleyDepth: live.depth,
          floorLowered: live.lowered,
          steepestWall: live.wall,
          iceThickness: live.ice,
          shapeExponent: live.b,
          keptRockName: kept.rock,
          keptModelTime: kept.modelYears,
          keptFloorWidth: kept.floorWidth,
          keptValleyDepth: kept.depth,
          keptFloorLowered: kept.lowered,
          keptSteepestWall: kept.wall,
          keptShapeExponent: kept.b,
          sectionSpan: live.spanM,
          noteRounding: V.U_VALLEY_VIEW.marginNotes.roundToM,
        },
      });
      const r = (t) => engine.render(t[level]);
      const el = (tag, text, cls) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
      };

      document.querySelector(".gs-running-head").textContent =
        `Lesson ${L.LESSON_NUMBER} · ${r(L.runningHeads.text)}`;
      const intro = document.querySelector(".gs-introduction");
      intro.querySelector(".gs-lesson-number").textContent = `Lesson ${L.LESSON_NUMBER}`;
      intro.querySelector("h1").textContent = r(L.title);
      intro.querySelectorAll("p:not(.gs-lesson-number)").forEach((p) => p.remove());
      for (const para of C.pageContent.body[level].split(/\n\s*\n/)) intro.append(el("p", para));
      const dl = document.querySelector(".gs-keywords");
      dl.replaceChildren(...L.keyWords.flatMap((k) => [el("dt", r(k.term)), el("dd", r(k.definition))]));
      const flap = document.querySelector(".gs-flap");
      flap.querySelector("summary").textContent = r(L.predict.question);
      flap.querySelectorAll("p").forEach((p) => p.remove());
      flap.append(el("p", L.predict.options.map((o) => r(o)).join(" · ")));
      for (const para of C.pageContent.flap[level].split(/\n\s*\n/)) flap.append(el("p", para));
      const margin = document.querySelector(".gs-margin");
      const shown = L.marginNotes.filter(
        (n) => n.levels.includes(level) && ["always", "face-under-ice", "kept-run"].includes(n.when),
      );
      margin.replaceChildren(...shown.map((n) => el("p", r(n.text))), el("p", r(L.challenge)));
      const caption = document.querySelector("#gs-fig-caption > span:first-child");
      caption.replaceChildren(el("span", `Fig. ${L.FIGURE_NUMBER}`, "gs-fig-number"), r(L.figure.caption));
      document.querySelector(".gs-provenance").textContent = r(L.figure.limitation);
      const trayNote = document.querySelector(".gs-tray + .gs-limit");
      if (trayNote) trayNote.textContent = r(L.controlsCopy.newRun);

      const overflow = (sel) => {
        const n = document.querySelector(sel);
        return n
          ? { scroll: n.scrollHeight, client: n.clientHeight, overflows: n.scrollHeight > n.clientHeight + 1 }
          : null;
      };
      // Content bottom against the page box, in the page's own (untransformed) layout.
      const page = document.querySelector(".gs-page-text");
      const folio = page.querySelector(".gs-folio");
      const lastText = [...page.querySelectorAll(".gs-text-column > *")].reduce(
        (max, n) => Math.max(max, n.offsetTop + n.offsetHeight),
        0,
      );
      return {
        live,
        kept,
        notes: [...margin.querySelectorAll("p")].map((p) => p.textContent),
        mode: document.querySelector(".gs-desk")?.dataset.stageMode,
        textPage: overflow(".gs-page-text"),
        column: overflow(".gs-text-column"),
        textBottomPx: lastText,
        folioTopPx: folio?.offsetTop ?? null,
      };
    },
    { root: repo, level, column: DEFAULT_COLUMN },
  );
}

const views = [
  { name: "desktop-1440-hs.png", viewport: { width: 1440, height: 900 }, level: "hs" },
  { name: "desktop-1440-uni.png", viewport: { width: 1440, height: 900 }, level: "uni" },
  { name: "laptop-1366x768-hs.png", viewport: { width: 1366, height: 768 }, level: "hs" },
  { name: "laptop-1366x768-uni.png", viewport: { width: 1366, height: 768 }, level: "uni" },
  { name: "phone-390-hs.png", viewport: { width: 390, height: 844 }, level: "hs", full: true },
  { name: "phone-390-uni.png", viewport: { width: 390, height: 844 }, level: "uni", full: true },
];

try {
  for (const v of views) {
    const context = await browser.newContext({ viewport: v.viewport });
    const page = await context.newPage();
    page.on("pageerror", (e) => results.errors.push(`${v.name}: ${e.message}`));
    await page.goto(`${origin}/?review=glacial-stage&rock=shale&frame=${lastFrame}&cut=${cut}`);
    await page.waitForSelector(".gs-desk[data-ready]", { timeout: 90000 });
    await page.waitForTimeout(4500); // let the drawing → ink → colour transition finish
    const state = await inject(page, v.level);
    await page.waitForTimeout(400);
    await page.screenshot({ path: fileURLToPath(new URL(v.name, out)), fullPage: v.full ?? false });
    results.captures.push({ ...v, ...state });
    console.log(v.name, state.mode, JSON.stringify(state.textPage), JSON.stringify(state.column));
    await context.close();
  }
} catch (error) {
  results.errors.push(String(error?.stack ?? error));
  console.error(error);
} finally {
  await browser.close();
  stopServer();
  await writeFile(new URL("results.json", out), JSON.stringify(results, null, 2) + "\n");
}
