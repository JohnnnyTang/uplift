/**
 * The actual default book (5E; first spread changed by 5M): From V to U on the tilted stage, then the water
 * lesson. Screenshots go to the test output; the 5E evidence under docs/review/book-revision stays as recorded.
 */
import { test, expect, type Page } from "@playwright/test";

const flap = (page: Page) => page.locator(".gs-flap");
async function glacialReady(page: Page) {
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-transition", "done", { timeout: 60_000 });
}

test.use({ video: "on" });

test("integrated recording: rock choice, flap, page turn and retained return", async ({ page }, testInfo) => {
  await page.goto("/?backend=cpu-worker");
  await glacialReady(page);
  await page.screenshot({ path: testInfo.outputPath("glacial-desktop.png") });
  await page.getByRole("radio", { name: /Granite/ }).check();
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-live-rock", "granite");
  await flap(page).locator("summary").click();
  await expect(flap(page)).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Turn to Where will the water go?" }).click();
  const spring = page.getByRole("button", { name: "Move spring with arrow keys" });
  await expect(spring).toBeEnabled();
  await page.getByRole("button", { name: "Reveal explanation", exact: true }).click();
  await expect(page.locator(".reader-answer")).toBeVisible();
  await expect(page.locator("[data-wet]")).toHaveAttribute("d", "");
  const canvas = page.locator(".playable-drawing canvas");
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 0.75, y: box.height * 0.3 } });
  await expect.poll(() => page.locator("[data-wet]").getAttribute("d")).not.toBe("");
  await page.screenshot({ path: testInfo.outputPath("water-desktop.png") });
  await page.getByRole("button", { name: "Turn to From V to U" }).click();
  await glacialReady(page);
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-live-rock", "granite");
  await expect(flap(page)).toHaveAttribute("open", "");
  await expect(page.locator('input[name="gs-prediction"]:checked')).toHaveCount(0);
});

test("removed contour lesson (5M2): old deep links open the book's first spread", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const deepLink of [
    "/?backend=cpu-worker&spread=cartography.contours",
    "/?backend=cpu-worker&spread=cartography.contours&page=illustration",
  ]) {
    await page.goto(deepLink);
    await glacialReady(page);
    await expect(page).toHaveURL(/spread=geomorph\.u-valley/);
    await page.getByRole("button", { name: "Contents" }).click();
    const contents = page.locator("#reader-contents");
    await expect(contents).toContainText("From V to U");
    await expect(contents).toContainText("Where will the water go?");
    await expect(contents).not.toContainText("Lift a map");
  }
  expect(errors).toEqual([]);
});

for (const [label, width, height] of [
  ["desktop-1366", 1366, 768],
  ["desktop-1440", 1440, 900],
  ["tablet", 900, 1100],
  ["phone", 390, 844],
  ["reflow-320", 320, 800],
  ["zoom-200-equivalent", 683, 384],
] as const) {
  test(`actual book composition ${label}: both lessons and immediate answers`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Spread 1: From V to U.
    await page.goto(`/?backend=cpu-worker&spread=geomorph.u-valley`);
    await glacialReady(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await flap(page).locator("summary").click();
    await expect(flap(page).locator(".gs-flap-answer")).toBeVisible();
    await expect(page.locator(".gs-lens svg")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`glacial-${label}.png`), fullPage: true });
    // Spread 2: the water lesson.
    await page.goto(`/?backend=cpu-worker&spread=hydrology.water-path&page=text`);
    await expect(page.getByRole("button", { name: "Reveal explanation", exact: true })).toBeVisible();
    if (width >= 1000)
      await expect(page.getByRole("button", { name: "Move spring with arrow keys" })).toBeEnabled();
    if (width >= 1000)
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`water-${label}.png`), fullPage: true });
    await page.getByRole("button", { name: "Reveal explanation", exact: true }).click();
    await expect(page.locator(".reader-answer")).toBeVisible();
    if (width < 1000)
      await page.getByRole("button", { name: "Explore the illustration", exact: true }).click();
    await expect(page.locator(".reader-scene-status")).not.toContainText("Preparing");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const legendBox = (await page.locator(".scene-legend").boundingBox())!;
    const scopeBox = (await page.locator(".reader-scope").boundingBox())!;
    expect(scopeBox.y).toBeGreaterThanOrEqual(legendBox.y + legendBox.height);
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
  await page.locator("h1").focus();
  await page.keyboard.press("PageDown");
  const spring = page.getByRole("button", { name: "Move spring with arrow keys" });
  await expect(page.getByRole("heading", { name: "Where will the water go?", exact: true })).toBeFocused();
  await expect(spring).toBeEnabled();
  let springReached = false;
  for (let i = 0; i < 25; i++) {
    if (await spring.evaluate((node) => node === document.activeElement)) {
      springReached = true;
      break;
    }
    await page.keyboard.press("Tab");
  }
  expect(springReached).toBe(true);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => page.locator("[data-wet]").getAttribute("d")).not.toBe("");
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const violations = await page.evaluate(async () => {
    const axe = (
      window as unknown as { axe: { run(): Promise<{ violations: { id: string; impact: string }[] }> } }
    ).axe;
    return (await axe.run()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  });
  expect(violations).toEqual([]);
  await page.locator("h1").focus();
  await page.keyboard.press("PageUp");
  await glacialReady(page);
  await expect(page.getByRole("heading", { name: "From V to U", exact: true })).toBeFocused();
  await expect(flap(page)).toHaveAttribute("open", "");
  expect(
    await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length),
  ).toBe(0);
});
