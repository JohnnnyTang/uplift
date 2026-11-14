/**
 * Session 5N acceptance walk on the default route (no query string): the evidence behind the PB1–PB9 and
 * GV1–GV9 ledger in docs/review/glacial/acceptance/README.md. Each test names the rows it supplies.
 *
 * The journey: open → transition → pick rock (page selector, keyboard alternative to the specimen drop, and
 * the drop itself) → play → scrub back → return to live → slide the cut → see under the ice → second rock →
 * compare at matched model time → change level (the model must not reset) → turn the page and back → reset.
 * Plus: the page claim read off the live page at the registered section, same-rock replay, phone, reduced
 * motion, pressure-free reflection, research route and privacy.
 *
 * Backend: whatever auto selection picks. Playwright's bundled Chromium has no WebGPU adapter, so it runs the
 * labelled CPU worker; `UPLIFT_E2E_CHANNEL=chrome` exercises WebGPU on a hardware adapter.
 */
import { type Page, expect, test } from "@playwright/test";

test.describe.configure({ timeout: 300_000 });

interface Geometry {
  outline: { x: number; y: number }[];
}

/** The registered teaching section (PROTOCOL_SECTIONS.underIce) and the spread's default cut (D-W5-R1 4). */
const REGISTERED_COLUMN = 74;
const DEFAULT_COLUMN = 51;

const desk = (page: Page) => page.locator(".gs-desk");
const years = async (page: Page) => Number(await desk(page).getAttribute("data-model-years"));
const margin = (page: Page) => page.locator(".gs-margin");
const metres = (text: string, label: RegExp) => {
  const m = label.exec(text);
  if (!m) throw new Error(`no ${label} in "${text}"`);
  return Number(m[1]);
};

async function openBook(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  // A clean console too: 5N found a favicon 404 logged on every load of the default route.
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.goto("/");
  await expect(desk(page)).toHaveAttribute("data-source", "live", { timeout: 60_000 });
  await expect(desk(page)).toHaveAttribute("data-transition", "done", { timeout: 30_000 });
  return errors;
}

async function playUntil(page: Page, atLeast: number) {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(desk(page)).toHaveAttribute("data-playing", "true");
  await expect.poll(() => years(page), { timeout: 200_000 }).toBeGreaterThanOrEqual(atLeast);
  const pause = page.getByRole("button", { name: "Pause", exact: true });
  if (await pause.isVisible()) await pause.click();
  await expect(desk(page)).toHaveAttribute("data-playing", "false");
}

/** Scrubs the recorded-time slider to `target` model years (snapshots every 20 model years). */
async function scrubTo(page: Page, target: number) {
  const time = page.getByRole("slider", { name: "Recorded time" });
  await time.focus();
  await page.keyboard.press("Home");
  for (let t = 0; t < target; t += 20) await page.keyboard.press("ArrowRight");
  await expect(desk(page)).toHaveAttribute("data-model-years", String(target));
}

/** Moves the front face to a grid column with the slider's keyboard twin (one cell per arrow). */
async function cutTo(page: Page, column: number) {
  const cut = page.getByRole("slider", { name: "Front face" });
  await cut.focus();
  for (let k = 0; k < 200; k++) {
    const now = Number(await desk(page).getAttribute("data-cut-column"));
    if (now === column) return;
    // ArrowRight moves the face down-valley (smaller grid column), ArrowLeft up-valley.
    await page.keyboard.press(now > column ? "ArrowRight" : "ArrowLeft");
  }
  throw new Error(`front face did not reach column ${column}`);
}

async function dropSpecimen(page: Page, rock: string) {
  const chip = (await page.locator(`.gs-specimen[data-rock="${rock}"]`).boundingBox())!;
  const outline = (
    await page.evaluate(() =>
      (
        document.querySelector(".gs-desk") as unknown as { blockScreenGeometry(): Geometry }
      ).blockScreenGeometry(),
    )
  ).outline;
  const target = {
    x: outline.reduce((s, p) => s + p.x, 0) / outline.length,
    y: outline.reduce((s, p) => s + p.y, 0) / outline.length,
  };
  const from = { x: chip.x + 12, y: chip.y + chip.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++)
    await page.mouse.move(from.x + ((target.x - from.x) * i) / 10, from.y + ((target.y - from.y) * i) / 10);
  await expect(page.locator(".gs-drop-overlay")).toHaveAttribute("data-active", "");
  await page.mouse.up();
}

