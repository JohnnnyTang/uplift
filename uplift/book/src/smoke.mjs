/* global document, innerWidth, innerHeight, window */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import { chromium } from "playwright";
import { format, resolveConfig } from "prettier";
const evidence = new URL("./evidence/", import.meta.url);
await mkdir(evidence, { recursive: true });
const prettierConfig = await resolveConfig(fileURLToPath(new URL("README.md", evidence)));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = {
  browser: browser.version(),
  keyboard: [],
  layouts: [],
  errors: [],
  humanScreenReaderListening:
    "NOT PERFORMED: needs a human listener; structural assertions are not a substitute.",
};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.goto(process.env.SHELL_BASE_URL || "http://127.0.0.1:5178");
  await page.waitForFunction(() => document.querySelector(".book")?.dataset.stateHash);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.getByRole("button", { name: "Play", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("slider", { name: "Rain input" }).isDisabled(), true);
  const initial = await page.locator(".book").getAttribute("data-state-hash");
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").textContent(), "Skip to the spread");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(":focus").getAttribute("id"), "spread");
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").getAttribute("name"), "prediction");
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").textContent(), "Commit prediction");
  await page.keyboard.press("Enter");
  const chosen = await page.locator('input[name="prediction"]:checked').inputValue();
  assert.equal(await page.getByRole("button", { name: "Play", exact: true }).isDisabled(), false);
  report.keyboard.push("Skip link, native radio arrows and commit unlock the test");
  await page.getByRole("slider", { name: "Rain input" }).focus();
  await page.keyboard.press("End");
  assert.equal(await page.locator("#rain").inputValue(), "50");
  await page.keyboard.press("Home");
  assert.equal(await page.locator("#rain").inputValue(), "0");
  await page.getByRole("slider", { name: "Playback speed" }).focus();
  await page.keyboard.press("End");
  assert.equal(await page.locator("#speed").inputValue(), "4");
  await page.waitForFunction(() =>
    document.querySelector(".widget-time")?.textContent.includes("80 fixed steps"),
  );
  await page.getByRole("checkbox", { name: "Show water overlay" }).focus();
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#show-water").isChecked(), false);
  report.keyboard.push(
    "Rain and speed ranges support Home/End clamps with units; overlay checkbox supports Space",
  );
  await page.getByRole("button", { name: "Reveal explanation" }).focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#explanation").isVisible(), true);
  await page.getByText("What this model ignores", { exact: true }).focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".widget-ignores").getAttribute("open"), "");
  await page.getByText("Teacher note and sources", { exact: true }).focus();
  await page.keyboard.press("Enter");
  report.keyboard.push("Explanation flap and native model/source disclosures work with Enter");
  await page.getByRole("button", { name: "Play", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Number(document.querySelector(".book")?.dataset.step) > 0);
  await page.getByRole("button", { name: "Pause", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(350);
  const before = await page.locator(".book").getAttribute("data-state-hash");
  assert.notEqual(before, initial);
  await page.getByLabel("Reading level").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  assert.equal(await page.getByText("Formula specimen", { exact: true }).isVisible(), true);
  assert.equal(await page.locator("math").count(), 1);
  assert.equal(await page.locator(".katex-mathml annotation").textContent(), "a + b = c");
  await page.waitForTimeout(350);
  assert.equal(await page.locator(".book").getAttribute("data-state-hash"), before);
  assert.equal(await page.locator('input[name="prediction"]:checked').inputValue(), chosen);
  assert.equal(await page.locator("#rain").inputValue(), "0");
  assert.equal(await page.locator("#speed").inputValue(), "4");
  report.keyboard.push(
    "Play/pause advance fixed state; native level select preserves state hash, committed answer and parameter values; MathML remains present",
  );
  const tree = await page.locator("#app").ariaSnapshot();
  for (const expected of [
    "Reading level",
    "What do you want to inspect first?",
    "Rain input",
    "Playback speed",
    "Show water overlay",
    "Fake solver row profiles",
    "math",
  ])
    assert.ok(tree.includes(expected), expected);
  await writeFile(
    new URL("accessibility-tree.yml", evidence),
    await format(tree, { ...prettierConfig, parser: "yaml" }),
  );
  await page.getByRole("button", { name: "Play", exact: true }).press("Enter");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(350);
  assert.equal(
    await page.getByRole("button", { name: "Pause", exact: true }).getAttribute("aria-pressed"),
    "true",
  );
  const stopped = await page.locator(".book").getAttribute("data-step");
  await page.waitForTimeout(400);
  assert.equal(await page.locator(".book").getAttribute("data-step"), stopped);
  report.keyboard.push("Enabling reduced motion pauses playback; no autoplay on initial load");
  await page.getByRole("button", { name: "Reset", exact: true }).press("Enter");
  await page.waitForTimeout(350);
  assert.equal(await page.locator(".book").getAttribute("data-state-hash"), initial);
  assert.equal(await page.locator("#rain").inputValue(), "10");
  assert.equal(await page.locator("#speed").inputValue(), "1");
  assert.equal(await page.getByRole("button", { name: "Play", exact: true }).isDisabled(), true);
  assert.equal(await page.locator('input[name="prediction"]:checked').count(), 0);
  assert.equal(await page.locator("#explanation").isVisible(), false);
  report.keyboard.push("Reset restores seeded state, defaults, closed flap and prediction gate");
  for (const [name, width, height] of [
    ["projector", 1280, 720],
    ["laptop", 1440, 900],
    ["tablet", 768, 1024],
    ["mobile", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const level of ["hs", "uni"]) {
      await page.getByLabel("Reading level").selectOption(level);
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.activeElement?.blur();
      });
      const measurements = await page.evaluate(() => {
        const pages = [...document.querySelectorAll(".page")].map((node) => {
          const { x, y, width, height } = node.getBoundingClientRect();
          return { x, y, width, height };
        });
        const canvas = document.querySelector("canvas"),
          pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        let inkPixels = 0;
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 100 && pixels[i + 1] < 120) inkPixels++;
        return {
          viewport: { width: innerWidth, height: innerHeight },
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          pages,
          inkPixels,
          scaleFraction:
            document.querySelector(".widget-scale-line").getBoundingClientRect().width /
            canvas.getBoundingClientRect().width,
        };
      });
      assert.ok(measurements.scrollWidth <= width, name + ": horizontal overflow");
      assert.ok(
        Math.abs(measurements.scaleFraction - 0.21) < 0.002,
        "Scale bar should span one quarter of the terrain area",
      );
      assert.ok(measurements.inkPixels > 100, "Drawing should contain ink, not only a filled background");
      if (width > 900) assert.ok(Math.abs(measurements.pages[0].y - measurements.pages[1].y) < 2);
      else assert.ok(measurements.pages[1].y > measurements.pages[0].y);
      if (name === "projector")
        assert.ok(measurements.scrollHeight > height, "Projector keeps vertical scrolling");
      if (name === "projector" || name === "mobile")
        await page.screenshot({
          path: fileURLToPath(new URL(`${name}-${level}.png`, evidence)),
          fullPage: true,
        });
      report.layouts.push({ name, level, ...measurements });
    }
  }
  assert.deepEqual(report.errors, []);
  await writeFile(new URL("results.json", evidence), JSON.stringify(report, null, 2) + "\n");
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} finally {
  await browser.close();
}
