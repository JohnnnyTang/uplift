/* global document, requestAnimationFrame, innerWidth, innerHeight, getComputedStyle, window */
import { URL } from "node:url";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";
import { chromium } from "playwright";

const evidence = new URL("./evidence/", import.meta.url);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { browser: browser.version(), layouts: [], keyboard: [], errors: [] };
const page = await browser.newPage();
page.on("pageerror", (error) => report.errors.push(error.message));
await page.goto(process.env.SHELL_BASE_URL || "http://127.0.0.1:5174");
await page.evaluate(() => document.fonts.ready);

// A real keyboard pass, including native radio-group and select semantics.
await page.keyboard.press("Tab");
assert.equal(await page.locator(":focus").textContent(), "Skip to the spread");
await page.keyboard.press("Enter");
assert.equal(await page.locator(":focus").getAttribute("id"), "reading");
await page.keyboard.press("Tab");
assert.equal(await page.locator(":focus").getAttribute("name"), "prediction");
await page.keyboard.press("Space");
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Tab");
assert.equal(await page.locator(":focus").getAttribute("id"), "commit");
await page.keyboard.press("Enter");
assert.equal(await page.locator("#inspect").isDisabled(), false);
const chosen = await page.locator('input[name="prediction"]:checked').inputValue();
report.keyboard.push("Skip link, radio arrows and commit unlock passed");

await page.locator("#level").focus();
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Tab");
assert.equal(await page.locator("#university").isVisible(), true);
assert.equal(await page.locator('input[name="prediction"]:checked').inputValue(), chosen);
assert.equal(await page.locator("#inspect").isDisabled(), false);
report.keyboard.push("Native level select preserves committed choice and unlock state");
await page.locator("#explanation > summary").focus();
await page.keyboard.press("Enter");
assert.equal(await page.locator("#explanation").getAttribute("open"), "");
await page.locator("#inspect").focus();
await page.keyboard.press("Enter");
assert.match(await page.locator("#status").textContent(), /contours are fixed/);
report.keyboard.push("Flap and inspect control work by keyboard");
await page.locator("#explanation").evaluate((el) => {
  el.open = false;
});

for (const [name, width, height] of [
  ["laptop", 1440, 900],
  ["projector", 1280, 720],
  ["tablet", 768, 1024],
  ["mobile", 390, 844],
]) {
  await page.setViewportSize({ width, height });
  for (const level of ["hs", "uni"]) {
    await page.locator("#level").selectOption(level);
    await page.evaluate(() => document.fonts.ready);
    // Wait for ResizeObserver and paint before recording the drawing.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo(0, 0);
    });
    const measurements = await page.evaluate(() => {
      const pages = [...document.querySelectorAll(".page")].map((el) => {
        const { x, y, width, height } = el.getBoundingClientRect();
        return { x, y, width, height };
      });
      const canvas = document.querySelector("canvas");
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      return {
        viewport: { width: innerWidth, height: innerHeight },
        scrollWidth: document.documentElement.scrollWidth,
        pages,
        canvasPainted: pixels.some((value) => value !== 0),
        mathml: Boolean(document.querySelector("#formula math")),
      };
    });
    assert.ok(measurements.scrollWidth <= width, name + ": horizontal overflow");
    assert.ok(measurements.canvasPainted, name + ": canvas blank");
    assert.ok(measurements.mathml, "KaTeX must include accessible MathML");
    assert.ok(measurements.pages.every((p) => p.width > 0 && p.height > 0));
    if (width > 900) assert.ok(Math.abs(measurements.pages[0].y - measurements.pages[1].y) < 2);
    else assert.ok(measurements.pages[1].y > measurements.pages[0].y);
    await page.screenshot({
      path: new URL(name + "-" + level + ".png", evidence).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
      fullPage: true,
    });
    report.layouts.push({ name, level, ...measurements });
  }
}

await page.setViewportSize({ width: 1280, height: 720 });
await page.locator("#level").selectOption("hs");
const before = await page.locator("canvas").evaluate((canvas) => canvas.toDataURL());
await page.locator("#level").selectOption("uni");
const after = await page.locator("canvas").evaluate((canvas) => canvas.toDataURL());
assert.equal(before, after, "Level must not change the drawing");
report.keyboard.push("Canvas pixels unchanged across the level toggle");

await page.emulateMedia({ reducedMotion: "reduce" });
assert.equal(await page.locator(".book").evaluate((el) => getComputedStyle(el).transform), "none");
report.reducedMotion = "No autoplay or animations; perspective removed";
await page.emulateMedia({ forcedColors: "active" });
assert.equal(await page.locator("#commit").isVisible(), true);
report.forcedColors = "Native controls remain available";
await page.emulateMedia({ forcedColors: "none" });

await writeFile(new URL("accessibility-tree.yml", evidence), await page.locator("body").ariaSnapshot());
await page.route("**/*.js", (route) => route.abort());
await page.reload();
assert.equal(await page.locator("h1").isVisible(), true);
assert.equal(await page.locator('input[name="prediction"]').count(), 3);
report.noJavaScript = "Title, question, labels and figure description remain in initial HTML";
assert.deepEqual(report.errors, []);
await writeFile(new URL("results.json", evidence), JSON.stringify(report, null, 2) + "\n");
await browser.close();
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
