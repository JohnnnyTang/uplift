/**
 * Session 7F: the two-lesson default book. _From V to U_ is spread 1, _Where plates meet_ spread 2, with a
 * real page turn between them, the contents list, deep links and the research route (PL8). The journey: open
 * lesson 1 → play → turn the page → transition → pick convergent → play → scrub → pick divergent → compare
 * ghosts → transform by dragging an arrow → change level → turn back to lesson 1 (state intact) → reset.
 * Plus: phone, reduced motion, navigation while lesson 1 is running, the drawing-only fallback wording, the
 * left page at university level with the flap open (no clipping), and an accessibility audit.
 *
 * Lesson 2 is an illustration (D-L2-1): no runs, no model time. Lesson 1 runs on whatever backend auto
 * selection picks (the labelled CPU worker in Playwright's bundled Chromium).
 */
import { type Page, expect, test } from "@playwright/test";

test.describe.configure({ timeout: 240_000 });

const L1 = "From V to U";
const L2 = "Where plates meet";
const desk = (page: Page) => page.locator(".gs-desk");
const plates = (page: Page) => page.locator(".ps-desk");
const bar = (page: Page) => page.getByRole("navigation", { name: "Book pages" });
const years = async (page: Page) => Number(await desk(page).getAttribute("data-model-years"));
const stage = async (page: Page) => Number(await plates(page).getAttribute("data-stage"));
const status = (page: Page) => page.locator(".ps-scene [role=status]");

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

async function openLessonOne(page: Page, query = "") {
  const errors = collectErrors(page);
  await page.goto(`/${query}`);
  await expect(desk(page)).toHaveAttribute("data-source", "live", { timeout: 60_000 });
  await expect(desk(page)).toHaveAttribute("data-transition", "done", { timeout: 30_000 });
  return errors;
}

async function openLessonTwo(page: Page, query = "") {
  const errors = collectErrors(page);
  await page.goto(`/?spread=tectonics.plate-boundaries&page=spread${query}`);
  await expect(plates(page)).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  return errors;
}

