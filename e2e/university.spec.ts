import { test, expect } from "@playwright/test";
import { ready, commit } from "./helpers";

test("university parameters restore without resetting state and reset with the lesson", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await ready(page);
  await page.getByLabel("Reading level").selectOption("uni");
  const rate = page.getByRole("slider", { name: "Erosion relaxation rate" });
  await expect(rate).toBeDisabled();
  const initial = await rate.inputValue();
  await commit(page);
  await rate.focus();
  await page.keyboard.press("ArrowRight");
  await expect(rate).not.toHaveValue(initial);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(async () => Number(await page.locator(".book").getAttribute("data-step")))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect
    .poll(async () => {
      const hash = await page.locator(".book").getAttribute("data-state-hash");
      await page.waitForTimeout(200);
      return hash === (await page.locator(".book").getAttribute("data-state-hash"));
    })
    .toBe(true);
  const hash = await page.locator(".book").getAttribute("data-state-hash");
  await page.getByLabel("Reading level").selectOption("hs");
  await expect(page.locator(".university-hidden-parameters")).toBeVisible();
  await page.getByRole("button", { name: "Reset hidden parameters to defaults" }).click();
  await expect(page.locator(".university-hidden-parameters")).toBeHidden();
  await expect(page.locator(".book")).toHaveAttribute("data-state-hash", hash!);
  await page.getByLabel("Reading level").selectOption("uni");
  await expect(rate).toHaveValue(initial);
  await rate.focus();
  await page.keyboard.press("ArrowRight");
  await expect(rate).not.toHaveValue(initial);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(rate).toHaveValue(initial);
  await expect(rate).toBeDisabled();
  expect(errors).toEqual([]);
});

test("flat fallback keeps university parameters read-only through commitment and reset", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await ready(page, "/?backend=flat");
  await page.getByLabel("Reading level").selectOption("uni");
  await page.locator('input[name="prediction"]').first().check();
  await page.getByRole("button", { name: "Commit prediction" }).click();
  await expect(page.getByRole("slider", { name: "Erosion relaxation rate" })).toBeDisabled();
  await expect(page.locator(".university-profile")).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator('input[name="prediction"]').first()).toBeEnabled();
  await expect(page.getByRole("slider", { name: "Erosion relaxation rate" })).toBeDisabled();
  expect(errors).toEqual([]);
});
