/* global document, console, innerWidth */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
const require = createRequire(new URL("../../../../../uplift/book/package.json", import.meta.url));
const { chromium } = require("playwright");
const evidence = new URL("./evidence/", import.meta.url);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { browser: browser.version(), errors: [], checks: [] };
try {
  for (const width of [1366, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    page.on("pageerror", (error) => report.errors.push(error.message));
    await page.goto(process.env.LESSON_BASE_URL || "http://127.0.0.1:5186");
    await page.waitForFunction(() => document.querySelector(".book")?.dataset.stateHash);
    const layer = page.locator(".university-layer");
    const notice = page.locator(".university-hidden-parameters");
    assert.equal(await layer.isVisible(), false);
    await page.getByLabel("Reading level").selectOption("uni");
    assert.equal(await layer.isVisible(), true);
    assert.equal(await page.getByRole("slider", { name: "Erosion relaxation rate" }).isDisabled(), true);
    assert.ok((await layer.locator("polyline").getAttribute("points")).length > 20);
    assert.match(await page.locator(".university-theory").textContent(), /not K/);
    assert.ok(await page.locator(".katex math").count());
    await page.locator('input[name="prediction"]').nth(1).check();
    await page.getByRole("button", { name: "Commit prediction" }).click();
    const erosion = page.getByRole("slider", { name: "Erosion relaxation rate" });
    await page.waitForFunction(() => !document.querySelector(".university-parameters")?.disabled);
    const initialRate = await erosion.inputValue();
    await erosion.focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      (initial) => document.querySelector("#valley-university-erosionRatePerS")?.value !== initial,
      initialRate,
    );
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForFunction(() => Number(document.querySelector(".book")?.dataset.step) >= 4);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.waitForTimeout(600);
    const hash = await page.locator(".book").getAttribute("data-state-hash");
    const step = await page.locator(".book").getAttribute("data-step");
    const values = await page
      .locator(".university-budget dd")
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.value));
    assert.ok(Number(values[0]) > 0);
    assert.equal(await layer.getAttribute("data-step"), step);
    const points = await layer.locator("polyline").getAttribute("points");
    await page.getByLabel("Reading level").selectOption("hs");
    assert.equal(await notice.isVisible(), true);
    assert.equal(await layer.isVisible(), false);
    assert.match(await notice.textContent(), /Erosion relaxation rate.*s⁻¹/);
    assert.equal(await page.locator(".book").getAttribute("data-state-hash"), hash);
    await page.getByLabel("Reading level").selectOption("uni");
    assert.equal(await layer.locator("polyline").getAttribute("points"), points);
    assert.equal(await page.locator(".book").getAttribute("data-state-hash"), hash);
    await layer.screenshot({ path: fileURLToPath(new URL(`layer-${width}.png`, evidence)) });
    const ignores = page.locator(".widget-ignores");
    await ignores.locator("summary").click();
    assert.match(await ignores.textContent(), /Grain sorting/);
    await ignores.locator("summary").click();
    await page.screenshot({
      path: fileURLToPath(new URL(`university-${width}.png`, evidence)),
      fullPage: true,
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByLabel("Reading level").selectOption("hs");
    await page.getByRole("button", { name: "Reset hidden parameters to defaults" }).click();
    await page.waitForFunction(() => document.querySelector(".university-hidden-parameters")?.hidden);
    assert.equal(await page.locator(".book").getAttribute("data-step"), step);
    assert.equal(await page.locator(".book").getAttribute("data-state-hash"), hash);
    await page.getByLabel("Reading level").selectOption("uni");
    assert.equal(await erosion.inputValue(), initialRate);
    assert.deepEqual(
      await page
        .locator(".university-budget dd")
        .evaluateAll((nodes) => nodes.map((node) => node.dataset.value)),
      values,
    );
    await erosion.focus();
    await page.keyboard.press("End");
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector("#rain")?.disabled && document.querySelector(".book")?.dataset.step === "0",
    );
    await page.waitForFunction(
      (initial) => document.querySelector("#valley-university-erosionRatePerS")?.value === initial,
      initialRate,
    );
    assert.equal(await erosion.inputValue(), initialRate);
    assert.equal(await notice.isVisible(), false);
    assert.equal(await page.locator(".stamp").count(), 0);
    assert.match(await page.locator(".widget-time").textContent(), /not calibrated/);
    report.checks.push(
      `${width}px: SVG profile, live budget, KaTeX, prediction gating, keyboard parameter change, live-state preservation across levels, hidden-parameter restoration without landscape reset, full reset and no horizontal overflow`,
    );
    await page.close();
  }
  assert.deepEqual(report.errors, []);
} finally {
  await browser.close();
  await writeFile(new URL("results.json", evidence), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
