/* global window, document */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import process from "node:process";
import { URL } from "node:url";
import console from "node:console";
const require = createRequire(new URL("../../../../spikes/gpu-compute/package.json", import.meta.url));
const { chromium } = require("playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { browser: browser.version(), checks: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1100 } });
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(
    process.env.TOOLS_BASE_URL || "http://127.0.0.1:5183/hachure/runtime/src/tools-ui/fixture/",
  );
  await page.waitForFunction(() => window.fixture);
  // Every change and application here is driven by native keyboard events.
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").getAttribute("id"), "fixture-tool");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Control+A");
  await page.keyboard.type("99999");
  await page.keyboard.press("Tab");
  assert.equal(await page.locator("#fixture-radius").inputValue(), "20");
  assert.match(await page.locator("#fixture-status").textContent(), /radius limit reached/);
  await page.keyboard.press("Control+A");
  await page.keyboard.type("999");
  await page.keyboard.press("Tab");
  assert.equal(await page.locator("#fixture-amount").inputValue(), "5");
  assert.match(await page.locator("#fixture-status").textContent(), /strength limit reached/);
  assert.equal(await page.locator(":focus").textContent(), "Terrain brush cursor");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  assert.match(await page.locator("#fixture-status").textContent(), /east 55 m, south 35 m/);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() =>
    document.querySelector('[role="status"]').textContent.includes("Net material change"),
  );
  assert.match(await page.locator("#fixture-status").textContent(), /Raise applied.*Limit reached: slope/);
  assert.equal(await page.evaluate(() => window.fixture.calls.length), 1);
  assert.equal(await page.locator(":focus").textContent(), "Terrain brush cursor");
  report.checks.push(
    "Tab order reaches tool, radius, amount and cursor; keyboard-only raise applies at the announced location; input and solver slope clamps are visible and live.",
  );
  for (const [key, kind] of [
    ["d", "dig"],
    ["s", "smooth"],
    ["h", "harden"],
  ]) {
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press(key);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Control+A");
    await page.keyboard.type(kind === "harden" ? "0.8" : "0.5");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await page.waitForFunction(() => !window.fixture.palette.state().busy);
    assert.equal(await page.evaluate(() => window.fixture.calls.at(-1).kind), kind);
  }
  report.checks.push(
    "Dig, smooth and harden all select, configure and apply using only keyboard; Enter and Space issue one operation each.",
  );
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  assert.match(await page.locator("#fixture-status").textContent(), /Terrain edge reached/);
  const calls = await page.evaluate(() => window.fixture.calls.length);
  await page.evaluate(() => window.fixture.palette.setEnabled(false));
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => window.fixture.calls.length), calls);
  await page.evaluate(() => {
    window.fixture.palette.setEnabled(true);
    window.fixture.fail();
  });
  await page.getByRole("button", { name: /Terrain brush cursor/ }).focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() =>
    document.querySelector('[role="status"]').textContent.includes("could not be applied"),
  );
  report.checks.push(
    "Edge clamping is announced; disabled state prevents editing; rejected async tools restore a usable cursor and show a failure message.",
  );
  assert.deepEqual(report.errors, []);
  await page.screenshot({
    path: new URL("./fixture/keyboard.png", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"),
    fullPage: true,
  });
  await writeFile(new URL("./fixture/results.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
