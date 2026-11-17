import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 180_000 });

test("settles to ink, turns one sheet in both directions, then restores the live page and focus", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("/?glacier=cpu");
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  await page.keyboard.press("Escape");
  for (const direction of ["next", "previous"] as const) {
    const before = await page.locator(".gs-book").boundingBox();
    const viewport = await page.evaluateHandle(() => {
      const samples: { width: number; height: number; scrollWidth: number; scrollHeight: number }[] = [];
      let frame = 0;
      const sample = () => {
        const root = document.documentElement;
        samples.push({
          width: root.clientWidth,
          height: root.clientHeight,
          scrollWidth: root.scrollWidth,
          scrollHeight: root.scrollHeight,
        });
        frame = requestAnimationFrame(sample);
      };
      sample();
      return { samples, stop: () => cancelAnimationFrame(frame) };
    });
    await page.locator(".reader-bar-" + direction).click();
    const snapshot = page.locator(".reader-turn-snapshot");
    const leaf = page.locator(".reader-turn-leaf");
    await expect(leaf).toHaveAttribute("data-direction", direction, { timeout: 90_000 });
    await leaf.evaluate((element) => {
      const animation = element.getAnimations()[0]!;
      animation.pause();
      animation.currentTime = 420;
    });
    await expect(snapshot).toHaveAttribute("aria-hidden", "true");
    expect(await snapshot.evaluate((element) => element instanceof HTMLElement && element.inert)).toBe(true);
    await expect(snapshot.locator("canvas")).toHaveCount(0);
    await expect(snapshot.locator(".gs-desk")).toHaveAttribute("data-transition", "flat");
    await expect(page.locator(".reader-book > .reader-stage .gs-desk")).toHaveAttribute(
      "data-transition",
      "flat",
    );
    const during = await snapshot.locator(".gs-book").boundingBox();
    for (const key of ["x", "y", "width", "height"] as const)
      expect(Math.abs(during![key] - before![key])).toBeLessThan(1);
    await expect(snapshot.locator(".reader-turn-back")).toContainText(
      direction === "next" ? "Where plates meet" : "Fig. 1",
    );
    const duplicateIds = await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    expect(duplicateIds).toEqual([]);
    await page.screenshot({ path: info.outputPath(direction + "-leaf.png") });
    await leaf.evaluate((element) => element.getAnimations()[0]!.finish());
    await expect(snapshot).toHaveCount(0);
    await expect(page.locator(".reader-shell")).toHaveAttribute("data-turning", "false");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: direction === "next" ? "Where plates meet" : "From V to U",
      }),
    ).toBeFocused();
    const viewportSamples = await viewport.evaluate((state) => {
      state.stop();
      return state.samples;
    });
    await viewport.dispose();
    expect(viewportSamples.length).toBeGreaterThan(2);
    for (const sample of viewportSamples) expect(sample).toEqual(viewportSamples[0]);
    await expect(page.locator(".reader-book")).not.toHaveClass(/reader-book-turning/);
    await page.keyboard.press("Escape");
  }
  expect(errors).toEqual([]);
});

test("switching to reduced motion during departure finishes navigation without a stranded overlay", async ({
  page,
}) => {
  await page.goto("/?glacier=cpu");
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  await page.keyboard.press("Escape");
  await page.locator(".reader-bar-next").click();
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-turning", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-turning", "false", { timeout: 90_000 });
  await expect(page.locator(".reader-turn-snapshot")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Where plates meet", level: 1 })).toBeFocused();
});

test("browser Back during the sheet animation returns to the previous lesson without leaving the book", async ({
  page,
}) => {
  await page.goto("/?glacier=cpu");
  await expect(page.locator(".gs-desk")).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  await page.keyboard.press("Escape");
  const run = await page.locator(".gs-desk").getAttribute("data-run-id");
  await page.locator(".reader-bar-next").click();
  const leaf = page.locator(".reader-turn-leaf");
  await expect(leaf).toBeVisible({ timeout: 90_000 });
  await leaf.evaluate((element) => element.getAnimations()[0]!.pause());
  await expect(page).toHaveURL(/spread=tectonics\.plate-boundaries/);
  await page.goBack();
  await expect(page).toHaveURL(/spread=geomorph\.u-valley/);
  await leaf.evaluate((element) => element.getAnimations()[0]!.finish());
  await expect(page.getByRole("heading", { name: "From V to U", level: 1 })).toBeFocused();
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-turning", "false");
  await expect(page.locator(".reader-book > .reader-stage .gs-desk")).toHaveAttribute("data-run-id", run!);
  await expect(page.locator(".reader-turn-snapshot")).toHaveCount(0);
});
