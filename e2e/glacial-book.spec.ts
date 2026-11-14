/**
 * Session 5M: the default book opens on "From V to U" in the tilted book stage, joined to the live glacier
 * runtime (5J), the production scene (5K) and the lesson (5L). This walks the whole reader journey on the
 * default route: open → transition → pick rock (page selector and specimen drop) → play → scrub back → return
 * to live → slide the cut → see under the ice → second rock → compare at matched model time → change level
 * (the model must not reset) → turn the page and back while running → reset. Phone, reduced motion and
 * navigation while running are covered too.
 *
 * The backend is whatever auto selection picks (WebGPU where it passes the device check, else the labelled
 * CPU). Playwright's bundled Chromium has no WebGPU adapter, so CI runs the CPU path.
 */
import { type Page, expect, test } from "@playwright/test";

test.describe.configure({ timeout: 180_000 });

interface Geometry {
  outline: { x: number; y: number }[];
}

const desk = (page: Page) => page.locator(".gs-desk");
const years = async (page: Page) => Number(await desk(page).getAttribute("data-model-years"));

async function openBook(page: Page, query = "") {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`/${query}`);
  await expect(desk(page)).toHaveAttribute("data-source", "live", { timeout: 60_000 });
  await expect(desk(page)).toHaveAttribute("data-transition", "done", { timeout: 30_000 });
  return errors;
}

