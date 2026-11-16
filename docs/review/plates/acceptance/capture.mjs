// Session 7G: acceptance captures and a short video of the two-lesson book on the default route (the production
// build), for the ledger, the owner scene review and the two owner decisions of D-W7-7G (ghost labels off the
// front face; a higher default view of the block). ILLUSTRATION: lesson 2's shapes are authored (D-L2-1).
//
//   pnpm build && pnpm --filter @uplift/book preview --host 127.0.0.1 --port 4197 --strictPort
//   node docs/review/plates/acceptance/capture.mjs [--base http://127.0.0.1:4197] [--swiftshader]
//
// Default: installed Chrome on the machine's GPU (as the owner sees it); --swiftshader uses Playwright's Chromium
// on SwiftShader, as the e2e suite. `captures/before/` holds the same views on main before 7G (27f033c).
/* global console, process, URL, document, Event, navigator, innerWidth, innerHeight, window */
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const argv = process.argv.slice(2);
const base = argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "http://127.0.0.1:4197";
const swift = argv.includes("--swiftshader");
const out = new URL("./captures/", import.meta.url);
const file = (name) => new URL(name, out).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(file("./"), { recursive: true });
const browser = await chromium.launch(
  swift
    ? { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }
    : { channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist"] },
);
const notes = [];
const l2 = (page) => page.locator(".ps-desk");
const l1 = (page) => page.locator(".gs-desk:not(.ps-desk)");
const scrub = (page, v) =>
  page.locator("#ps-stage").evaluate((input, value) => {
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, v);
const settle = (page) => page.waitForTimeout(swift ? 1500 : 500);
const facts = (page) =>
  page.evaluate(async () => {
    const d = document.querySelector(".ps-desk") ?? document.querySelector(".gs-desk");
    const book = d?.querySelector(".gs-book")?.style.transform ?? "";
    const adapter = navigator.gpu ? await navigator.gpu.requestAdapter().catch(() => null) : null;
    return {
      viewport: `${innerWidth}×${innerHeight}`,
      backend: d?.dataset.backend ?? null,
      stageMode: d?.dataset.stageMode ?? null,
      book,
      boundary: d?.dataset.boundary ?? null,
      stage: d?.dataset.stage ?? null,
      ghosts: d?.dataset.ghosts ?? null,
      adapter: adapter?.info ? `${adapter.info.vendor} ${adapter.info.architecture}`.trim() : null,
      textAlternative: document.querySelector(".ps-scene [role=status]")?.textContent ?? null,
    };
  });
const shot = async (page, name, note, clip) => {
  await page.screenshot({ path: file(`${name}.png`), ...(clip ? { clip } : {}) });
  notes.push({ file: `captures/${name}.png`, note, ...(await facts(page)) });
  console.log(name);
};
/** The figure page with the block and the ghost key, for close looks. */
const figureClip = async (page, pad = 16) => {
  const g = await l2(page).evaluate((d) => {
    const geo = d.blockScreenGeometry();
    const key = d.querySelector(".ps-ghost-key:not([hidden])")?.getBoundingClientRect();
    const cap = d.querySelector(".gs-figure figcaption").getBoundingClientRect();
    return { outline: geo.outline, keyBottom: key?.bottom ?? 0, capBottom: cap.bottom };
  });
  const xs = g.outline.map((p) => p.x);
  const ys = g.outline.map((p) => p.y);
  const x = Math.max(0, Math.min(...xs) - pad);
  const y = Math.max(0, Math.min(...ys) - pad);
  const bottom = Math.max(...ys, g.keyBottom, g.capBottom) + pad;
  return { x, y, width: Math.max(...xs) + pad - x, height: bottom - y };
};
async function openLesson2(page) {
  await page.goto(`${base}/?spread=tectonics.plate-boundaries&page=spread`);
  await page.locator('.ps-desk[data-transition="done"]').waitFor({ timeout: 90_000 });
  await settle(page);
}
async function viewAll(page, stage = 1) {
  for (const b of ["convergent", "divergent", "transform"]) {
    await page.locator(`.ps-choice[data-boundary=${b}]`).click();
    await scrub(page, stage);
    await settle(page);
  }
}

// ---- Video: the turn, the transition, a boundary playing, ghosts (1440 × 900) ----
mkdirSync(file("video-tmp/"), { recursive: true });
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir: file("video-tmp/"), size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  await page.goto(`${base}/`);
  await page.locator('.gs-desk[data-transition="done"]').first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Turn to Where plates meet" }).click();
  await page.locator('.ps-desk[data-transition="done"]').waitFor({ timeout: 90_000 });
  await page.waitForTimeout(800);
  await page.locator(".ps-choice[data-boundary=convergent]").click();
  await scrub(page, 1);
  await page.waitForTimeout(700);
  await page.locator(".ps-choice[data-boundary=transform]").click();
  await page.locator(".ps-stage .gs-play").click();
  await page.waitForFunction(() => document.querySelector(".ps-desk").dataset.playing === "false", null, {
    timeout: 60_000,
  });
  await page.waitForTimeout(1500);
  await context.close();
  const [video] = readdirSync(file("video-tmp/"));
  renameSync(file(`video-tmp/${video}`), file("journey-turn-transform.webm"));
  rmSync(file("video-tmp/"), { recursive: true, force: true });
  notes.push({
    file: "captures/journey-turn-transform.webm",
    note: "Lesson 1 → turn → transition → convergent late → transform played early to late, convergent as a ghost, at the new default block view (1440 × 900).",
  });
  console.log("journey-turn-transform.webm");
}

// ---- Owner decisions 1 and 2, and the ledger's views, at desktop sizes ----
for (const [w, h] of [
  [1440, 900],
  [1920, 1080],
  [1366, 768],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  await openLesson2(page);
  await shot(
    page,
    `d2-${w}x${h}-start`,
    `Default view at ${w} × ${h}: book tilt 48° (as lesson 1), the block tipped 12° towards the reader (D-W7-7G item 2).`,
  );
  await viewAll(page);
  await shot(
    page,
    `d1-${w}x${h}-transform-ghosts`,
    `Transform at late with convergent and divergent ghosts at ${w} × ${h}: the labels are the key under the front face, each tied to its profile by a leader (D-W7-7G item 1).`,
  );
  if (w !== 1366) {
    const hi = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    await openLesson2(hi);
    await viewAll(hi);
    await shot(
      hi,
      `d1-${w}x${h}-figure-2x`,
      `Close look (2×) at the figure page at ${w} × ${h}: block, ghost profiles, leaders and the key.`,
      await figureClip(hi),
    );
    await hi.close();
  }
  await page.close();
}

// ---- PL3 / PL4: each landform at late, default view, close look (1440 × 900 at 2×) ----
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await openLesson2(page);
  for (const b of ["convergent", "divergent", "transform"]) {
    await page.locator(".gs-reset").click();
    await page.locator(`.ps-choice[data-boundary=${b}]`).click();
    await scrub(page, 1);
    await settle(page);
    await shot(
      page,
      `pl3-${b}-late-2x`,
      `${b} at late, default view, no ghosts, 1440 × 900 at 2× (PL3, PL4).`,
      await figureClip(page),
    );
  }
  await page.locator(".gs-reset").click();
  await settle(page);
  await shot(
    page,
    "pl3-start-2x",
    "The shared start, default view, 1440 × 900 at 2× (PL1, PL6).",
    await figureClip(page),
  );
  await page.close();
}

// ---- Known issues (a), (c), (d): lesson 1 and lesson 2 at 1440 × 900 ----
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`${base}/`);
  await page.locator('.gs-desk[data-transition="done"]').first().waitFor({ timeout: 90_000 });
  await settle(page);
  await shot(
    page,
    "c-1440-lesson1",
    "Lesson 1 at 1440 × 900, school level, flap closed: the book's fit scale before the turn (issue c).",
  );
  await page.getByRole("button", { name: "Turn to Where plates meet" }).click();
  await page.locator('.ps-desk[data-transition="done"]').waitFor({ timeout: 90_000 });
  await settle(page);
  await shot(
    page,
    "c-1440-lesson2",
    "Lesson 2 at 1440 × 900 after the turn: one-column left page (issue d), larger fit scale than lesson 1 (issue c).",
  );
  await page.getByRole("button", { name: "Turn to From V to U" }).click();
  await page.locator('.gs-desk[data-transition="done"]').first().waitFor({ timeout: 90_000 });
  await page
    .getByRole("navigation", { name: "Book pages" })
    .getByRole("button", { name: "University level" })
    .click();
  await l1(page)
    .locator(".gs-flap")
    .evaluate((f) => (f.open = true));
  await settle(page);
  await shot(
    page,
    "a-1440-lesson1-uni-flap",
    "Lesson 1, university level, flap open at 1440 × 900: the book stays on the desk; the column scrolls inside the page (issue a, fixed).",
  );
  await page.getByRole("button", { name: "Turn to Where plates meet" }).click();
  await page.locator('.ps-desk[data-transition="done"]').waitFor({ timeout: 90_000 });
  await l2(page)
    .locator(".gs-flap")
    .evaluate((f) => (f.open = true));
  await settle(page);
  await shot(
    page,
    "a-1440-lesson2-uni-flap",
    "Lesson 2, university level, flap open at 1440 × 900: the column scrolls inside the page (7F), the book stays on the desk.",
  );
  await page.close();
}

