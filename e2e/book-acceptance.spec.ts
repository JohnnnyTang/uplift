import { test, expect } from "@playwright/test";
import { mkdirSync, copyFileSync } from "node:fs";

const evidence = "docs/review/book-revision/acceptance";
test.use({ video: "on" });

test("integrated recording: direct lift, source placement, page turn and retained return", async ({
  page,
}, testInfo) => {
  await page.goto("/?backend=cpu-worker");
  const lift = page.getByRole("slider", { name: "Lift the drawing" });
  await expect(lift).toBeEnabled();
  await page.screenshot({ path: `${evidence}/flat-desktop.png` });
  const ring = (await page.locator("[data-ring]").boundingBox())!;
  await page.mouse.move(ring.x + ring.width / 2, ring.y + ring.height / 2);
  await page.mouse.down();
  await page.mouse.move(ring.x + ring.width / 2, ring.y - 180, { steps: 12 });
  await page.mouse.up();
  await expect(lift).toHaveValue("1");
  await page.screenshot({ path: `${evidence}/raised-desktop.png` });
  await page.getByRole("button", { name: "Reveal explanation", exact: true }).click();
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
  await page.screenshot({ path: `${evidence}/water-desktop.png` });
  await page.getByRole("button", { name: "Turn to Lift a map" }).click();
  await expect(lift).toHaveValue("1");
  await expect(page.locator(".reader-answer")).toBeVisible();
  await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0);
  await testInfo.attach("scope", {
    body: "Actual default app; pointer actions and normal-motion page turns. No learner/hardware acceptance inferred.",
    contentType: "text/plain",
  });
  const video = page.video()!;
  await page.close();
  mkdirSync(evidence, { recursive: true });
  copyFileSync(await video.path(), `${evidence}/reader-journey.webm`);
});

for (const [label, width, height] of [
  ["desktop-1366", 1366, 768],
  ["desktop-1440", 1440, 900],
  ["tablet", 900, 1100],
  ["phone", 390, 844],
  ["reflow-320", 320, 800],
  ["zoom-200-equivalent", 683, 384],
] as const) {
  test(`actual book composition ${label}: both lessons and immediate answers`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const [id, name] of [
      ["cartography.contours", "contours"],
      ["hydrology.water-path", "water"],
    ]) {
      await page.goto(`/?backend=cpu-worker&spread=${id}&page=text`);
      await expect(page.getByRole("button", { name: "Reveal explanation", exact: true })).toBeVisible();
      if (width >= 1000)
        await expect(
          page.getByRole(name === "water" ? "button" : "slider", {
            name: name === "water" ? "Move spring with arrow keys" : "Lift the drawing",
          }),
        ).toBeEnabled();
      if (width >= 1000)
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `${evidence}/${name}-${label}.png`, fullPage: true });
      await page.getByRole("button", { name: "Reveal explanation", exact: true }).click();
      await expect(page.locator(".reader-answer")).toBeVisible();
      if (width < 1000)
        await page.getByRole("button", { name: "Explore the illustration", exact: true }).click();
      await expect(page.locator(".reader-scene-status")).not.toContainText("Preparing");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const legendBox = (await page.locator(".scene-legend").boundingBox())!;
      const scopeBox = (await page.locator(".reader-scope").boundingBox())!;
      expect(scopeBox.y).toBeGreaterThanOrEqual(legendBox.y + legendBox.height);
      await page.screenshot({ path: `${evidence}/${name}-${label}-illustration.png`, fullPage: true });
    }
  });
}

test("actual keyboard reduced-motion journey and serious accessibility audit", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?backend=cpu-worker");
  const reveal = page.getByRole("button", { name: "Reveal explanation", exact: true });
  // Tab from the initial scene focus; never use a mouse in this journey.
  let found = false;
  for (let i = 0; i < 35; i++) {
    if (await reveal.evaluate((node) => node === document.activeElement)) {
      found = true;
      break;
    }
    await page.keyboard.press("Tab");
  }
  expect(found).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page.locator(".reader-answer")).toBeVisible();
  const lift = page.getByRole("slider", { name: "Lift the drawing" });
  await lift.focus();
  await page.keyboard.press("End");
  await expect(lift).toHaveValue("1");
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
  await expect(lift).toHaveValue("1");
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});
