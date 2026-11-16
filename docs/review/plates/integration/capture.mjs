// Session 7F: captures and a video of the two-lesson book on the default route (the production build).
// Walks the journey: lesson 1 → play → turn the page → transition → convergent → play → scrub → divergent →
// ghosts → transform by dragging an arrow → university level → turn back (lesson 1 intact) → reset. Also the
// look-tuning crops (block at 2×), the left page at university level with the flap open, phone, reduced
// motion and the drawing-only fallback. ILLUSTRATION: lesson 2's shapes are authored (D-L2-1).
//
//   pnpm build && pnpm --filter @uplift/book preview --host 127.0.0.1 --port 4183 --strictPort
//   node docs/review/plates/integration/capture.mjs [--base http://127.0.0.1:4183] [--gpu]
//
// SwiftShader by default (as the e2e suite); --gpu uses the machine's GPU.
/* global console, process, URL, document, Event */
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const argv = process.argv.slice(2);
const base = argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "http://127.0.0.1:4183";
const gpu = argv.includes("--gpu");
const out = new URL("./", import.meta.url);
const file = (name) => new URL(name, out).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const args = gpu
  ? ["--enable-gpu", "--ignore-gpu-blocklist"]
  : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const notes = [];
const browser = await chromium.launch({ args });

const l2 = (page) => page.locator(".ps-desk");
const shot = async (page, name, note, clip) => {
  await page.screenshot({ path: file(`${name}.png`), ...(clip ? { clip } : {}) });
  const alt = await page
    .locator(".ps-scene [role=status]")
    .textContent()
    .catch(() => null);
  notes.push({ file: `${name}.png`, note, ...(alt ? { textAlternative: alt } : {}) });
  console.log(name);
};
const blockClip = async (page) => {
  const g = await l2(page).evaluate((d) => d.blockScreenGeometry());
  const xs = g.outline.map((p) => p.x);
  const ys = g.outline.map((p) => p.y);
  const pad = 24;
  const x = Math.max(0, Math.min(...xs) - pad);
  const y = Math.max(0, Math.min(...ys) - pad * 3);
  return { x, y, width: Math.max(...xs) + pad - x, height: Math.max(...ys) + pad - y };
};
const scrub = (page, stage) =>
  page.locator("#ps-stage").evaluate((input, v) => {
    input.value = String(v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, stage);
const settled = (page) => page.waitForTimeout(gpu ? 400 : 1500);

// ---- The journey, recorded ----
mkdirSync(file("video-tmp/"), { recursive: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: file("video-tmp/"), size: { width: 960, height: 600 } },
});
const page = await context.newPage();
page.on("pageerror", (e) => console.error("pageerror", e.message));
await page.goto(`${base}/`);
await page.locator('.gs-desk[data-transition="done"]').first().waitFor({ timeout: 90_000 });
await page.getByRole("button", { name: "Play", exact: true }).click();
await page.waitForFunction(() => Number(document.querySelector(".gs-desk").dataset.modelYears) >= 40, null, {
  timeout: 120_000,
});
await shot(page, "01-lesson1-playing", "Lesson 1 playing, before the page turn.");
const yearsAtLeave = await page.locator(".gs-desk").getAttribute("data-model-years");
await page.getByRole("button", { name: "Turn to Where plates meet" }).click();
await page.locator('.ps-desk[data-transition="running"]').waitFor({ timeout: 60_000 });
await page.waitForTimeout(gpu ? 700 : 1200);
await shot(
  page,
  "02-turn-transition",
  "Lesson 2 just after the page turn: the drawing going over into the block.",
);
await page.locator('.ps-desk[data-transition="done"]').waitFor({ timeout: 90_000 });
await settled(page);
await shot(
  page,
  "03-plates-start",
  "Lesson 2, the shared start, no boundary chosen; same book tilt as lesson 1.",
);
await page.locator(".ps-choice[data-boundary=convergent]").click();
await page.locator(".ps-stage .gs-play").click();
await page.waitForFunction(() => Number(document.querySelector(".ps-desk").dataset.stage) >= 0.5, null, {
  timeout: 60_000,
});
await page.locator(".ps-stage .gs-play").click();
await scrub(page, 1);
await settled(page);
await shot(page, "04-convergent-late", "Convergent, played then scrubbed to late.");
await page.locator(".ps-choice[data-boundary=divergent]").click();
await scrub(page, 1);
await settled(page);
await shot(
  page,
  "05-divergent-late-ghost",
  "Divergent at late, with the convergent ghost on the front face.",
);
const targets = await l2(page).evaluate((d) => d.plateArrowTargets());
// Drag the left plate's arrow along the boundary (screen up): transform.
await page.mouse.move(targets.left.x, targets.left.y);
await page.mouse.down();
for (let k = 1; k <= 8; k++) await page.mouse.move(targets.left.x, targets.left.y - (70 * k) / 8);
await page.mouse.up();
await scrub(page, 1);
await settled(page);
await shot(
  page,
  "06-transform-late-dragged",
  "Transform chosen by dragging an arrow along the boundary, late stage, two ghosts.",
);
await page.getByRole("button", { name: "University level" }).click();
await page.evaluate(() => {
  const flap = document.querySelector(".ps-desk .gs-flap");
  flap.open = true;
  flap.closest(".ps-text-column").scrollTop = 1e4;
});
await settled(page);
await shot(
  page,
  "07-university-flap-open",
  "University level, flap open: the left page scrolls inside the page; the scene is unchanged.",
);
await page.getByRole("button", { name: "University level" }).click();
await page.getByRole("button", { name: "Turn to From V to U" }).click();
await page.locator('.gs-desk:not(.ps-desk)[data-source="live"]').waitFor({ timeout: 90_000 });
const yearsBack = await page.locator(".gs-desk").getAttribute("data-model-years");
await settled(page);
await shot(
  page,
  "08-lesson1-returned",
  `Back on lesson 1: model years at leave ${yearsAtLeave}, on return ${yearsBack}; runs kept.`,
);
await page
  .getByRole("button", { name: "Pause", exact: true })
  .click()
  .catch(() => {});
await page.getByRole("button", { name: "Turn to Where plates meet" }).click();
await page.locator('.ps-desk[data-transition="done"]').waitFor({ timeout: 90_000 });
await page.locator(".gs-reset").click();
await settled(page);
await shot(page, "09-plates-reset", "Lesson 2 after Start again: no boundary chosen, no ghosts.");
await context.close();
const [webm] = readdirSync(file("video-tmp/"));
renameSync(file(`video-tmp/${webm}`), file("journey.webm"));
rmSync(file("video-tmp/"), { recursive: true });

// ---- Look crops at 2× (owner look note: rift floor, ridge hachures, offset and scarps) ----
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await p.goto(`${base}/?spread=tectonics.plate-boundaries&page=spread`);
  await p.locator('.ps-desk[data-transition="done"]').waitFor({ timeout: 90_000 });
  for (const b of ["convergent", "divergent", "transform"]) {
    await p.locator(`.ps-choice[data-boundary=${b}]`).click();
    await scrub(p, 1);
    await settled(p);
    await shot(
      p,
      `look-${b}-late-block`,
      `${b}, late stage, the block at 2× (7F look tuning).`,
      await blockClip(p),
    );
  }
  await p.locator(".gs-reset").click();
  await settled(p);
  await shot(
    p,
    "look-start-block",
    "The shared start at 2×: ridges without rows of hachure dots.",
    await blockClip(p),
  );
  await p.close();
}

