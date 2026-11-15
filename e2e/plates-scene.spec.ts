import { expect, test, type Page } from "@playwright/test";
import { fixtureOrigin } from "./helpers";

// Session 7D: lesson 2's production scene, mounted in the reader shell as 7F will mount it (a "stage"
// entry), after a stand-in for lesson 1 (e2e/fixtures/plates-scene.ts). PL1, PL2, PL4, PL6, PL7.

const url = (query = "") =>
  `${fixtureOrigin}/e2e/fixtures/plates-scene.html?start=plates${query ? `&${query}` : ""}`;
const desk = (page: Page) => page.locator(".ps-desk");
const status = (page: Page) => page.locator(".ps-scene [role=status]");

async function open(page: Page, query = "") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url(query));
  await expect(desk(page)).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  if (!query.includes("static=1"))
    await expect(desk(page)).toHaveAttribute("data-transition", "done", { timeout: 60_000 });
  return errors;
}

/** Sets the stage scrubber as a reader's drag does (input, then change on release). */
async function scrub(page: Page, stage: number) {
  await page.locator("#ps-stage").evaluate((input: HTMLInputElement, v) => {
    input.value = String(v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, stage);
}

type Targets = Record<"left" | "right", { x: number; y: number } | null>;
const targets = (page: Page) =>
  desk(page).evaluate((d) => (d as unknown as { plateArrowTargets(): Targets }).plateArrowTargets());

/** Drags a plate's arrow on the block by a screen offset (mouse, as a reader does). */
async function dragArrow(page: Page, side: "left" | "right", dx: number, dy: number) {
  await expect.poll(async () => (await targets(page))[side]).not.toBeNull();
  const p = (await targets(page))[side]!;
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let k = 1; k <= 6; k++) await page.mouse.move(p.x + (dx * k) / 6, p.y + (dy * k) / 6);
  await page.mouse.up();
}

test.describe("plates production scene (lesson 2)", () => {
  test("opens on the drawing, rises into the block, and is labelled an illustration", async ({ page }) => {
    const errors = await open(page);
    await expect(page.locator(".gs-drawing svg[role=img]")).toHaveAttribute(
      "aria-labelledby",
      /ps-fig-title/,
    );
    await expect(page.locator(".ps-label-line")).toHaveText("Illustration: shapes drawn from real examples");
    await expect(desk(page)).toHaveAttribute("data-boundary", "none");
    await expect(page.locator(".gs-scale")).toHaveText(/×4.*×0\.75/);
    // The page never speaks of runs, model time or years (guardrail).
    const words = await page.locator(".ps-scene").innerText();
    expect(words).not.toMatch(/\brun\b|model time|simulat|\byears?\b/i);
    await expect(page.locator(".ps-stage .gs-ruler-ends")).toHaveText(/early\s*late/);
    expect(errors).toEqual([]);
  });

  test("the picker (pointer and keyboard) chooses a boundary from the shared start, and the text alternative follows", async ({
    page,
  }) => {
    await open(page);
    await page.locator(".ps-choice[data-boundary=convergent]").click();
    await expect(desk(page)).toHaveAttribute("data-boundary", "convergent");
    await expect(desk(page)).toHaveAttribute("data-stage", "0");
    await expect(status(page)).toContainText("Convergent boundary, starting stage");
    // Keyboard: the radio group moves with the arrow keys and sends the same command.
    await page.locator("input[name=ps-boundary][value=convergent]").focus();
    await page.keyboard.press("ArrowRight");
    await expect(desk(page)).toHaveAttribute("data-boundary", "divergent");
    await expect(status(page)).toContainText("Divergent boundary");
  });

  test("dragging a plate's arrow on the block sends the same choose command", async ({ page }) => {
    await open(page);
    // Left plate towards the boundary (screen right) → convergent; right plate away (right) → divergent;
    // a plate along the boundary (screen up) → transform.
    await dragArrow(page, "left", 70, 0);
    await expect(desk(page)).toHaveAttribute("data-boundary", "convergent");
    await dragArrow(page, "right", 70, 0);
    await expect(desk(page)).toHaveAttribute("data-boundary", "divergent");
    await dragArrow(page, "left", 0, -70);
    await expect(desk(page)).toHaveAttribute("data-boundary", "transform");
    await expect(page.locator("input[name=ps-boundary][value=transform]")).toBeChecked();
    await expect(desk(page)).toHaveAttribute("data-viewed", "convergent,divergent,transform");
  });

  test("the plate arrows answer the arrow keys too", async ({ page }) => {
    await open(page);
    const left = page.locator(".hb-handle[data-handle=left]");
    await expect(left).toBeVisible();
    await expect(left).toHaveAccessibleName(/Left plate/);
    await expect(left).toHaveAccessibleDescription(/arrow keys/);
    await left.focus();
    await page.keyboard.press("ArrowRight");
    await expect(desk(page)).toHaveAttribute("data-boundary", "convergent");
    await page.keyboard.press("ArrowLeft");
    await expect(desk(page)).toHaveAttribute("data-boundary", "divergent");
    await page.keyboard.press("ArrowUp");
    await expect(desk(page)).toHaveAttribute("data-boundary", "transform");
  });

  test("play, pause and scrub the stage (early → late only)", async ({ page }) => {
    await open(page);
    const play = page.locator(".ps-stage .gs-play");
    await expect(play).toBeDisabled();
    await page.locator(".ps-choice[data-boundary=divergent]").click();
    await play.click();
    await expect(desk(page)).toHaveAttribute("data-playing", "true");
    await expect.poll(async () => Number(await desk(page).getAttribute("data-stage"))).toBeGreaterThan(0);
    await play.click();
    await expect(desk(page)).toHaveAttribute("data-playing", "false");
    const paused = await desk(page).getAttribute("data-stage");
    await page.waitForTimeout(500);
    await expect(desk(page)).toHaveAttribute("data-stage", paused!);
    // Keyboard scrub on the slider: End is late, Home the start.
    await page.locator("#ps-stage").focus();
    await page.keyboard.press("End");
    await expect(desk(page)).toHaveAttribute("data-stage", "1");
    await expect(page.locator("#ps-stage")).toHaveAttribute("aria-valuetext", "late stage");
    await expect(status(page)).toContainText("Divergent boundary, late stage");
    await page.keyboard.press("Home");
    await expect(desk(page)).toHaveAttribute("data-stage", "0");
    await scrub(page, 0.5);
    await expect(desk(page)).toHaveAttribute("data-stage-word", "middle");
  });

  test("boundaries already viewed appear as labelled ghost profiles at the same stage; reset clears them", async ({
    page,
  }) => {
    await open(page);
    await page.locator(".ps-choice[data-boundary=convergent]").click();
    await page.locator(".ps-choice[data-boundary=divergent]").click();
    await scrub(page, 0.75);
    await expect(desk(page)).toHaveAttribute("data-ghosts", "convergent");
    await expect(page.locator(".ps-ghost-key")).toBeVisible();
    await expect(page.locator(".ps-ghost-key [data-boundary=convergent]")).toContainText("Convergent");
    await expect(page.locator(".ps-ghost-label[data-boundary=convergent]")).toBeVisible();
    await expect(page.locator(".ps-ghost-label[data-boundary=convergent] .ps-glyph")).toHaveCount(1);
    await expect(status(page)).toContainText("dotted line on the front face is the convergent profile");
    await page.locator(".ps-choice[data-boundary=transform]").click();
    await scrub(page, 0.75);
    await expect(desk(page)).toHaveAttribute("data-ghosts", "convergent,divergent");
    await expect(page.locator(".ps-ghost-label")).toHaveCount(2);
    await page.locator(".gs-reset").click();
    await expect(desk(page)).toHaveAttribute("data-boundary", "none");
    await expect(desk(page)).toHaveAttribute("data-ghosts", "");
    await expect(desk(page)).toHaveAttribute("data-viewed", "");
    await expect(page.locator(".ps-ghost-key")).toBeHidden();
    await expect(page.locator(".ps-ghost-label")).toHaveCount(0);
  });

  test("the front face moves along the boundary by keyboard, and the camera is view-only", async ({
    page,
  }) => {
    await open(page);
    await page.locator(".ps-choice[data-boundary=convergent]").click();
    await scrub(page, 1);
    const cut = page.locator(".gs-controls input[type=range]");
    await cut.focus();
    await page.keyboard.press("Home");
    await expect(cut).toHaveAttribute("aria-valuetext", "near the back of the block");
    await expect(status(page)).toContainText("near the back of the block");
    const turn = page.getByRole("slider", { name: "Turn" });
    await turn.focus();
    await page.keyboard.press("ArrowRight");
    await expect(desk(page)).toHaveAttribute("data-boundary", "convergent");
    await expect(desk(page)).toHaveAttribute("data-stage", "1");
  });

  test("leaving pauses; returning keeps boundary, stage and ghosts; lesson one's state is untouched", async ({
    page,
  }) => {
    await open(page);
    const storage = () => page.evaluate(() => [localStorage.length, sessionStorage.length]);
    const before = await storage();
    // Lesson one's stand-in holds a reader choice.
    await page.evaluate(() =>
      (window as unknown as { shell: { navigate(t: object): Promise<boolean> } }).shell.navigate({
        spreadId: "fixture.lesson-one",
        page: "spread",
      }),
    );
    await page.locator("#lesson-one-lift").click();
    const lift = () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              lessonOne: { controller: { presentation(): { liftFraction: number } } };
            }
          ).lessonOne.controller.presentation().liftFraction,
      );
    expect(await lift()).toBe(1);
    const turnTo = (spreadId: string) =>
      page.evaluate(
        (id) =>
          (window as unknown as { shell: { navigate(t: object): Promise<boolean> } }).shell.navigate({
            spreadId: id,
            page: "spread",
          }),
        spreadId,
      );
    await turnTo("tectonics.plate-boundaries");
    await expect(desk(page)).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await page.locator(".ps-choice[data-boundary=convergent]").click();
    await page.locator(".ps-choice[data-boundary=transform]").click();
    await scrub(page, 0.6);
    await page.locator(".ps-stage .gs-play").click();
    await expect(desk(page)).toHaveAttribute("data-playing", "true");
    await turnTo("fixture.lesson-one");
    await expect(page.locator(".ps-desk")).toHaveCount(0);
    const left = await page.evaluate(() => document.title);
    expect(left).toBeTruthy();
    expect(await lift()).toBe(1);
    await turnTo("tectonics.plate-boundaries");
    await expect(desk(page)).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await expect(desk(page)).toHaveAttribute("data-boundary", "transform");
    await expect(desk(page)).toHaveAttribute("data-viewed", "convergent,transform");
    expect(Number(await desk(page).getAttribute("data-stage"))).toBeGreaterThanOrEqual(0.6);
    expect(await storage()).toEqual(before);
  });

  test("reduced motion: flat page, the stage steps through stops, nothing else changes", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "motion=reduce");
    await expect(desk(page)).toHaveAttribute("data-stage-mode", "flat");
    await expect(desk(page)).toHaveAttribute("data-reduced-motion", "true");
    await page.locator(".ps-choice[data-boundary=convergent]").click();
    await expect(page.locator("#ps-stage")).toHaveAttribute("step", "0.25");
    await page.locator(".ps-stage .gs-play").click();
    await expect
      .poll(async () => Number(await desk(page).getAttribute("data-stage")), { timeout: 10_000 })
      .toBeGreaterThan(0);
    const stage = Number(await desk(page).getAttribute("data-stage"));
    expect([0.25, 0.5, 0.75, 1]).toContain(stage);
  });

  test("static fallback: the labelled drawing and the enlarged front face follow the picker", async ({
    page,
  }) => {
    await open(page, "static=1");
    await expect(desk(page)).toHaveAttribute("data-static", "true");
    await expect(page.locator(".gs-drawing svg[role=img]")).toBeVisible();
    await expect(page.locator(".ps-lens svg")).toBeVisible();
    await page.locator(".ps-choice[data-boundary=convergent]").click();
    await scrub(page, 1);
    await expect(status(page)).toContainText("Convergent boundary, late stage");
    await expect(page.locator(".gs-drawing .plate-arrow.neutral")).toHaveCount(0);
  });

  test("phone: one readable page, no horizontal scroll, arrows still reachable", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await open(page);
    await expect(desk(page)).toHaveAttribute("data-stage-mode", "flat");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator(".ps-choice[data-boundary=divergent]").click();
    await expect(desk(page)).toHaveAttribute("data-boundary", "divergent");
    await page.close();
  });
});
