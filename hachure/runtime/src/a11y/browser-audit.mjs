/* global document, window, console */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
const root = new URL("../../../../", import.meta.url);
const requireRoot = createRequire(new URL("package.json", root));
const requireBook = createRequire(new URL("uplift/book/package.json", root));
const { chromium } = requireBook("playwright");
const axePath = requireRoot.resolve("axe-core/axe.min.js");
const evidence = new URL("./evidence/", import.meta.url);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = {
  browser: browser.version(),
  checks: [],
  axe: [],
  focusOrder: [],
  errors: [],
  humanListening: "not performed",
};
const base = process.env.LESSON_BASE_URL || "http://127.0.0.1:5194";
async function tabTo(page, target) {
  for (let i = 0; i < 100; i++) {
    if (await target.evaluate((node) => node === document.activeElement)) return;
    await page.keyboard.press("Tab");
    report.focusOrder.push(
      await page.evaluate(() => {
        const node = document.activeElement;
        return {
          tag: node.tagName,
          id: node.id,
          label: node.getAttribute("aria-label") || node.textContent?.trim().slice(0, 80),
        };
      }),
    );
  }
  throw new Error("Could not reach keyboard target: " + (await target.getAttribute("id")));
}
async function scan(page, stage) {
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(async () => {
    const results = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    return {
      violations: results.violations.map(({ id, impact, description, nodes }) => ({
        id,
        impact,
        description,
        targets: nodes.map((n) => n.target),
      })),
      incomplete: results.incomplete.map(({ id }) => id),
    };
  });
  report.axe.push({ stage, ...result });
  assert.deepEqual(
    result.violations.filter((v) => ["serious", "critical"].includes(v.impact)),
    [],
    "Serious axe violations at " + stage,
  );
}
try {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector(".book")?.dataset.stateHash);
  await scan(page, "flat high school");
  await tabTo(page, page.locator(".skip-link"));
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#spread").evaluate((n) => n === document.activeElement), true);
  await tabTo(page, page.locator('input[name="prediction"]').first());
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await tabTo(page, page.getByRole("button", { name: "Commit prediction" }));
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector("#rain").disabled);
  assert.equal(await page.locator(".paired-replay").evaluate((n) => n === document.activeElement), true);
  assert.equal(await page.locator(".book").getAttribute("data-step"), "0");
  assert.equal(await page.locator(".paired-replay").getAttribute("data-playing"), "false");
  await tabTo(page, page.getByRole("slider", { name: "Recorded model step" }));
  await page.keyboard.press("End");
  await tabTo(page, page.getByRole("button", { name: "Reveal explanation" }));
  await page.keyboard.press("Enter");
  assert.match(await page.locator("#explanation").textContent(), /does not necessarily mean a deeper valley/);
  await tabTo(page, page.locator("#rain"));
  await page.keyboard.press("End");
  await page.waitForFunction(
    () => document.querySelector("#rain").value === document.querySelector("#rain").max,
  );
  await tabTo(page, page.getByRole("button", { name: "Play", exact: true }));
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Number(document.querySelector(".book").dataset.step) > 0);
  await tabTo(page, page.getByRole("button", { name: "Pause", exact: true }));
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByRole("spinbutton", { name: "Brush radius (m)", exact: true }));
  await page.keyboard.press("Control+A");
  await page.keyboard.type("99999");
  await page.keyboard.press("Tab");
  assert.match(await page.locator("#valley-tools-status").textContent(), /limit reached/);
  await tabTo(page, page.getByRole("button", { name: /^Terrain brush cursor/ }));
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() =>
    /Raise applied/.test(document.querySelector("#valley-tools-status").textContent),
  );
  await tabTo(page, page.getByLabel("Reading level", { exact: true }));
  const hash = await page.locator(".book").getAttribute("data-state-hash");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".book").getAttribute("data-state-hash"), hash);
  await scan(page, "explained university");
  const cdp = await context.newCDPSession(page);
  await page.locator(".paired-replay").scrollIntoViewIfNeeded();
  for (const type of ["none", "deuteranopia", "protanopia", "tritanopia"]) {
    await cdp.send("Emulation.setEmulatedVisionDeficiency", { type });
    await page
      .locator(".paired-replay")
      .screenshot({ path: fileURLToPath(new URL(type + ".png", evidence)) });
    await page
      .locator(".page-right > figure")
      .screenshot({ path: fileURLToPath(new URL("terrain-" + type + ".png", evidence)) });
  }
  await cdp.send("Emulation.setEmulatedVisionDeficiency", { type: "none" });
  await tabTo(page, page.getByRole("button", { name: "Reset", exact: true }));
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.querySelector(".book").dataset.step === "0" && document.querySelector("#rain").disabled,
  );
  assert.equal(await page.locator(".widget-predict").evaluate((n) => n === document.activeElement), true);
  assert.equal(await page.locator(".stamp").count(), 0);
  report.checks.push(
    "Keyboard: skip, predict, comparison, explanation, rain, playback, brush clamp/apply, level preservation, reset focus; reduced motion starts both scenes paused",
  );
  const motionPage = await context.newPage();
  await motionPage.emulateMedia({ reducedMotion: "no-preference" });
  await motionPage.goto(base);
  await motionPage.locator('input[name="prediction"]').first().check();
  await motionPage.getByRole("button", { name: "Commit prediction" }).click();
  await motionPage.emulateMedia({ reducedMotion: "reduce" });
  await motionPage.waitForFunction(() => !document.querySelector("#rain").disabled);
  assert.equal(await motionPage.locator(".book").getAttribute("data-step"), "0");
  assert.equal(await motionPage.locator(".paired-replay").getAttribute("data-playing"), "false");
  report.checks.push("Enabling reduced motion during lift completes without autoplay or stranded controls");
  await motionPage.close();
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile(new URL("results.json", evidence), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify({ checks: report.checks, axe: report.axe, errors: report.errors }, null, 2));