// ---- Phone, reduced motion, drawing-only fallback ----
{
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(`${base}/?spread=tectonics.plate-boundaries&page=spread`);
  await p.locator('.ps-desk[data-ready="true"]').waitFor({ timeout: 90_000 });
  await p.locator(".ps-choice[data-boundary=divergent]").click();
  await scrub(p, 1);
  await settled(p);
  await shot(p, "10-phone", "Phone: one readable page, flat; lesson 2 after the turn.");
  await p.close();
}
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await p.goto(`${base}/?spread=tectonics.plate-boundaries&page=spread&motion=reduce`);
  await p.locator('.ps-desk[data-ready="true"]').waitFor({ timeout: 90_000 });
  await p.locator(".ps-choice[data-boundary=convergent]").click();
  await scrub(p, 0.5);
  await settled(p);
  await shot(p, "11-reduced-motion", "Reduced motion: the flat page, stage in steps.");
  await p.close();
}
{
  const noGl = await chromium.launch({ args: ["--disable-webgl", "--disable-webgl2", "--disable-gpu"] });
  const p = await noGl.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`${base}/?spread=tectonics.plate-boundaries&page=spread`);
  await p.locator('.ps-desk[data-static="true"]').waitFor({ timeout: 90_000 });
  await p.locator(".reader-scene-status").filter({ hasText: /\S/ }).waitFor({ timeout: 30_000 });
  await shot(p, "12-drawing-only", 'No 3D: the shell says "Drawing only", not "Showing recorded runs".');
  await noGl.close();
}
await browser.close();
writeFileSync(file("captures.json"), `${JSON.stringify({ base, gpu, captures: notes }, null, 2)}\n`);
