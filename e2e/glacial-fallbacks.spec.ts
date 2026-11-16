/**
 * Session 6B: failures on the production book, rather than the recorded-scene or runtime fixtures.
 * Startup failure keeps a labelled recorded comparison; unavailable 3D keeps a readable drawing.
 */
import { expect, test, type Page } from "@playwright/test";

const lessonOne = "From V to U";
const lessonTwo = "Where plates meet";
const desk = (page: Page) => page.locator(".gs-desk");

async function failGlacierWorker(page: Page) {
  await page.addInitScript(() => {
    const ActualWorker = window.Worker;
    window.Worker = new Proxy(ActualWorker, {
      construct(target, args) {
        // Exercise the real app's failed initialization branch without disabling other scenes or rendering.
        if (String(args[0]).includes("glacial.worker")) throw new Error("6B: glacier Worker unavailable");
        return Reflect.construct(target, args);
      },
    });
  });
}

async function revealWithKeyboard(page: Page) {
  await page.locator(".gs-flap summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".gs-flap")).toHaveAttribute("open", "");
  await expect(page.locator('input[name="gs-prediction"]:checked')).toHaveCount(0);
}

async function turnWithKeyboard(page: Page, title: string) {
  await page.getByRole("button", { name: `Turn to ${title}`, exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeFocused({ timeout: 60_000 });
}

test("default glacier startup failure shows recorded runs and preserves the comparison across levels and turns", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await failGlacierWorker(page);
  await page.goto("/?glacier=cpu");
  await expect(desk(page)).toHaveAttribute("data-source", "recorded", { timeout: 60_000 });
  await expect(desk(page)).toHaveAttribute("data-transition", "done");
  await expect(page.locator(".reader-scene-status")).toHaveText(
    /^Showing recorded runs:.*live model could not start/,
  );
  await expect(page.locator(".reader-scene-status")).toContainText("6B: glacier Worker unavailable");
  await expect(page.locator(".gs-provenance")).not.toContainText("Live run");

  // Recorded comparisons remain keyboard-operable; their labels must not imply a new live simulation.
  await page
    .locator(".gs-tray")
    .getByRole("radio", { name: /Granite/ })
    .focus();
  await page.keyboard.press("Space");
  await expect(desk(page)).toHaveAttribute("data-live-rock", "granite");
  const timeline = page.getByRole("slider", { name: "Recorded time", exact: true });
  await timeline.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect(timeline).toHaveValue("1");
  await expect(page.locator(".gs-lens svg")).toBeVisible();
  await revealWithKeyboard(page);
  const before = await desk(page).evaluate((node) => ({
    rock: node.dataset.liveRock,
    years: node.dataset.modelYears,
    ghost: node.dataset.ghost,
  }));
  expect(before.ghost).toBeTruthy();

  await page.getByRole("button", { name: "University level", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(desk(page)).toHaveAttribute("data-live-rock", before.rock!);
  await expect(desk(page)).toHaveAttribute("data-model-years", before.years!);
  await expect(desk(page)).toHaveAttribute("data-ghost", before.ghost!);
  await turnWithKeyboard(page, lessonTwo);
  await expect(page.locator(".ps-desk")).toHaveAttribute("data-ready", "true");
  await turnWithKeyboard(page, lessonOne);
  await expect(desk(page)).toHaveAttribute("data-source", "recorded");
  await expect(page.locator(".reader-scene-status")).toHaveText(/^Showing recorded runs:/);
  await expect(desk(page)).toHaveAttribute("data-live-rock", before.rock!);
  await expect(desk(page)).toHaveAttribute("data-model-years", before.years!);
  await expect(desk(page)).toHaveAttribute("data-ghost", before.ghost!);
  await expect(page.locator(".gs-flap")).toHaveAttribute("open", "");
  expect(errors).toEqual([]);
});

test("without 3D the default glacier keeps a labelled drawing, immediate reveal and keyboard page turns", async ({
  browser,
  baseURL,
}) => {
  const noGl = await browser.browserType().launch({
    args: ["--disable-webgl", "--disable-webgl2", "--disable-gpu"],
  });
  try {
    const page = await noGl.newPage({
      ...(baseURL ? { baseURL } : {}),
      reducedMotion: "reduce",
      viewport: { width: 1366, height: 900 },
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/?glacier=cpu");
    await expect(desk(page)).toHaveAttribute("data-static", "true", { timeout: 60_000 });
    await expect(page.locator(".reader-scene-status")).toHaveText(/^Drawing only:/);
    await expect(page.locator(".gs-tray-note")).toContainText("3D is not available");
    for (const radio of await page.locator(".gs-tray").getByRole("radio").all())
      await expect(radio).toBeDisabled();
    await expect(page.locator(".gs-timeline")).toBeHidden();
    await expect(page.locator(".gs-controls")).toBeHidden();
    await expect(page.locator(".gs-sr")).toContainText("Fig. 1:");
    await expect(page.locator(".gs-lens svg")).toBeVisible();
    await revealWithKeyboard(page);
    await turnWithKeyboard(page, lessonTwo);
    await expect(page.locator(".ps-desk")).toHaveAttribute("data-static", "true");
    await expect(page.locator(".reader-scene-status")).toHaveText(/^Drawing only:/);
    await turnWithKeyboard(page, lessonOne);
    await expect(desk(page)).toHaveAttribute("data-static", "true");
    await expect(page.locator(".reader-scene-status")).toHaveText(/^Drawing only:/);
    await expect(page.locator(".gs-tray-note")).toContainText("3D is not available");
    await expect(page.locator(".gs-flap")).toHaveAttribute("open", "");
    expect(errors).toEqual([]);
  } finally {
    await noGl.close();
  }
});

test("recorded fallback pauses while another lesson is open and resumes the reader's playback intent", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await failGlacierWorker(page);
  await page.goto("/?glacier=cpu");
  await expect(desk(page)).toHaveAttribute("data-source", "recorded", { timeout: 60_000 });
  await expect(desk(page)).toHaveAttribute("data-transition", "done");
  const timeline = page.getByRole("slider", { name: "Recorded time", exact: true });
  await timeline.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  const snapshotStep = Number(await desk(page).getAttribute("data-model-years"));
  expect(snapshotStep).toBeGreaterThan(0);
  const oldDesk = await desk(page).elementHandle();
  await page.getByRole("button", { name: "Play", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(desk(page)).toHaveAttribute("data-playing", "true");
  await turnWithKeyboard(page, lessonTwo);
  const leftAt = Number(await oldDesk!.getAttribute("data-model-years"));
  // More than two recorded playback ticks: hidden playback would visibly move the returning timeline.
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const target = window as unknown as { fallbackFirstReturnYears: number | null };
    target.fallbackFirstReturnYears = null;
    const observer = new MutationObserver(() => {
      const returning = document.querySelector<HTMLElement>(".gs-desk:not(.ps-desk)");
      if (returning?.dataset.modelYears) {
        target.fallbackFirstReturnYears = Number(returning.dataset.modelYears);
        observer.disconnect();
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-model-years"],
    });
  });
  await turnWithKeyboard(page, lessonOne);
  const firstReturnYears = await page.evaluate(
    () => (window as unknown as { fallbackFirstReturnYears: number | null }).fallbackFirstReturnYears,
  );
  expect(firstReturnYears).toBe(leftAt);
  await expect(desk(page)).toHaveAttribute("data-playing", "true");
  await page.getByRole("button", { name: "Pause", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(desk(page)).toHaveAttribute("data-playing", "false");
  await oldDesk!.dispose();
});

test("when live startup and recorded downloads both fail the book labels the illustration preview truthfully", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await failGlacierWorker(page);
  // Capture payload URLs are emitted as .bin assets by both Vite and the production build.
  await page.route(/\.bin(?:\?|$)/, (route) =>
    route.request().resourceType() === "fetch"
      ? route.fulfill({ status: 503, body: "6B: recorded runs unavailable" })
      : route.continue(),
  );
  await page.goto("/?glacier=cpu");
  await expect(desk(page)).toHaveAttribute("data-source", "fixture", { timeout: 60_000 });
  await expect(page.locator(".reader-scene-status")).toHaveText(/^Illustration preview only:/);
  await expect(page.locator(".reader-scene-status")).toContainText("Recorded runs could not load");
  await expect(page.locator(".reader-scene-status")).not.toContainText("Showing recorded runs");
  await expect(page.locator(".gs-provenance")).toContainText(/fixture/i);
  await revealWithKeyboard(page);
  await turnWithKeyboard(page, lessonTwo);
  await turnWithKeyboard(page, lessonOne);
  await expect(desk(page)).toHaveAttribute("data-source", "fixture");
  await expect(page.locator(".reader-scene-status")).toHaveText(/^Illustration preview only:/);
  expect(errors).toEqual([]);
});
