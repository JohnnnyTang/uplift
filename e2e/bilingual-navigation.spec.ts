import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 180_000 });

async function ready(page: Page) {
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.keyboard.press("Escape");
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-transition", "done", { timeout: 30_000 });
}

async function chooseLanguage(page: Page, locale: "en" | "zh-CN") {
  await page.locator("#reader-language").selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

test("localized branding preserves the desktop book size and clears the camera controls", async ({
  page,
}) => {
  for (const lesson of ["", "&spread=tectonics.plate-boundaries&page=spread"]) {
    await page.goto(`/?glacier=cpu${lesson}`);
    await ready(page);
    for (const [width, height] of [
      [1366, 768],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      for (const locale of ["en", "zh-CN"] as const) {
        await chooseLanguage(page, locale);
        await expect
          .poll(
            () =>
              page.evaluate(() => {
                const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
                const controls = r(".gs-view-controls");
                const slogan = r(".reader-brand-slogan");
                const book = r(".gs-spread");
                return (
                  book.width > (innerWidth === 1366 ? 850 : 1050) &&
                  slogan.top >= controls.bottom &&
                  slogan.bottom <= book.top &&
                  r(".reader-brand-name").right < controls.left &&
                  document.documentElement.scrollHeight <= innerHeight
                );
              }),
            { message: `${lesson || "glacier"}, ${width}×${height}, ${locale}` },
          )
          .toBe(true);
      }
    }
  }
});

test("Chinese navigation retains both lessons and changing language keeps the mounted scene", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?glacier=cpu");
  await ready(page);
  await expect(page.locator(".reader-brand-name")).toHaveText("Uplift");
  await expect(page.locator(".reader-brand-slogan")).toHaveText("Turn a page. Watch a landscape grow.");
  await page.getByRole("radio", { name: /Shale/ }).check();
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-live-rock", "shale");
  const glacier = await page.locator(".gs-desk").evaluate((desk) => ({
    run: (desk as HTMLElement).dataset.runId,
    time: (desk as HTMLElement).dataset.modelYears,
    rock: (desk as HTMLElement).dataset.liveRock,
  }));
  const canvas = await page.locator(".gs-desk canvas").first().elementHandle();
  await chooseLanguage(page, "zh-CN");
  await expect(page).toHaveTitle("一页山河");
  await expect(page.locator(".reader-brand-name")).toHaveText("一页山河");
  await expect(page.locator(".reader-brand-slogan")).toHaveText("翻开一页，看山河生长。");
  await expect(page.locator(".gs-page-text h1")).toContainText(/[\u3400-\u9fff]/);
  expect(await canvas!.evaluate((node) => node.isConnected)).toBe(true);
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-run-id", glacier.run!);
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-model-years", glacier.time!);
  await page.locator(".reader-bar-next").click();
  await expect(page.locator(".ps-desk")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-turning", "false");
  await ready(page);
  await expect(page.locator(".ps-label-line")).toContainText(/[\u3400-\u9fff]/);
  await page.locator('input[name="ps-boundary"][value="convergent"]').check();
  await page.locator("#ps-stage").evaluate((input: HTMLInputElement) => {
    input.value = "0.4";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator(".ps-desk")).toHaveAttribute("data-stage", "0.4");
  const stage = await page.locator(".ps-desk").getAttribute("data-stage");
  const platesCanvas = await page.locator(".ps-desk canvas").first().elementHandle();
  await chooseLanguage(page, "en");
  await expect(page).toHaveTitle("Uplift");
  await expect(page.locator(".reader-brand-name")).toHaveText("Uplift");
  await expect(page.locator(".reader-brand-slogan")).toHaveText("Turn a page. Watch a landscape grow.");
  expect(await platesCanvas!.evaluate((node) => node.isConnected)).toBe(true);
  await expect(page.locator(".ps-desk")).toHaveAttribute("data-stage", stage!);
  await chooseLanguage(page, "zh-CN");
  await page.locator(".reader-bar-previous").click();
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-turning", "false");
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-run-id", glacier.run!);
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-model-years", glacier.time!);
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-live-rock", glacier.rock!);
  await page.locator(".reader-bar-next").click();
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-turning", "false");
  await expect(page.locator(".ps-desk")).toHaveAttribute("data-stage", stage!);
  expect(errors).toEqual([]);
});

test("Chinese preference survives reload and the reduced-motion phone book reflows", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?spread=tectonics.plate-boundaries&page=spread");
  await ready(page);
  await chooseLanguage(page, "zh-CN");
  await page.reload();
  await ready(page);
  await expect(page.locator("#reader-language")).toHaveValue("zh-CN");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const menu = await page.locator("#reader-language").boundingBox();
    expect(menu!.x).toBeGreaterThanOrEqual(0);
    expect(menu!.x + menu!.width).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".reader-bar-previous").click();
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-turning", "false");
  await expect(page.locator(".gs-page-text h1")).toContainText(/[\u3400-\u9fff]/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const menu = await page.locator("#reader-language").boundingBox();
    expect(menu!.x).toBeGreaterThanOrEqual(0);
    expect(menu!.x + menu!.width).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length),
  ).toBe(0);
});
