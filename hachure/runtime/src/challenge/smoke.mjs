/* global document, console */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
const require = createRequire(new URL("../../../../uplift/book/package.json", import.meta.url));
const { chromium } = require("playwright");
const evidence = new URL("./evidence/", import.meta.url);
await mkdir(evidence, { recursive: true });
const base = process.env.LESSON_BASE_URL || "http://127.0.0.1:5187";
const fixture =
  base + "/@fs/" + fileURLToPath(new URL("./fixture/index.html", import.meta.url)).replaceAll("\\", "/");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { browser: browser.version(), errors: [], checks: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 850 }, reducedMotion: "reduce" });
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(fixture);
  await page.getByRole("button", { name: "Observe software fixture" }).click();
  assert.equal(await page.locator(".stamp").isVisible(), false);
  await page.getByRole("button", { name: "Commit fixture prediction" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Observe software fixture" }).click();
  assert.equal(await page.locator(".stamp").isVisible(), false);
  await page.getByRole("button", { name: "Reveal fixture explanation" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Observe software fixture" }).focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".stamp").isVisible(), true);
  assert.match(
    await page.locator(".challenge-widget").textContent(),
    /Your committed prediction: Fixture option beta/,
  );
  await page.getByLabel("Fixture reading level").selectOption("uni");
  assert.equal(await page.locator(".stamp").isVisible(), true);
  await page.screenshot({
    path: fileURLToPath(new URL("software-fixture-stamp.png", evidence)),
    fullPage: true,
  });
  await page.reload();
  assert.match(await page.locator(".stamp").textContent(), /Previously earned/);
  await page.goto(fixture + "?pending");
  assert.equal(await page.locator(".stamp").isVisible(), false);
  assert.match(await page.locator(".challenge-status").textContent(), /not yet available/);
  await page.getByRole("button", { name: "Commit fixture prediction" }).click();
  await page.getByRole("button", { name: "Reveal fixture explanation" }).click();
  await page.getByRole("button", { name: "Observe software fixture" }).click();
  assert.equal(await page.locator(".stamp").isVisible(), false);
  await page.goto(fixture + "?blocked-storage");
  await page.getByRole("button", { name: "Commit fixture prediction" }).click();
  await page.getByRole("button", { name: "Reveal fixture explanation" }).click();
  await page.getByRole("button", { name: "Observe software fixture" }).click();
  assert.equal(await page.locator(".stamp").isVisible(), true);
  report.checks.push(
    "Engineering fixture only: keyboard guided loop, stamp display, reload progress, level preservation, nested pending overrides saved stamp, storage denial/quota fallback",
  );
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector(".book")?.dataset.stateHash);
  await page.locator('input[name="prediction"]').first().check();
  await page.getByRole("button", { name: "Commit prediction" }).click();
  await page.getByRole("button", { name: "Show result", exact: true }).click();
  await page.getByRole("button", { name: "Reveal explanation" }).click();
  assert.match(await page.locator("#explanation").textContent(), /You predicted: Lighter rain/);
  assert.match(await page.locator(".challenge-status").textContent(), /not yet available/);
  assert.equal(await page.locator(".stamp").isVisible(), false);
  const hash = await page.locator(".book").getAttribute("data-state-hash");
  await page.getByLabel("Reading level").selectOption("uni");
  assert.equal(await page.locator(".book").getAttribute("data-state-hash"), hash);
  assert.match(await page.locator("#explanation").textContent(), /You predicted: The lower rain input/);
  assert.equal(await page.locator(".stamp").isVisible(), false);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector(".book")?.dataset.step === "0" && document.querySelector("#rain")?.disabled,
  );
  assert.equal(await page.locator(".stamp").isVisible(), false);
  assert.match(await page.locator(".widget-time").textContent(), /not calibrated/);
  report.checks.push(
    "Real book: committed-choice flap at both levels, unchanged state hash, reset retains pending challenge/no stamp/hidden geological years",
  );
  await page.screenshot({ path: fileURLToPath(new URL("real-book-pending.png", evidence)), fullPage: true });
  await page.close();
  assert.deepEqual(report.errors, []);
} finally {
  await browser.close();
  await writeFile(new URL("results.json", evidence), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