async function scrub(page: Page, value: number) {
  await page.locator("#ps-stage").evaluate((input: HTMLInputElement, v) => {
    input.value = String(v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

type Targets = Record<"left" | "right", { x: number; y: number } | null>;
async function dragArrow(page: Page, side: "left" | "right", dx: number, dy: number) {
  const targets = () =>
    plates(page).evaluate((d) => (d as unknown as { plateArrowTargets(): Targets }).plateArrowTargets());
  await expect.poll(async () => (await targets())[side]).not.toBeNull();
  const p = (await targets())[side]!;
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let k = 1; k <= 6; k++) await page.mouse.move(p.x + (dx * k) / 6, p.y + (dy * k) / 6);
  await page.mouse.up();
}

/** Model years per second of view time while lesson 1 plays (for the "no hidden advance" bound). */
async function playRate(page: Page) {
  const a = await years(page);
  const t = Date.now();
  await expect.poll(() => years(page), { timeout: 120_000 }).toBeGreaterThan(a);
  await page.waitForTimeout(1500);
  return (await years(page)) - a > 0 ? ((await years(page)) - a) / ((Date.now() - t) / 1000) : 0;
}

test("the book has two lessons: next turns to lesson 2, contents lists both, deep links and history work", async ({
  page,
}) => {
  const errors = await openLessonOne(page);
  await expect(bar(page).locator(".reader-position")).toHaveText(new RegExp(`1\\s*${L1}`));
  await expect(bar(page).getByRole("button", { name: "Beginning of book" })).toBeDisabled();
  const next = bar(page).getByRole("button", { name: `Turn to ${L2}` });
  await expect(next).toBeEnabled();
  await bar(page).getByRole("button", { name: "Contents" }).click();
  const links = page.locator(".reader-contents .reader-contents-link");
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toContainText(L1);
  await expect(links.nth(0)).toHaveAttribute("aria-current", "page");
  await expect(links.nth(1)).toContainText(L2);
  await expect(page.getByRole("button", { name: "Research example" })).toBeVisible();
  // Contents → lesson 2: a real page turn, URL and focus follow.
  await links.nth(1).click();
  await expect(plates(page)).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(page).toHaveURL(/spread=tectonics\.plate-boundaries/);
  await expect(bar(page).locator(".reader-position")).toHaveText(new RegExp(`2\\s*${L2}`));
  await expect(bar(page).getByRole("button", { name: "End of book" })).toBeDisabled();
  await expect(bar(page).getByRole("button", { name: `Turn to ${L1}` })).toBeEnabled();
  await expect(page.getByRole("heading", { level: 1, name: L2 })).toBeFocused();
  await expect(page.locator(".ps-desk .gs-page-text .gs-folio")).toHaveText("3");
  await expect(page.locator(".ps-desk .gs-page-figure .gs-folio")).toHaveText("4");
  // Browser back returns to lesson 1; forward to lesson 2.
  await page.goBack();
  await expect(desk(page)).toHaveAttribute("data-source", "live", { timeout: 60_000 });
  await expect(bar(page).locator(".reader-position")).toHaveText(new RegExp(`1\\s*${L1}`));
  await page.goForward();
  await expect(plates(page)).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  // The research route stays reachable from lesson 2, and returns to it.
  await bar(page).getByRole("button", { name: "Contents" }).click();
  await page.getByRole("button", { name: "Research example" }).click();
  await expect(page).toHaveURL(/view=research/);
  await expect(page.locator(".book")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Return to the book" }).click();
  await expect(plates(page)).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test("a deep link opens lesson 2 on the same tilted book, labelled an illustration, with no run words", async ({
  page,
}) => {
  const errors = await openLessonTwo(page);
  await expect(plates(page)).toHaveAttribute("data-transition", "done", { timeout: 60_000 });
  await expect(plates(page)).toHaveAttribute("data-stage-mode", "tilted");
  await expect(page.getByRole("heading", { level: 1, name: L2 })).toBeVisible();
  // Lesson 1's tilt (owner, D-W7-7F): the page turn never moves the camera.
  expect(await page.locator(".ps-desk .gs-book").evaluate((b) => b.style.transform)).toMatch(
    /rotateX\(48deg\)/,
  );
  // 7E's words on the page, one label line, no tier badge, no run or time words.
  await expect(page.locator(".ps-desk .gs-running-head").first()).toHaveText("Lesson 2 · Plate tectonics");
  await expect(page.locator(".ps-label-line")).toHaveText("Illustration: shapes drawn from real examples");
  await expect(page.getByText("Illustration: shapes drawn from real examples")).toHaveCount(1);
  await expect(page.locator(".widget-tier")).toHaveCount(0);
  await expect(page.getByText(/Model tier|stylised theory/i)).toHaveCount(0);
  await expect(page.locator("#ps-help-convergent")).toContainText("Two continents collide");
  await expect(page.locator(".hb-handle[data-handle=left]")).toHaveAccessibleName("Left plate's arrow");
  await expect(page.locator(".hb-handle[data-handle=left]")).toHaveAccessibleDescription(/arrow keys/);
  const words = await page.locator(".ps-scene").innerText();
  expect(words).not.toMatch(/\bruns?\b|model time|simulat|\byears?\b|placeholder/i);
  await expect(page.locator(".reader-scene-status")).toBeHidden();
  expect(errors).toEqual([]);
});

test("the journey across both lessons: lesson 1's run survives the turn, lesson 2 keeps its boundaries", async ({
  page,
}) => {
  const errors = await openLessonOne(page);

  // Lesson 1: choose a rock and play; keep a run by choosing a second rock.
  await page.getByRole("radio", { name: /Shale/ }).check();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(desk(page)).toHaveAttribute("data-playing", "true");
  await expect.poll(() => years(page), { timeout: 120_000 }).toBeGreaterThanOrEqual(20);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(desk(page)).toHaveAttribute("data-playing", "false");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeEnabled();
  await page.getByRole("radio", { name: /Granite/ }).check();
  await expect(desk(page)).toHaveAttribute("data-ghost", "shale");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(desk(page)).toHaveAttribute("data-playing", "true");
  const rate = await playRate(page);
  const run = await desk(page).getAttribute("data-run-id");

  // Turn the page while lesson 1 plays.
  const atLeave = await years(page);
  await bar(page)
    .getByRole("button", { name: `Turn to ${L2}` })
    .click();
  await expect(plates(page)).toHaveAttribute("data-transition", "running", { timeout: 60_000 });
  await expect(plates(page)).toHaveAttribute("data-transition", "done", { timeout: 60_000 });
  const awayFrom = Date.now();

  // Lesson 2: pick convergent → play → scrub.
  await expect(plates(page)).toHaveAttribute("data-boundary", "none");
  await page.locator(".ps-choice[data-boundary=convergent]").click();
  await expect(plates(page)).toHaveAttribute("data-boundary", "convergent");
  await expect(plates(page)).toHaveAttribute("data-stage", "0");
  const play = page.locator(".ps-stage .gs-play");
  await play.click();
  await expect(plates(page)).toHaveAttribute("data-playing", "true");
  await expect.poll(() => stage(page), { timeout: 30_000 }).toBeGreaterThan(0.2);
  await play.click();
  await expect(plates(page)).toHaveAttribute("data-playing", "false");
  await scrub(page, 0.8);
  await expect(plates(page)).toHaveAttribute("data-stage-word", "late");
  await expect(status(page)).toContainText("Convergent boundary, late stage");

  // Pick divergent: starts from the shared start; convergent is a ghost at the same stage.
  await page.locator(".ps-choice[data-boundary=divergent]").click();
  await expect(plates(page)).toHaveAttribute("data-stage", "0");
  await scrub(page, 0.8);
  await expect(plates(page)).toHaveAttribute("data-ghosts", "convergent");
  await expect(page.locator(".ps-ghost-key [data-boundary=convergent]")).toContainText("Convergent");
  await expect(page.locator(".ps-ghost-key")).toContainText(
    "Ghost outlines: boundaries you viewed before, at the same stage.",
  );

  // Transform by dragging the left plate's arrow along the boundary (screen up).
  await dragArrow(page, "left", 0, -70);
  await expect(plates(page)).toHaveAttribute("data-boundary", "transform");
  await expect(page.locator("input[name=ps-boundary][value=transform]")).toBeChecked();
  await scrub(page, 1);
  await expect(plates(page)).toHaveAttribute("data-ghosts", "convergent,divergent");

  // Change level: words change, the scene does not.
  const before = {
    boundary: await plates(page).getAttribute("data-boundary"),
    stage: await plates(page).getAttribute("data-stage"),
    ghosts: await plates(page).getAttribute("data-ghosts"),
  };
  await bar(page).getByRole("button", { name: "University level" }).click();
  await expect(page.locator("#ps-help-transform")).toContainText("Crust is neither made nor destroyed");
  expect({
    boundary: await plates(page).getAttribute("data-boundary"),
    stage: await plates(page).getAttribute("data-stage"),
    ghosts: await plates(page).getAttribute("data-ghosts"),
  }).toEqual(before);
  await bar(page).getByRole("button", { name: "University level" }).click();

  // Turn back to lesson 1: its runs, kept run and model time are as left; nothing advanced while away.
  const away = (Date.now() - awayFrom) / 1000;
  await bar(page)
    .getByRole("button", { name: `Turn to ${L1}` })
    .click();
  await expect(desk(page)).toHaveAttribute("data-source", "live", { timeout: 60_000 });
  const back = await years(page);
  expect(back).toBeGreaterThanOrEqual(atLeave);
  // Had it run on while away it would be at least rate × away further on; allow the first frames after return.
  expect(back - atLeave).toBeLessThan(Math.max(rate * Math.min(away, 10) * 0.5, rate * 3));
  await expect(desk(page)).toHaveAttribute("data-run-id", run!);
  await expect(desk(page)).toHaveAttribute("data-live-rock", "granite");
  await expect(desk(page)).toHaveAttribute("data-ghost", "shale");
  await expect(page.getByRole("radio", { name: /Granite/ })).toBeChecked();
  const pause = page.getByRole("button", { name: "Pause", exact: true });
  if (await pause.isVisible()) await pause.click();

  // Turn to lesson 2 again: boundary, stage and ghosts as left. Then reset clears it.
  await bar(page)
    .getByRole("button", { name: `Turn to ${L2}` })
    .click();
  await expect(plates(page)).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(plates(page)).toHaveAttribute("data-boundary", "transform");
  await expect(plates(page)).toHaveAttribute("data-stage", "1");
  await expect(plates(page)).toHaveAttribute("data-ghosts", "convergent,divergent");
  await page.locator(".gs-reset").click();
  await expect(plates(page)).toHaveAttribute("data-boundary", "none");
  await expect(plates(page)).toHaveAttribute("data-ghosts", "");
  await expect(plates(page)).toHaveAttribute("data-viewed", "");

  // Lesson 2's reset never touched lesson 1.
  await bar(page)
    .getByRole("button", { name: `Turn to ${L1}` })
    .click();
  await expect(desk(page)).toHaveAttribute("data-source", "live", { timeout: 60_000 });
  await expect(desk(page)).toHaveAttribute("data-run-id", run!);
  await expect(desk(page)).toHaveAttribute("data-ghost", "shale");
  expect(errors).toEqual([]);
});

test("navigation while lesson 1 is running: keyboard turns, rapid turns and history never lose its run", async ({
  page,
}) => {
  const errors = await openLessonOne(page);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => years(page), { timeout: 120_000 }).toBeGreaterThan(0);
  const run = await desk(page).getAttribute("data-run-id");
  // PageDown on the page (not in a control) turns.
  await page.locator(".gs-page-text h1").focus();
  await page.keyboard.press("PageDown");
  await expect(plates(page)).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  // A turn and a history step at once coalesce to the last destination (both lesson 1 here).
  await bar(page)
    .getByRole("button", { name: `Turn to ${L1}` })
    .click();
  await page.goBack();
  await expect(bar(page).locator(".reader-position")).toHaveText(new RegExp(`1\\s*${L1}`), {
    timeout: 60_000,
  });
  await expect(desk(page)).toHaveAttribute("data-source", "live", { timeout: 60_000 });
  await expect(desk(page)).toHaveAttribute("data-run-id", run!);
  expect(await years(page)).toBeGreaterThan(0);
  await expect(page.locator(".gs-desk")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("phone: one readable page per lesson, the bar turns between them, no horizontal scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openLessonOne(page);
  await expect(desk(page)).toHaveAttribute("data-stage-mode", "flat");
  await page.getByRole("button", { name: `Turn to ${L2}` }).click();
  await expect(plates(page)).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(plates(page)).toHaveAttribute("data-stage-mode", "flat");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator(".ps-choice[data-boundary=divergent]").click();
  await expect(plates(page)).toHaveAttribute("data-boundary", "divergent");
  await bar(page).getByRole("button", { name: "University level" }).click();
  await page.evaluate(
    () => ((document.querySelector(".ps-desk .gs-flap") as HTMLDetailsElement).open = true),
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // The flat page flows: the lesson column never scrolls on its own.
  expect(
    await page
      .locator(".ps-text-column")
      .evaluate((c) => c.scrollHeight <= c.clientHeight + 1 && getComputedStyle(c).overflowY !== "auto"),
  ).toBe(true);
  await page.getByRole("button", { name: `Turn to ${L1}` }).click();
  await expect(desk(page)).toHaveAttribute("data-source", "live", { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test("reduced motion: the turn and both lessons run without animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await openLessonOne(page);
  await page.getByRole("button", { name: `Turn to ${L2}` }).click();
  await expect(plates(page)).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(plates(page)).toHaveAttribute("data-stage-mode", "flat");
  await expect(plates(page)).toHaveAttribute("data-reduced-motion", "true");
  expect(
    await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length),
  ).toBe(0);
  await page.locator(".ps-choice[data-boundary=convergent]").click();
  await expect(page.locator("#ps-stage")).toHaveAttribute("step", "0.25");
  await page.getByRole("button", { name: `Turn to ${L1}` }).click();
  await expect(desk(page)).toHaveAttribute("data-source", "live", { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test("the left page fits the tilted book at university level with the flap open: it scrolls, never clips", async ({
  page,
}) => {
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
  ] as const) {
    await page.setViewportSize({ width, height });
    await openLessonTwo(page);
    await expect(plates(page)).toHaveAttribute("data-stage-mode", "tilted");
    await bar(page).getByRole("button", { name: "University level" }).click();
    await page.locator(".ps-desk .gs-flap summary").click();
    await expect(page.locator(".ps-desk .gs-flap")).toHaveAttribute("open", "");
    // The stage refits the book on its next frame after the page grows (one slow frame on SwiftShader), so poll.
    const fit = () =>
      page.evaluate(() => {
        const column = document.querySelector<HTMLElement>(".ps-text-column")!;
        const spread = document.querySelector(".ps-desk .gs-spread")!.getBoundingClientRect();
        const deskBox = document.querySelector(".ps-desk")!.getBoundingClientRect();
        column.scrollTop = column.scrollHeight;
        const last = column.querySelector(".gs-deeper-triggers")!.getBoundingClientRect();
        const box = column.getBoundingClientRect();
        return {
          scrolls: column.scrollHeight > column.clientHeight,
          inDesk: spread.bottom <= deskBox.bottom + 1,
          lastVisible: last.bottom <= box.bottom + 2,
        };
      });
    await expect
      .poll(fit, { message: `${width}×${height}` })
      .toEqual({ scrolls: true, inDesk: true, lastVisible: true });
    // Focus reaches the last control of the column (keyboard readers scroll it by tabbing).
    await page.locator(".ps-desk .gs-deeper-triggers button").last().focus();
    await expect(page.locator(".ps-desk .gs-deeper-triggers button").last()).toBeInViewport();
  }
});

test("without 3D, lesson 2 says it is showing the drawing only (not recorded runs)", async ({ browser }) => {
  const noGl = await browser
    .browserType()
    .launch({ args: ["--disable-webgl", "--disable-webgl2", "--disable-gpu"] });
  const page = await noGl.newPage({ viewport: { width: 1366, height: 900 } });
  await openLessonTwo(page);
  await expect(plates(page)).toHaveAttribute("data-static", "true");
  await expect(page.locator(".reader-scene-status")).toHaveText(/^Drawing only: /);
  await expect(page.locator(".reader-scene-status")).not.toContainText("recorded runs");
  await page.locator(".ps-choice[data-boundary=convergent]").click();
  await scrub(page, 1);
  await expect(page.locator(".ps-lens svg")).toBeVisible();
  await noGl.close();
});

test("serious accessibility audit of lesson 2's spread passes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openLessonTwo(page);
  await page.locator(".ps-choice[data-boundary=convergent]").click();
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const violations = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run(): Promise<{ violations: { id: string; impact: string }[] }> };
      }
    ).axe;
    return (await axe.run()).violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id);
  });
  expect(violations).toEqual([]);
});
