import { test, expect } from "@playwright/test";
import { fixtureOrigin, commit, ready, scienceGuards, unchangedAcrossLevels } from "./helpers";

test("unscored questions and pending science survive commit, endpoint, reset and levels", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await ready(page, `${fixtureOrigin}/e2e/fixtures/science.html`);
  await expect(page.locator(".widget-predict")).toContainText("No option is marked correct");
  await scienceGuards(page);
  await commit(page, 0);
  await page.getByRole("button", { name: "Show result", exact: true }).click();
  await expect(page.locator(".widget-predict")).toContainText("No option is marked correct");
  await expect(page.locator(".comparison-feedback")).toBeEmpty();
  await expect(page.locator(".widget-predict")).not.toContainText(
    /Your prediction matches|supports heavier rain/,
  );
  await unchangedAcrossLevels(page);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".book")).toHaveAttribute("data-step", "0");
  await expect(page.locator("#rain")).toBeDisabled();
  await expect(page.locator(".widget-predict")).toContainText("No option is marked correct");
  await expect(page.locator(".comparison-feedback")).toBeEmpty();
  await unchangedAcrossLevels(page);
  await commit(page, 1);
  await page.getByRole("button", { name: "Show result", exact: true }).click();
  await expect(page.locator(".comparison-feedback")).toBeEmpty();
  await scienceGuards(page);
  expect(errors).toEqual([]);
});
