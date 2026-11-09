import { test, expect } from "@playwright/test";
import data from "../hachure/terrain/src/validation/rain-comparison-data.json" with { type: "json" };
import { commit, ready, scienceGuards, unchangedAcrossLevels } from "./helpers";

for (const width of [1366, 390]) {
  test(`recorded rain: every seed/sample, fixed axes and keyboard replay at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = await ready(page);
    await commit(page);
    const replay = page.locator(".paired-replay"),
      timeline = page.getByRole("slider", { name: "Recorded model step" });
    await expect(replay).toHaveAttribute("data-playing", "false");
    await expect(page.locator(".book")).toHaveAttribute("data-step", "0");
    const axes = await page.locator(".comparison-trace path").getAttribute("d");
    const viewBox = await page.locator(".comparison-trace").getAttribute("viewBox");
    const sharedScale = await replay.getByText(/^Shared scale:/).textContent();
    for (const [pairIndex, pair] of data.pairs.entries()) {
      await page.getByLabel("Recorded landscape", { exact: true }).selectOption(String(pairIndex));
      await expect(replay).toHaveAttribute("data-seed", String(pair.seed));
      await timeline.focus();
      await page.keyboard.press("Home");
      for (const [sampleIndex, sample] of pair.samples.entries()) {
        if (sampleIndex > 0) await page.keyboard.press("ArrowRight");
        await expect(replay).toHaveAttribute("data-step", String(sample.step));
        expect(JSON.parse((await replay.getAttribute("data-values"))!)).toEqual(sample.values);
        expect(await timeline.inputValue()).toBe(String(sampleIndex));
        const bars = await page
          .locator(".comparison-bar")
          .evaluateAll((nodes) => nodes.map((n) => n.style.width));
        for (const [i, value] of sample.values.entries()) {
          expect(parseFloat(bars[i]!)).toBeCloseTo((100 * value) / data.maxValue, 4);
        }
        expect(await page.locator(".comparison-trace path").getAttribute("d")).toBe(axes);
        expect(await page.locator(".comparison-trace").getAttribute("viewBox")).toBe(viewBox);
        expect(await replay.getByText(/^Shared scale:/).textContent()).toBe(sharedScale);
        // Every SVG point must use the same data/max and time axes, with no rescaling per arm/seed.
        const traces = await page
          .locator(".comparison-trace polyline")
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("points")));
        for (const arm of [0, 1]) {
          expect(traces[arm]).toBe(
            pair.samples
              .slice(0, sampleIndex + 1)
              .map(
                (s) =>
                  `${4 + (472 * s.step) / pair.samples.at(-1)!.step},${140 - (136 * s.values[arm]!) / data.maxValue}`,
              )
              .join(" "),
          );
        }
        if (sampleIndex < pair.samples.length - 1) {
          await expect(page.locator(".comparison-feedback")).toBeEmpty();
          await expect(page.getByRole("button", { name: "Reveal explanation" })).toBeEnabled();
        }
      }
      await expect(page.locator(".comparison-feedback")).toContainText(
        "Your prediction matches this comparison",
      );
      const widths = await page
        .locator(".comparison-bar")
        .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().width));
      expect(widths[1]! - widths[0]!).toBeGreaterThanOrEqual(40);
      await unchangedAcrossLevels(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.keyboard.press("Home");
      await expect(page.locator(".comparison-feedback")).toBeEmpty();
      await page.keyboard.press("End");
      await expect(page.getByRole("button", { name: "Reveal explanation" })).toBeEnabled();
    }
    await page.getByRole("button", { name: "Reveal explanation" }).click();
    await expect(page.locator("#explanation")).toContainText("does not necessarily mean a deeper valley");
    await scienceGuards(page);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.locator(".book")).toHaveAttribute("data-step", "0");
    await expect(timeline).toBeEnabled();
    await expect(replay).toHaveAttribute("data-seed", String(data.pairs[0]!.seed));
    await expect(replay).toHaveAttribute("data-values", "[0,0]");
    await expect(page.locator(".comparison-feedback")).toBeEmpty();
    await expect(page.locator("#rain")).toBeDisabled();
    await unchangedAcrossLevels(page);
    await commit(page, 0);
    await page.getByRole("button", { name: "Show result", exact: true }).click();
    await expect(page.locator(".comparison-feedback")).toContainText(
      /You predicted: Lighter rain.*supports heavier rain/,
    );
    expect(errors).toEqual([]);
  });
}

test("normal comparison playback completes, can replay/pause and respects reduced motion", async ({
  page,
}) => {
  const errors = await ready(page);
  await commit(page);
  const replay = page.locator(".paired-replay");
  await expect(replay).toHaveAttribute("data-playing", "true");
  await expect(replay).toHaveAttribute("data-step", String(data.pairs[0]!.samples.at(-1)!.step), {
    timeout: 30_000,
  });
  await expect(replay).toHaveAttribute("data-playing", "false");
  await page.getByRole("button", { name: "Replay comparison" }).click();
  await expect(replay).toHaveAttribute("data-playing", "true");
  await expect.poll(async () => Number(await replay.getAttribute("data-step"))).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause comparison" }).click();
  const paused = await replay.getAttribute("data-values");
  await page.waitForTimeout(200);
  await expect(replay).toHaveAttribute("data-values", paused!);
  await page.getByRole("button", { name: "Play comparison", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(replay).toHaveAttribute("data-playing", "false");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(errors).toEqual([]);
});
