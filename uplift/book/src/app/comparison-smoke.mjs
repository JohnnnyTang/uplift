/* global document, console, innerWidth */
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import { chromium } from "playwright";

const evidence = new URL("./evidence/rain-comparison/", import.meta.url);
const data = JSON.parse(
  await readFile(
    new URL("../../../../hachure/terrain/src/validation/rain-comparison-data.json", import.meta.url),
    "utf8",
  ),
);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { browser: browser.version(), errors: [], checks: [], measurements: [] };
const url = process.env.LESSON_BASE_URL || "http://127.0.0.1:5183";
try {
  for (const viewport of [
    { width: 1366, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", (e) => report.errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector(".book")?.dataset.stateHash);
    const replay = page.locator(".paired-replay");
    assert.equal(await page.getByRole("button", { name: "Show result", exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole("slider", { name: "Recorded model step" }).isDisabled(), true);
    await page.locator('input[name="prediction"]').nth(1).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => !document.querySelector("#rain")?.disabled);
    assert.equal(await replay.getAttribute("data-step"), "0");
    assert.equal(await replay.getAttribute("data-playing"), "false");
    assert.equal(await page.locator(".book").getAttribute("data-step"), "0");
    assert.equal(await page.getByRole("button", { name: "Reveal explanation" }).isDisabled(), true);
    for (const [i, pair] of data.pairs.entries()) {
      await page.getByLabel("Recorded landscape", { exact: true }).selectOption(String(i));
      const timeline = page.getByRole("slider", { name: "Recorded model step" });
      await timeline.focus();
      await page.keyboard.press("End");
      const last = pair.samples.at(-1);
      assert.equal(await replay.getAttribute("data-step"), String(last.step));
      assert.deepEqual(JSON.parse(await replay.getAttribute("data-values")), last.values);
      assert.match(
        await page.locator(".comparison-feedback").textContent(),
        /Your prediction matches this comparison/,
      );
      assert.match(await page.locator(".comparison-description").textContent(), /model m³/);
      const widths = await page
        .locator(".comparison-bar")
        .evaluateAll((bars) => bars.map((b) => b.getBoundingClientRect().width));
      assert.ok(widths[1] - widths[0] >= 40, "Endpoint difference must be legible in CSS pixels");
      assert.ok(
        Math.abs(widths[1] / widths[0] - last.values[1] / last.values[0]) < 0.02,
        "Bar ratio must preserve measured ratio",
      );
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const hash = await page.locator(".book").getAttribute("data-state-hash");
      const state = await replay.getAttribute("data-values");
      await page.getByLabel("Reading level").selectOption("uni");
      assert.equal(await page.locator(".book").getAttribute("data-state-hash"), hash);
      assert.equal(await replay.getAttribute("data-values"), state);
      await page.getByLabel("Reading level").selectOption("hs");
      await replay.screenshot({
        path: fileURLToPath(new URL(`comparison-${viewport.width}-seed-${pair.seed}.png`, evidence)),
      });
      report.measurements.push({
        viewport,
        seed: pair.seed,
        widths,
        endpointValues: last.values,
        ratio: last.values[1] / last.values[0],
      });
    }
    await page.getByRole("button", { name: "Reveal explanation" }).click();
    assert.match(
      await page.locator("#explanation").textContent(),
      /does not necessarily mean a deeper valley/,
    );
    assert.equal(await page.locator(".stamp").count(), 0);
    assert.match(await page.locator(".widget-time").textContent(), /not calibrated/);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector("#rain")?.disabled && document.querySelector(".book")?.dataset.step === "0",
    );
    assert.equal(await replay.getAttribute("data-step"), "0");
    assert.equal(await page.getByRole("button", { name: "Show result", exact: true }).isDisabled(), true);
    assert.equal(await page.locator(".comparison-feedback").textContent(), "");
    await page.locator('input[name="prediction"]').first().check();
    await page.getByRole("button", { name: "Commit prediction" }).click();
    await page.getByRole("button", { name: "Show result", exact: true }).click();
    assert.match(
      await page.locator(".comparison-feedback").textContent(),
      /You predicted: Lighter rain.*supports heavier rain/,
    );
    report.checks.push(
      `${viewport.width}: prediction gate, all seeds, shared scale, keyboard endpoint, level-state preservation, reduced motion, reset and incorrect-choice feedback`,
    );
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    recordVideo: { dir: fileURLToPath(evidence), size: { width: 1366, height: 900 } },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector(".book")?.dataset.stateHash);
  await page.locator('input[name="prediction"]').nth(1).check();
  const started = Date.now();
  await page.getByRole("button", { name: "Commit prediction" }).click();
  await page.locator(".paired-replay").scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () =>
      document.querySelector(".paired-replay")?.dataset.playing === "false" &&
      Number(document.querySelector(".paired-replay")?.dataset.step) > 0,
    null,
    { timeout: 30000 },
  );
  const elapsedMs = Date.now() - started;
  assert.ok(elapsedMs >= 19000 && elapsedMs < 26000);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Reveal explanation" }).click();
  await page.screenshot({ path: fileURLToPath(new URL("spread-result.png", evidence)), fullPage: true });
  await page.getByRole("button", { name: "Replay comparison" }).click();
  await page.waitForFunction(() => Number(document.querySelector(".paired-replay")?.dataset.step) > 0);
  await page.getByRole("button", { name: "Pause comparison" }).click();
  const step = await page.locator(".paired-replay").getAttribute("data-step");
  await page.waitForTimeout(400);
  assert.equal(await page.locator(".paired-replay").getAttribute("data-step"), step);
  await page.emulateMedia({ reducedMotion: "reduce" });
  report.checks.push("Normal-speed recorded playback completes; replay and pause work");
  report.measurements.push({ elapsedMs });
  const video = page.video();
  await context.close();
  await video.saveAs(fileURLToPath(new URL("comparison.webm", evidence)));
  await video.delete();
  assert.deepEqual(report.errors, []);
} finally {
  await browser.close();
  await writeFile(new URL("results.json", evidence), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