/** GV5: the time label, the margin note and the figure's own state name the same run, rock and time. */
async function expectOneRunOneTime(page: Page) {
  // Read everything in one frame (a pause may still be settling onto its final frame).
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const d = document.querySelector<HTMLElement>(".gs-desk")!;
          const y = Number(d.dataset.modelYears);
          const note = document.querySelector('.gs-margin [data-note="time"]')?.textContent ?? "";
          const now = document.querySelector(".gs-time-now")?.textContent ?? "";
          const m = /^([\d.]+) model years in (\w+)$/.exec(note.trim());
          const n = /^model time ([\d.]+) model years$/.exec(now.trim());
          // The note binds four significant figures (5L bindings.ts), the label two decimals (5J labels.ts).
          const noteOk = !!m && Math.abs(Number(m[1]) - y) <= 0.05 && m[2] === d.dataset.liveRock;
          const nowOk = d.dataset.view === "past" || (!!n && Math.abs(Number(n[1]) - y) <= 0.005);
          return noteOk && nowOk ? "consistent" : `y ${y} note "${note}" label "${now}"`;
        }),
      { timeout: 15_000 },
    )
    .toBe("consistent");
}

test("PB4 PB9 GV1 GV2 GV5 GV6: the full journey on the default route, keyboard first", async ({ page }) => {
  const errors = await openBook(page);

  // PB4: immediate play, nothing to answer or configure first; the page invites Play (D-W5-5M2).
  await expect(page).toHaveURL(/spread=geomorph\.u-valley/);
  await expect(page.getByRole("heading", { level: 1, name: "From V to U" })).toBeVisible();
  await expect(desk(page)).toHaveAttribute("data-model-years", "0");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeEnabled();
  await expect(page.locator(".gs-play-invite")).toBeVisible();
  await expect(page.locator('input[name="gs-prediction"]:checked')).toHaveCount(0);
  await expectOneRunOneTime(page);

  // GV1 + GV6: the keyboard alternative to the specimen drop — the same rock radios, by arrow keys.
  await page.getByRole("radio", { name: /Sandstone/ }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("radio", { name: /Shale/ })).toBeChecked();
  await expect(desk(page)).toHaveAttribute("data-live-rock", "shale");
  // Before any advance a choice replaces the unadvanced run: nothing is kept.
  await expect(desk(page)).toHaveAttribute("data-ghost", "");

  // Play (keyboard: Space on the focused button), then pause at the live head.
  await page.getByRole("button", { name: "Play", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(desk(page)).toHaveAttribute("data-playing", "true");
  await expect.poll(() => years(page), { timeout: 200_000 }).toBeGreaterThanOrEqual(100);
  await page.getByRole("button", { name: "Pause", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(desk(page)).toHaveAttribute("data-playing", "false");
  await expect(page.locator(".gs-play-invite")).toBeHidden();
  await expectOneRunOneTime(page);
  const shaleRun = await desk(page).getAttribute("data-run-id");

  // GV2: scrub back to a recorded moment, labelled as earlier; then return to live.
  await scrubTo(page, 20);
  await expect(desk(page)).toHaveAttribute("data-view", "past");
  await expect(page.locator(".gs-time-now")).toContainText("Earlier moment");
  await expect(margin(page)).toContainText("an earlier moment of this run");
  await expectOneRunOneTime(page);
  await page.getByRole("button", { name: "Back to the latest moment" }).click();
  await expect(desk(page)).toHaveAttribute("data-view", "live");
  expect(await years(page)).toBeGreaterThanOrEqual(100);

  // Slide the cut (keyboard twin of the front-face drag), view-only: the run and time do not move.
  await expect(desk(page)).toHaveAttribute("data-cut-column", String(DEFAULT_COLUMN));
  const before = { run: shaleRun, at: await years(page) };
  await cutTo(page, REGISTERED_COLUMN);
  await expect(desk(page)).toHaveAttribute("data-run-id", before.run!);
  expect(await years(page)).toBe(before.at);
  await expect(page.getByRole("slider", { name: "Front face" })).toHaveAttribute(
    "aria-valuetext",
    /through the ice/,
  );

  // See under the ice: an X-ray view that leaves every bound number alone.
  const notes = await margin(page).innerText();
  await page.getByLabel("See under the ice").check();
  await expect(page.locator(".gs-sr")).toContainText("ice is hidden");
  expect(await margin(page).innerText()).toBe(notes);
  await page.getByLabel("See under the ice").uncheck();

  // GV1: a second rock by the 3D gesture: a new run from the authored start; the shale run is kept.
  await dropSpecimen(page, "granite");
  await expect(desk(page)).toHaveAttribute("data-live-rock", "granite");
  await expect(desk(page)).not.toHaveAttribute("data-run-id", shaleRun!);
  await expect(desk(page)).toHaveAttribute("data-model-years", "0");
  await expect(desk(page)).toHaveAttribute("data-ghost", "shale");
  await expect(page.getByRole("radio", { name: /Granite/ })).toBeChecked();
  await playUntil(page, 100);

  // GV2 + GV5: compare at matched model time; the ghost and the compare note name the kept run at that time.
  await scrubTo(page, 100);
  await expectOneRunOneTime(page);
  const compare = margin(page).locator('[data-note="compare"]');
  await expect(compare).toContainText("a separate run with another rock, shale, at 100 model years");
  await expect(page.locator(".gs-lens .lens-ghost")).toHaveCount(1);
  await expect(page.locator(".gs-sr")).toContainText("separate run with another rock, shale");

  // GV1/GV3 on the page: at the registered section and a matched time, the soft rock is worn deeper
  // (R4, the taught "faster and deeper" claim). Numbers are read from the bound notes, nothing typed.
  const graniteLowered = metres(await margin(page).innerText(), /floor lowered (\d+) m/);
  const shaleLowered = metres(await compare.innerText(), /lowered (\d+) m/);
  expect(shaleLowered).toBeGreaterThan(graniteLowered);
  const graniteNotesAt100 = await margin(page).innerText();
  await page.getByRole("button", { name: "Back to the latest moment" }).click();

  // PB9: change level — words, controls and overlays change; the run, its time and the kept run do not.
  const run = await desk(page).getAttribute("data-run-id");
  const at = await years(page);
  const loweredBefore = await margin(page).locator('[data-note="lowered"]').innerText();
  await page.getByRole("button", { name: "University level" }).click();
  await expect(page.getByRole("button", { name: "University level" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(margin(page)).toContainText("shape b =");
  await expect(page.getByRole("button", { name: "Step", exact: true })).toBeVisible();
  await expect(desk(page)).toHaveAttribute("data-run-id", run!);
  await expect(desk(page)).toHaveAttribute("data-ghost", "shale");
  expect(await years(page)).toBe(at);
  await expect(margin(page).locator('[data-note="lowered"]')).toHaveText(loweredBefore);
  // GV2: step is a real model advance on the live run.
  if (await page.getByRole("button", { name: "Step", exact: true }).isEnabled()) {
    await page.getByRole("button", { name: "Step", exact: true }).click();
    await expect.poll(() => years(page)).toBeGreaterThan(at);
  }
  // The deeper level states the bound grid, solver and parameters (5N fixed a doubled "cells cells" here).
  await page.getByRole("button", { name: "Read deeper level ↗" }).click();
  const panel = page.locator(".gs-reading-panel");
  await expect(panel).toContainText(/Grid 160 cells by 64 cells, each 40 m across\. Solver: (webgpu|cpu)/);
  await expect(panel).not.toContainText("cells cells");
  await panel.getByRole("button", { name: "Back to the book" }).click();
  await page.getByRole("button", { name: "University level" }).click();
  await expect(desk(page)).toHaveAttribute("data-run-id", run!);

  // PB7: turn the page (bar button) and back (keyboard PageUp from the page heading); nothing is lost.
  const atTurn = await years(page);
  await page.getByRole("button", { name: "Turn to Where will the water go?" }).click();
  await expect(page.getByRole("heading", { name: "Where will the water go?", exact: true })).toBeVisible();
  // Managed focus lands on the new page heading; PageUp from there turns back.
  await page.locator("h1").focus();
  await page.keyboard.press("PageUp");
  await expect(desk(page)).toHaveAttribute("data-source", "live", { timeout: 60_000 });
  await expect(desk(page)).toHaveAttribute("data-run-id", run!);
  await expect(desk(page)).toHaveAttribute("data-live-rock", "granite");
  await expect(desk(page)).toHaveAttribute("data-ghost", "shale");
  expect(await years(page)).toBe(atTurn);

  // Reset: an inline confirm while kept runs exist; then the authored defaults and no runs.
  await page.getByRole("button", { name: "Start again" }).click();
  await expect(page.locator(".gs-confirm")).toContainText("kept run");
  await page.getByRole("button", { name: "Remove them and start again" }).click();
  await expect(desk(page)).toHaveAttribute("data-model-years", "0");
  await expect(desk(page)).toHaveAttribute("data-live-rock", "sandstone");
  await expect(desk(page)).toHaveAttribute("data-ghost", "");

  // Determinism on the page: the same rock, config and backend reproduce the same recorded run.
  await page.getByRole("radio", { name: /Granite/ }).check();
  await expect(desk(page)).toHaveAttribute("data-live-rock", "granite");
  await playUntil(page, 100);
  await cutTo(page, REGISTERED_COLUMN);
  await scrubTo(page, 100);
  const replay = await margin(page).innerText();
  const strip = (s: string) =>
    s
      .split("\n")
      .map((l) => l.trim())
      // Whether 100 years is "an earlier moment" depends on where the pause landed, not on the run.
      .filter((l) => l && !l.includes("a separate run") && !l.includes("an earlier moment"))
      .join("\n");
  expect(strip(replay)).toBe(strip(graniteNotesAt100));
  expect(errors).toEqual([]);
});

test("PB3 GV4: drawing → ink → colour transition into a scene standing on the tilted page", async ({
  page,
}) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto("/");
  // The figure is a line drawing first; it also serves as the static fallback.
  await expect(page.locator(".gs-page-figure svg").first()).toBeVisible();
  await expect(desk(page)).toHaveAttribute("data-transition", /running|done/, { timeout: 60_000 });
  await expect(desk(page)).toHaveAttribute("data-transition", "done", { timeout: 30_000 });
  await expect(desk(page)).toHaveAttribute("data-stage-mode", "tilted");
  await expect(page.locator(".gs-desk canvas")).toBeVisible();
  // The block stands on the right page: its projected outline lies over the figure page.
  const outline = await page.evaluate(
    () =>
      (
        document.querySelector(".gs-desk") as unknown as { blockScreenGeometry(): Geometry }
      ).blockScreenGeometry().outline,
  );
  const figure = (await page.locator(".gs-page-figure").boundingBox())!;
  const cx = outline.reduce((s, p) => s + p.x, 0) / outline.length;
  expect(cx).toBeGreaterThan(figure.x);
  expect(cx).toBeLessThan(figure.x + figure.width);
  // Replay the drawing: the transition is replayable and is presentation, not model time.
  await page.getByRole("button", { name: "Replay the drawing" }).click();
  await expect(desk(page)).toHaveAttribute("data-transition", "done", { timeout: 30_000 });
  await expect(desk(page)).toHaveAttribute("data-model-years", "0");
});

for (const [width, height] of [
  [1366, 768],
  [1440, 900],
] as const) {
  test(`PB1: the tilted spread and the bar fit ${width}×${height} without page scrolling`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors = await openBook(page);
    await expect(desk(page)).toHaveAttribute("data-stage-mode", "tilted");
    const size = await page.evaluate(() => ({
      w: document.documentElement.scrollWidth,
      h: document.documentElement.scrollHeight,
    }));
    expect(size.w).toBeLessThanOrEqual(width);
    expect(size.h).toBeLessThanOrEqual(height);
    // The key action, the answer reveal and the bar are on screen without scrolling.
    for (const target of [
      page.getByRole("button", { name: "Play", exact: true }),
      page.locator(".gs-flap summary"),
      page.getByRole("navigation", { name: "Book pages" }),
    ]) {
      const box = (await target.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
    // Recorded for the owner (finding O1 in the acceptance ledger): how large the book, the block and the
    // lesson title actually appear at the frozen default view.
    const metrics = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const outline = (
        document.querySelector(".gs-desk") as unknown as {
          blockScreenGeometry(): { outline: { x: number; y: number }[] };
        }
      ).blockScreenGeometry().outline;
      const xs = outline.map((p) => p.x);
      const ys = outline.map((p) => p.y);
      const text = r(".gs-page-text");
      const figure = r(".gs-page-figure");
      const h1 = r(".gs-page-text h1");
      return {
        spreadWidthPx: Math.round(figure.right - text.left),
        blockWidthPx: Math.round(Math.max(...xs) - Math.min(...xs)),
        blockHeightPx: Math.round(Math.max(...ys) - Math.min(...ys)),
        titleHeightPx: Math.round(h1.height),
        titleCssFontPx: parseFloat(getComputedStyle(document.querySelector(".gs-page-text h1")!).fontSize),
      };
    });
    await testInfo.attach("view-metrics", { body: JSON.stringify(metrics), contentType: "application/json" });
    expect(errors).toEqual([]);
  });
}

test("PB6: the question can be skipped and the flap opens without an answer; nothing gates the book", async ({
  page,
}) => {
  const errors = await openBook(page);
  const flap = page.locator(".gs-flap");
  await flap.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(flap).toHaveAttribute("open", "");
  await expect(page.locator('input[name="gs-prediction"]:checked')).toHaveCount(0);
  // No score, stamp or endpoint requirement exists on the spread.
  expect(await page.locator('[class*="stamp"], [class*="score"]').count()).toBe(0);
  await expect(page.getByRole("button", { name: "Turn to Where will the water go?" })).toBeEnabled();
  await page.getByRole("button", { name: "Turn to Where will the water go?" }).click();
  await expect(page.getByRole("heading", { name: "Where will the water go?", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("PB2 GV6: phone — the journey on a flat single page, no horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openBook(page);
  await expect(desk(page)).toHaveAttribute("data-stage-mode", "flat");
  const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await noScroll()).toBe(true);
  await page.getByRole("radio", { name: /Shale/ }).check();
  await playUntil(page, 40);
  await scrubTo(page, 20);
  await expect(desk(page)).toHaveAttribute("data-view", "past");
  await page.getByRole("button", { name: "Back to the latest moment" }).click();
  await cutTo(page, DEFAULT_COLUMN + 3);
  await page.getByRole("radio", { name: /Granite/ }).check();
  await expect(desk(page)).toHaveAttribute("data-ghost", "shale");
  await playUntil(page, 20);
  await expect(page.locator(".gs-lens svg")).toBeVisible();
  const run = await desk(page).getAttribute("data-run-id");
  await page.getByRole("button", { name: "University level" }).click();
  await expect(desk(page)).toHaveAttribute("data-run-id", run!);
  expect(await noScroll()).toBe(true);
  await page.getByRole("button", { name: /(Turn to|Read) Where will the water go\?/ }).click();
  await expect(page.getByRole("heading", { name: "Where will the water go?", exact: true })).toBeVisible();
  expect(await noScroll()).toBe(true);
  await page.getByRole("button", { name: /Turn to From V to U|Read From V to U/ }).click();
  await expect(desk(page)).toHaveAttribute("data-run-id", run!, { timeout: 60_000 });
  await expect(desk(page)).toHaveAttribute("data-ghost", "shale");
  expect(errors).toEqual([]);
});

test("PB3 GV6: reduced motion — flat page, crossfade, keyboard journey, nothing animating", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await openBook(page);
  await expect(desk(page)).toHaveAttribute("data-stage-mode", "flat");
  await page.getByRole("radio", { name: /Sandstone/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(desk(page)).toHaveAttribute("data-live-rock", "granite");
  await page.getByRole("button", { name: "Play", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect.poll(() => years(page), { timeout: 200_000 }).toBeGreaterThanOrEqual(20);
  await page.getByRole("button", { name: "Pause", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(desk(page)).toHaveAttribute("data-playing", "false");
  await expect(page.locator(".gs-sr")).toContainText("front face of the block");
  expect(
    await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length),
  ).toBe(0);
  // Lithology patterns back up the rock colours (non-colour cue) on every specimen.
  for (const rock of ["shale", "sandstone", "granite"])
    await expect(page.locator(`.gs-specimen[data-rock="${rock}"] pattern`)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("GV7 PB7: the water spread, the research route and privacy safeguards are retained", async ({
  page,
}) => {
  const foreign: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname) && url.protocol.startsWith("http"))
      foreign.push(request.url());
  });
  const errors = await openBook(page);
  await page.getByRole("button", { name: "Contents" }).click();
  await expect(page.locator(".reader-contents")).toContainText("Where will the water go?");
  await page.getByRole("button", { name: "Research example" }).click();
  await expect(page).toHaveURL(/view=research/);
  await expect(page.locator(".book")).toBeVisible({ timeout: 60_000 });
  await page.goBack();
  await expect(desk(page)).toHaveAttribute("data-source", "live", { timeout: 60_000 });
  // No analytics or third-party network traffic on the default route.
  expect(foreign).toEqual([]);
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((k) => /observ|analytic|log/i.test(k))),
  ).toEqual([]);
  expect(errors).toEqual([]);
});
