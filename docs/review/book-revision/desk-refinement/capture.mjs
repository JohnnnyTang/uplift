/**
 * Session 6G evidence: screenshots and on-screen book measurements of both lessons.
 *
 *   node docs/review/book-revision/desk-refinement/capture.mjs <before|after> [origin]
 *
 * Serve a production build first (`pnpm build`, then `pnpm --filter @uplift/book preview --port 4617`).
 * Writes `<label>-<lesson>-<view>.png` and `<label>-measurements.json` next to this file.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] ?? "after";
const origin = process.argv[3] ?? "http://127.0.0.1:4617";
const only = process.argv[4];

const VIEWS = [
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "2560x1440", width: 2560, height: 1440 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "reflow-320", width: 320, height: 800 },
  { name: "reduced-motion-1440", width: 1440, height: 900, reducedMotion: true },
  { name: "more-contrast-1440", width: 1440, height: 900, contrast: true },
];
const LESSONS = [
  { name: "lesson1", url: "/", desk: ".gs-desk:not(.ps-desk)", ready: "[data-transition=done]" },
  {
    name: "lesson2",
    url: "/?spread=tectonics.plate-boundaries",
    desk: ".ps-desk",
    ready: "[data-ready=true]",
  },
];

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
for (const view of VIEWS) {
  if (only && !view.name.includes(only)) continue;
  for (const lesson of LESSONS) {
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      reducedMotion: view.reducedMotion ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(origin + lesson.url);
    await page.waitForSelector(lesson.desk + lesson.ready, { timeout: 120_000 });
    if (view.contrast) await page.getByRole("button", { name: "More contrast" }).click();
    await page.waitForTimeout(1200);
    const m = await page.evaluate((deskSelector) => {
      const desk = document.querySelector(deskSelector);
      const box = (e) => {
        const r = e.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      };
      const union = (...bs) => ({
        left: Math.min(...bs.map((b) => b.left)),
        top: Math.min(...bs.map((b) => b.top)),
        right: Math.max(...bs.map((b) => b.right)),
        bottom: Math.max(...bs.map((b) => b.bottom)),
      });
      const paper = union(box(desk.querySelector(".gs-page-text")), box(desk.querySelector(".gs-page-figure")));
      const boards = box(desk.querySelector(".gs-boards"));
      const bar = box(document.querySelector(".reader-bar"));
      const d = box(desk);
      const round = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v)]));
      const h1 = desk.querySelector("h1").getBoundingClientRect();
      const body = desk.querySelector(".gs-lesson p");
      return {
        mode: desk.dataset.stageMode,
        transform: desk.querySelector(".gs-book").style.transform,
        desk: round(d),
        paper: round(paper),
        boards: round(boards),
        paperWidth: Math.round(paper.right - paper.left),
        paperHeight: Math.round(paper.bottom - paper.top),
        // Where the book's middle sits between the desk's top (under the view controls) and the bottom bar's
        // top: 0.5 is centred.
        verticalCentre: +(((boards.top + boards.bottom) / 2 - d.top) / (bar.top - d.top)).toFixed(3),
        gapAbove: Math.round(boards.top - d.top),
        gapBelowToBar: Math.round(bar.top - boards.bottom),
        // The 3D block's highest point relative to the desk's top (negative: clipped under the controls).
        blockTopMargin: (() => {
          const g = desk.blockScreenGeometry?.();
          return g?.outline?.length ? Math.round(Math.min(...g.outline.map((p) => p.y)) - d.top) : null;
        })(),
        titleHeightPx: Math.round(h1.height),
        bodyCssFontPx: body ? parseFloat(getComputedStyle(body).fontSize) : null,
        scrollW: document.documentElement.scrollWidth,
        scrollH: document.documentElement.scrollHeight,
      };
    }, lesson.desk);
    await page.screenshot({ path: join(here, `${label}-${lesson.name}-${view.name}.png`) });
    results.push({ view: view.name, lesson: lesson.name, ...m, errors });
    console.log(
      `${view.name} ${lesson.name} ${m.mode} paper ${m.paperWidth}x${m.paperHeight} above ${m.gapAbove} below ${m.gapBelowToBar} centre ${m.verticalCentre} blockTop ${m.blockTopMargin} ${m.transform} scroll ${m.scrollW}x${m.scrollH} ${errors.length ? "ERRORS " + errors.join("|") : ""}`,
    );
    await context.close();
  }
}
await browser.close();
if (!only) writeFileSync(join(here, `${label}-measurements.json`), JSON.stringify(results, null, 2) + "\n");
