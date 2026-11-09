import process from "node:process";
import { expect, type Page } from "@playwright/test";
import data from "../hachure/terrain/src/validation/rain-comparison-data.json" with { type: "json" };

export const appOrigin = `http://127.0.0.1:${process.env.UPLIFT_E2E_PORT ?? "4173"}`;
export const fixtureOrigin = `http://127.0.0.1:${process.env.UPLIFT_FIXTURE_PORT ?? "4174"}`;

export async function ready(page: Page, url = "/") {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const target = new URL(url, appOrigin);
  target.searchParams.set("view", "research");
  if (!target.searchParams.has("backend")) target.searchParams.set("backend", "cpu-worker");
  await page.goto(target.href);
  await expect(page.locator(".book")).toHaveAttribute("data-state-hash", /.+/);
  await expect(page.locator('input[name="prediction"]').first()).toBeEnabled();
  return errors;
}

export async function commit(page: Page, index = data.answer) {
  // The keyboard alone selects and commits the prediction.
  await page.locator('input[name="prediction"]').nth(index).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  const lift = page.getByRole("button", { name: "Lift the drawing", exact: true });
  if (await lift.isEnabled()) await lift.click();
  if ((await page.locator(".book").getAttribute("data-backend")) !== "flat")
    await expect(page.locator("#rain")).toBeEnabled();
  const play = page.getByRole("button", { name: "Play comparison", exact: true });
  if (
    (await play.isVisible()) &&
    !(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches))
  )
    await play.click();
}

export async function scienceGuards(page: Page) {
  await expect(page.locator(".widget-time")).toContainText(/not calibrated/);
  await expect(page.locator(".widget-time")).not.toContainText(/\d[\d,.]*\s*(years|yr)\b/);
  await expect(page.locator(".challenge-status")).toContainText(/not yet available/);
  await expect(page.locator(".stamp, [data-stamp], [data-stamp-id]")).toHaveCount(0);
}

export async function unchangedAcrossLevels(page: Page) {
  const book = page.locator(".book"),
    replay = page.locator(".paired-replay");
  const before = await book.getAttribute("data-state-hash");
  const liveStep = await book.getAttribute("data-step");
  const recorded = await replay.evaluate((node) => ({ ...node.dataset }));
  const timeline = await page.locator("#rain-comparison-timeline").inputValue();
  for (const level of ["uni", "hs"]) {
    await page.getByLabel("Reading level").selectOption(level);
    await expect(book).toHaveAttribute("data-state-hash", before!);
    await expect(book).toHaveAttribute("data-step", liveStep!);
    expect(await replay.evaluate((node) => ({ ...node.dataset }))).toEqual(recorded);
    await expect(page.locator("#rain-comparison-timeline")).toHaveValue(timeline);
    await scienceGuards(page);
  }
}