// ---- Phone, reduced motion and the drawing-only fallback ----
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await openLesson2(page);
  await viewAll(page);
  await page.locator(".ps-ghost-key").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -260));
  await settle(page);
  await shot(
    page,
    "d1-390x844-transform-ghosts",
    "Phone (390 × 844): one flat page; the key sits under the face, leaders to the profiles (D-W7-7G item 1).",
  );
  await page.close();
  const rm = await browser.newPage({
    viewport: { width: 1366, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await openLesson2(rm);
  await rm.locator(".ps-choice[data-boundary=divergent]").click();
  await scrub(rm, 1);
  await settle(rm);
  await shot(rm, "pl7-reduced-motion", "Reduced motion: the flat page, the stage in steps (PL7).");
  await rm.close();
}
const noGl = await chromium.launch({ args: ["--disable-webgl", "--disable-webgl2", "--disable-gpu"] });
{
  const page = await noGl.newPage({ viewport: { width: 1366, height: 900 } });
  await page.goto(`${base}/?spread=tectonics.plate-boundaries&page=spread`);
  await page.locator('.ps-desk[data-static="true"]').waitFor({ timeout: 60_000 });
  await page.locator(".ps-choice[data-boundary=convergent]").click();
  await scrub(page, 1);
  await settle(page);
  await shot(
    page,
    "pl7-drawing-only",
    "No 3D (WebGL off): the drawing and the enlarged front face, 'Drawing only: …' (PL7, fallback).",
  );
}
await noGl.close();
await browser.close();
writeFileSync(
  file("../results.json"),
  `${JSON.stringify({ base, gpu: !swift, captures: notes }, null, 2)}\n`,
);
console.log("done");