/** Plays until the shown model time reaches `atLeast`, then pauses and waits for the settled frame. */
async function playUntil(page: Page, atLeast: number) {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(desk(page)).toHaveAttribute("data-playing", "true");
  await expect.poll(() => years(page), { timeout: 120_000 }).toBeGreaterThanOrEqual(atLeast);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(desk(page)).toHaveAttribute("data-playing", "false");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeEnabled();
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

test("the default book opens on From V to U in the tilted stage, with the quiet bottom bar", async ({
  page,
}) => {
  const errors = await openBook(page);
  await expect(page.getByRole("heading", { level: 1, name: "From V to U" })).toBeVisible();
  await expect(desk(page)).toHaveAttribute("data-stage-mode", "tilted");
  await expect(page.locator(".gs-desk canvas")).toBeVisible();
  // Chrome: contents, previous, the lesson number and title, next, contrast, reading level. No top select.
  const bar = page.getByRole("navigation", { name: "Book pages" });
  await expect(bar.getByRole("button", { name: "Contents" })).toBeVisible();
  await expect(bar.locator(".reader-position")).toHaveText(/1\s*From V to U/);
  await expect(bar.getByRole("button", { name: "Beginning of book" })).toBeDisabled();
  await expect(bar.getByRole("button", { name: "Turn to Where will the water go?" })).toBeEnabled();
  await expect(bar.getByRole("button", { name: "More contrast" })).toBeVisible();
  await expect(bar.getByRole("button", { name: "University level" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator("header select, .reader-header")).toHaveCount(0);
  // Running heads and folios on both pages; one limitation line.
  await expect(page.locator(".gs-page-text .gs-running-head")).toHaveText("Lesson 1 · Glaciers");
  await expect(page.locator(".gs-page-text .gs-folio")).toHaveText("1");
  await expect(page.locator(".gs-page-figure .gs-folio")).toHaveText("2");
  await expect(page.getByText("Simplified model; time is compressed.", { exact: false })).toHaveCount(1);
  // The live run starts at the authored start: model time 0, labelled from the runtime.
  await expect(desk(page)).toHaveAttribute("data-model-years", "0");
  await expect(page.locator(".gs-time-now")).toHaveText("model time 0 model years");
  await expect(page.locator(".gs-margin")).toContainText("0 model years in sandstone");
  // Contents lists both lessons and the research route.
  await bar.getByRole("button", { name: "Contents" }).click();
  await expect(page.locator(".reader-contents")).toContainText("From V to U");
  await expect(page.locator(".reader-contents")).toContainText("Where will the water go?");
  await expect(page.getByRole("button", { name: "Research example" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".reader-contents")).toBeHidden();
  await expect(bar.getByRole("button", { name: "Contents" })).toBeFocused();
  expect(errors).toEqual([]);
});

test("the full journey on the live runtime, with the model never reset by view or level", async ({
  page,
}) => {
  const errors = await openBook(page);

  // The live run opens paused at model time 0 on the authored V, and the page invites Play (D-W5-5M2).
  await expect(desk(page)).toHaveAttribute("data-model-years", "0");
  await expect(desk(page)).toHaveAttribute("data-playing", "false");
  const invite = page.locator(".gs-play-invite");
  await expect(invite).toBeVisible();
  await expect(invite).toContainText("Press Play");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveAccessibleDescription(
    /Press Play/,
  );

  // Pick a rock on the page (before any advance it just sets the rock: no kept run).
  await page.getByRole("radio", { name: /Shale/ }).check();
  await expect(desk(page)).toHaveAttribute("data-live-rock", "shale");
  await expect(desk(page)).toHaveAttribute("data-ghost", "");

  // Play, then pause.
  await playUntil(page, 40);
  await expect(invite).toBeHidden();
  const firstRun = await desk(page).getAttribute("data-run-id");
  await expect(page.locator(".gs-margin")).toContainText("in shale");
  await expect(page.locator(".gs-margin")).toContainText("floor lowered");

  // Scrub back: a recorded earlier moment, labelled as earlier.
  const time = page.getByRole("slider", { name: "Recorded time" });
  await time.focus();
  await page.keyboard.press("Home");
  await expect(desk(page)).toHaveAttribute("data-view", "past");
  await expect(page.locator(".gs-time-now")).toContainText("Earlier moment");
  await expect(page.locator(".gs-margin")).toContainText("an earlier moment of this run");
  await page.keyboard.press("ArrowRight");
  await expect(desk(page)).toHaveAttribute("data-model-years", "20");

  // Return to live.
  await page.getByRole("button", { name: "Back to the latest moment" }).click();
  await expect(desk(page)).toHaveAttribute("data-view", "live");
  expect(await years(page)).toBeGreaterThanOrEqual(40);

  // Slide the cut (keyboard twin of dragging the front face): one grid cell per arrow.
  const cut = page.getByRole("slider", { name: "Front face" });
  await expect(desk(page)).toHaveAttribute("data-cut-column", "51");
  await cut.focus();
  await page.keyboard.press("ArrowRight");
  await expect(desk(page)).toHaveAttribute("data-cut-column", "50");
  await page.keyboard.press("ArrowLeft");
  await expect(desk(page)).toHaveAttribute("data-cut-column", "51");

  // See under the ice (view-only).
  const ice = page.getByLabel("See under the ice");
  await expect(ice).toBeEnabled();
  const notesBefore = await page.locator(".gs-margin").innerText();
  await ice.check();
  await expect(page.locator(".gs-sr")).toContainText("ice is hidden");
  expect(await page.locator(".gs-margin").innerText()).toBe(notesBefore);
  await ice.uncheck();

  // A second rock, dropped on the block as a specimen: a new run from the start; shale is kept and compared.
  await dropSpecimen(page, "granite");
  await expect(desk(page)).toHaveAttribute("data-live-rock", "granite");
  await expect(desk(page)).toHaveAttribute("data-ghost", "shale");
  await expect(desk(page)).not.toHaveAttribute("data-run-id", firstRun!);
  await expect(page.getByRole("radio", { name: /Granite/ })).toBeChecked();
  await playUntil(page, 40);

  // Compare at matched model time: scrub to a recorded time; the ghost is the kept run at that same time.
  await time.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(desk(page)).toHaveAttribute("data-model-years", "40");
  const compareNote = page.locator('.gs-margin [data-note="compare"]');
  await expect(compareNote).toContainText("a separate run with another rock, shale, at 40 model years");
  await expect(page.locator(".gs-lens .lens-ghost")).toHaveCount(1);
  await expect(page.locator(".gs-sr")).toContainText("separate run with another rock, shale");
  await page.getByRole("button", { name: "Back to the latest moment" }).click();

  // Change level: words, controls and overlays change; the run, its time and the kept run do not.
  const run = await desk(page).getAttribute("data-run-id");
  const at = await years(page);
  await page.getByRole("button", { name: "University level" }).click();
  await expect(page.getByRole("button", { name: "University level" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".gs-margin")).toContainText("shape b =");
  await expect(page.getByRole("button", { name: "Step", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Read deeper level ↗" })).toBeVisible();
  await expect(desk(page)).toHaveAttribute("data-run-id", run!);
  expect(await years(page)).toBe(at);
  await expect(desk(page)).toHaveAttribute("data-ghost", "shale");
  // The deeper level opens in the upright reading panel, with bound parameters and run graphs.
  await page.getByRole("button", { name: "Read deeper level ↗" }).click();
  const panel = page.locator(".gs-reading-panel");
  await expect(panel).toContainText("Solver:");
  await expect(panel.locator(".gs-graph svg")).toHaveCount(4);
  await expect(panel.locator(".katex").first()).toBeVisible();
  await panel.getByRole("button", { name: "Back to the book" }).click();
  await page.getByRole("button", { name: "University level" }).click();
  await expect(desk(page)).toHaveAttribute("data-run-id", run!);

  // Turn the page while running, and back: the runs are kept, nothing advanced while away, play resumes.
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(desk(page)).toHaveAttribute("data-playing", "true");
  await page.getByRole("button", { name: "Turn to Where will the water go?" }).click();
  await expect(page.getByRole("heading", { name: "Where will the water go?", exact: true })).toBeVisible();
  await expect(page.locator(".reader-position")).toHaveText(/2\s*Where will the water go\?/);
  await page.getByRole("button", { name: "Turn to From V to U" }).click();
  await expect(desk(page)).toHaveAttribute("data-source", "live", { timeout: 60_000 });
  await expect(desk(page)).toHaveAttribute("data-run-id", run!);
  await expect(desk(page)).toHaveAttribute("data-live-rock", "granite");
  await expect(desk(page)).toHaveAttribute("data-ghost", "shale");
  await expect(desk(page)).toHaveAttribute("data-playing", "true");
  expect(await years(page)).toBeGreaterThanOrEqual(at);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(desk(page)).toHaveAttribute("data-playing", "false");

  // Reset needs an inline confirm while kept runs exist; it returns to the authored defaults.
  await page.getByRole("button", { name: "Start again" }).click();
  await expect(page.locator(".gs-confirm")).toContainText("kept run");
  await page.getByRole("button", { name: "Remove them and start again" }).click();
  await expect(desk(page)).toHaveAttribute("data-model-years", "0");
  await expect(desk(page)).toHaveAttribute("data-live-rock", "sandstone");
  await expect(desk(page)).toHaveAttribute("data-ghost", "");
  await expect(page.getByRole("button", { name: "Start again" })).toBeFocused();
  expect(errors).toEqual([]);
});

test("phone: flat page, rock choice and play work, no horizontal scroll, the bar turns to the water lesson", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openBook(page);
  await expect(desk(page)).toHaveAttribute("data-stage-mode", "flat");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("radio", { name: /Granite/ }).check();
  await expect(desk(page)).toHaveAttribute("data-live-rock", "granite");
  await playUntil(page, 20);
  await expect(page.locator(".gs-lens svg")).toBeVisible();
  await expect(page.locator(".reader-bar")).toBeVisible();
  await page.getByRole("button", { name: /(Turn to|Read) Where will the water go?/ }).click();
  await expect(page.getByRole("heading", { name: "Where will the water go?", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: /Turn to From V to U|Read From V to U/ }).click();
  await expect(desk(page)).toHaveAttribute("data-live-rock", "granite", { timeout: 60_000 });
  expect(await years(page)).toBeGreaterThanOrEqual(20);
  expect(errors).toEqual([]);
});

test("reduced motion: flat page, no running animations, the figure still describes its profile", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await openBook(page);
  await expect(desk(page)).toHaveAttribute("data-stage-mode", "flat");
  await expect(page.locator(".gs-sr")).toContainText("front face of the block");
  await page.getByRole("radio", { name: /Shale/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(desk(page)).toHaveAttribute("data-live-rock", "sandstone");
  expect(
    await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length),
  ).toBe(0);
  // Contrast is a book setting, not a model change.
  await page.getByRole("button", { name: "More contrast" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "more");
  await expect(desk(page)).toHaveAttribute("data-model-years", "0");
  expect(errors).toEqual([]);
});

test("serious accessibility audit of the opening spread passes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openBook(page);
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const violations = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run(): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> };
      }
    ).axe;
    return (await axe.run()).violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id);
  });
  expect(violations).toEqual([]);
});
