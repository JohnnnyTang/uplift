/* global document, console */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import { chromium } from "playwright";
const evidence = new URL("./evidence/", import.meta.url);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = {
  browser: browser.version(),
  date: new Date().toISOString(),
  errors: [],
  checks: [],
  measurements: [],
};
try {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    recordVideo: { dir: fileURLToPath(evidence), size: { width: 1366, height: 900 } },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.goto(process.env.LESSON_BASE_URL || "http://127.0.0.1:5183/?view=research&backend=cpu-worker");
  await page.waitForFunction(() => document.querySelector(".book")?.dataset.stateHash);
  await page.waitForTimeout(500);
  assert.equal(await page.locator(".terrain-flat svg").count(), 1);
  assert.equal(await page.locator(".book").getAttribute("data-step"), "0");
  assert.equal(await page.getByRole("slider", { name: "Rain input" }).isDisabled(), true);
  assert.equal(await page.locator("#valley-tools-tool").isDisabled(), true);
  assert.match(await page.locator(".widget-predict").textContent(), /lift more material/);
  assert.match(await page.locator(".challenge-status").textContent(), /not yet available/);
  assert.equal(await page.locator(".stamp").count(), 0);
  report.checks.push(
    "Real preset flat SVG appears before prediction; lift is independent of prediction; pending challenge awards no stamp",
  );
  await page.screenshot({ path: fileURLToPath(new URL("flat.png", evidence)), fullPage: true });
  await page.locator('input[name="prediction"]').first().focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Lift the drawing", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("#rain")?.disabled, { timeout: 30000 });
  await page.waitForFunction(() => Number(document.querySelector(".book")?.dataset.step) >= 30, {
    timeout: 30000,
  });
  assert.equal(await page.locator("canvas").evaluate((node) => node.style.opacity), "1");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForTimeout(600);
  const before = await page.locator(".book").getAttribute("data-state-hash");
  await page.getByRole("button", { name: "Show result", exact: true }).click();
  await page.getByRole("button", { name: "Reveal explanation" }).click();
  assert.equal(await page.locator("#explanation").isVisible(), true);
  await page.getByLabel("Reading level").selectOption("uni");
  await page.waitForTimeout(350);
  assert.equal(await page.locator(".book").getAttribute("data-state-hash"), before);
  assert.equal(await page.locator("math").count(), 1);
  assert.match(await page.locator(".widget-time").textContent(), /not calibrated/);
  report.checks.push(
    "Optional prediction/lift/run/flap works on CPU128; paused level toggle preserves hash; uncalibrated years remain suppressed",
  );
  await page.locator("#valley-tools-tool").focus();
  await page.keyboard.press("d");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Control+A");
  await page.keyboard.type("99999");
  await page.keyboard.press("Tab");
  assert.match(await page.locator("#valley-tools-status").textContent(), /radius limit reached/);
  await page.keyboard.press("Control+A");
  await page.keyboard.type("2");
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() =>
    document.querySelector("#valley-tools-status")?.textContent.includes("Dig applied"),
  );
  assert.notEqual(await page.locator(".book").getAttribute("data-state-hash"), before);
  assert.match(await page.locator(":focus").getAttribute("aria-label"), /Terrain brush cursor/);
  const afterKeyboard = await page.locator(".book").getAttribute("data-state-hash");
  await page.locator("#valley-tools-tool").selectOption("raise");
  await page.waitForTimeout(300);
  const canvasBox = await page.locator("canvas").boundingBox();
  await page.locator("canvas").click({ position: { x: canvasBox.width / 2, y: canvasBox.height / 2 } });
  await page.waitForFunction(() =>
    document.querySelector("#valley-tools-status")?.textContent.includes("Raise applied"),
  );
  assert.notEqual(await page.locator(".book").getAttribute("data-state-hash"), afterKeyboard);
  report.checks.push(
    "Keyboard dig reaches the real Worker with radius clamp and focus retention; pointer ray picking applies raise to the displayed terrain",
  );
  report.measurements.push(await page.locator(".book").evaluate((node) => ({ ...node.dataset })));
  await page.screenshot({ path: fileURLToPath(new URL("raised-uni.png", evidence)), fullPage: true });
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".book")?.dataset.step === "0");
  assert.equal(await page.getByRole("slider", { name: "Rain input" }).isDisabled(), true);
  assert.equal(await page.locator("#valley-tools-tool").isDisabled(), true);
  report.checks.push("Reset returns to flat drawing, default controls, and zero steps");
  const video = page.video();
  await context.close();
  if (video) {
    await video.saveAs(fileURLToPath(new URL("predict-lift-run-flap.webm", evidence)));
    await video.delete();
  }
  const reduced = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  const reducedPage = await reduced.newPage();
  reducedPage.on("pageerror", (error) => report.errors.push(error.message));
  await reducedPage.goto(
    process.env.LESSON_BASE_URL || "http://127.0.0.1:5183/?view=research&backend=cpu-worker",
  );
  await reducedPage.waitForFunction(() => document.querySelector(".book")?.dataset.stateHash);
  await reducedPage.locator('input[name="prediction"]').first().check();
  await reducedPage.getByRole("button", { name: "Commit prediction" }).click();
  await reducedPage.getByRole("button", { name: "Lift the drawing", exact: true }).click();
  await reducedPage.waitForFunction(() => !document.querySelector("#rain")?.disabled);
  await reducedPage.waitForTimeout(800);
  assert.equal(await reducedPage.locator(".book").getAttribute("data-step"), "0");
  assert.equal(
    await reducedPage.getByRole("button", { name: "Play", exact: true }).getAttribute("aria-pressed"),
    "false",
  );
  report.checks.push("Reduced motion crossfades without autoplay");
  await reduced.close();
  assert.deepEqual(report.errors, []);
} finally {
  await browser.close();
  await writeFile(new URL("results.json", evidence), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
