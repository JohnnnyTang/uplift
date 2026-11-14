/**
 * The actual default book (5E; first spread changed by 5M; contour lesson removed by 5M2, water lesson by 5N2):
 * the single lesson From V to U on the tilted stage, plus the research route. Screenshots go to the test output;
 * the 5E evidence under docs/review/book-revision stays as recorded.
 */
import { test, expect, type Page } from "@playwright/test";

const flap = (page: Page) => page.locator(".gs-flap");
async function glacialReady(page: Page) {
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-transition", "done", { timeout: 60_000 });
}

test.use({ video: "on" });

test("integrated recording: rock choice, flap, research departure and retained return", async ({
  page,
}, testInfo) => {
  await page.goto("/?backend=cpu-worker");
  await glacialReady(page);
  await page.screenshot({ path: testInfo.outputPath("glacial-desktop.png") });
  await page.getByRole("radio", { name: /Granite/ }).check();
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-live-rock", "granite");
  await flap(page).locator("summary").click();
  await expect(flap(page)).toHaveAttribute("open", "");
  // One-lesson book (D-W5-5N2): previous and next end the book.
  await expect(page.getByRole("button", { name: "Beginning of book" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "End of book" })).toBeDisabled();
  await page.getByRole("button", { name: "Contents" }).click();
  await page.getByRole("button", { name: "Research example", exact: true }).click();
  await expect(page.locator(".book")).toHaveAttribute("data-backend-ready", "true");
  await page.getByRole("button", { name: "Return to the book", exact: true }).click();
  await glacialReady(page);
  await expect(page.getByRole("heading", { name: "From V to U", exact: true })).toBeFocused();
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-live-rock", "granite");
  await expect(flap(page)).toHaveAttribute("open", "");
  await expect(page.locator('input[name="gs-prediction"]:checked')).toHaveCount(0);
});

for (const [lesson, spreadId, title] of [
  ["contour lesson (5M2)", "cartography.contours", "Lift a map"],
  ["water lesson (5N2)", "hydrology.water-path", "Where will the water go?"],
] as const) {
  test(`removed ${lesson}: old deep links open the book's first spread`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const page_ of ["", "&page=text", "&page=illustration", "&page=spread"]) {
      await page.goto(`/?backend=cpu-worker&spread=${spreadId}${page_}`);
      await glacialReady(page);
      await expect(page).toHaveURL(/spread=geomorph\.u-valley/);
      await expect(page.getByRole("heading", { name: "From V to U", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Contents" }).click();
      const contents = page.locator("#reader-contents");
      await expect(contents.locator(".reader-contents-link")).toHaveCount(1);
      await expect(contents).toContainText("From V to U");
      await expect(contents).not.toContainText(title);
    }
    expect(errors).toEqual([]);
  });
}

for (const [label, width, height] of [
  ["desktop-1366", 1366, 768],
  ["desktop-1440", 1440, 900],
  ["tablet", 900, 1100],
  ["phone", 390, 844],
  ["reflow-320", 320, 800],
  ["zoom-200-equivalent", 683, 384],
] as const) {
  test(`actual book composition ${label}: the lesson and its immediate answer`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/?backend=cpu-worker&spread=geomorph.u-valley`);
    await glacialReady(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await flap(page).locator("summary").click();
    await expect(flap(page).locator(".gs-flap-answer")).toBeVisible();
    await expect(page.locator(".gs-lens svg")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`glacial-${label}.png`), fullPage: true });
  });
}

test("actual keyboard reduced-motion journey and serious accessibility audit", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?backend=cpu-worker");
  await glacialReady(page);
  const summary = flap(page).locator("summary");
  // Tab from the initial heading focus to the flap; never use a mouse in this journey.
  let found = false;
  for (let i = 0; i < 40; i++) {
    if (await summary.evaluate((node) => node === document.activeElement)) {
      found = true;
      break;
    }
    await page.keyboard.press("Tab");
  }
  expect(found).toBe(true);
  await page.keyboard.press("Enter");
  await expect(flap(page)).toHaveAttribute("open", "");
  await page.getByRole("radio", { name: /Shale/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-live-rock", "sandstone");
  // One-lesson book (D-W5-5N2): PageDown and PageUp from the heading stay on the lesson.
  await page.locator("h1").focus();
  await page.keyboard.press("PageDown");
  await page.keyboard.press("PageUp");
  await expect(page.getByRole("heading", { name: "From V to U", exact: true })).toBeFocused();
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const violations = await page.evaluate(async () => {
    const axe = (
      window as unknown as { axe: { run(): Promise<{ violations: { id: string; impact: string }[] }> } }
    ).axe;
    return (await axe.run()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  });
  expect(violations).toEqual([]);
  await expect(flap(page)).toHaveAttribute("open", "");
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-live-rock", "sandstone");
  expect(
    await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length),
  ).toBe(0);
});
