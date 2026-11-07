/* global process, console, document, innerWidth, getComputedStyle */
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5175");
await page.waitForTimeout(1000);
await mkdir("spikes/ink-look/evidence", { recursive: true });
const results = [];
for (const e of [0, 0.5, 1]) {
  await page.selectOption("#contours", "geometry");
  await page.selectOption("#hatching", "hachures");
  await page.locator("#lift").fill(String(e));
  await page.screenshot({ path: `spikes/ink-look/evidence/lift-${e}.png`, fullPage: true });
  for (const method of ["geometry", "shader"])
    for (const hatch of ["hachures", "parallel", "none"]) {
      await page.selectOption("#contours", method);
      await page.selectOption("#hatching", hatch);
      results.push({ e, method, hatch, metrics: await page.locator("#metrics").textContent() });
    }
}
await page.selectOption("#contours", "geometry");
await page.selectOption("#hatching", "hachures");
await page.check("#channels");
for (const vision of ["normal", "protanopia", "deuteranopia", "tritanopia"]) {
  await page.selectOption("#vision", vision);
  await page.screenshot({ path: `spikes/ink-look/evidence/palette-${vision}.png`, fullPage: true });
}
await page.emulateMedia({ reducedMotion: "reduce" });
await page.click("#crossfade");
await page.waitForTimeout(50);
const reduced = {
  lift: await page.locator("#lift").inputValue(),
  opacity: await page.locator("#terrain").evaluate((el) => getComputedStyle(el).opacity),
};
await page.locator("#lift").focus();
await page.keyboard.press("ArrowRight");
const keyboard = await page.locator("#lift").inputValue();
await page.setViewportSize({ width: 1280, height: 720 });
await page.screenshot({ path: "spikes/ink-look/evidence/projector.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
await writeFile(
  "spikes/ink-look/evidence/results.json",
  JSON.stringify(
    { browser: browser.version(), errors, reduced, keyboard, mobileOverflow: overflow, results },
    null,
    2,
  ),
);
console.log(JSON.stringify({ errors, reduced, keyboard, overflow, first: results[0] }));
await browser.close();
