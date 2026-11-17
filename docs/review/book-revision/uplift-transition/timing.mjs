/* global console, process, window, document, MutationObserver, performance, URL */
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const channel = process.env.CAPTURE_CHANNEL;
const browser = await chromium.launch({
  ...(channel ? { channel } : {}),
  args: channel
    ? ["--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-webgpu"]
    : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
try {
  for (const lesson of ["glacial", "plates"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const selector = lesson === "glacial" ? ".gs-desk" : ".ps-desk";
    await page.addInitScript(
      ({ selector }) => {
        window.entranceMeasurements = { phases: [] };
        const observer = new MutationObserver(() => {
          const desk = document.querySelector(selector);
          const m = window.entranceMeasurements;
          const phase = desk?.dataset.transitionPhase;
          if (phase && m.phases.at(-1)?.phase !== phase) m.phases.push({ phase, at: performance.now() });
          if (desk?.dataset.transition === "running" && m.start === undefined) m.start = performance.now();
          if (desk?.dataset.transition === "done" && m.done === undefined) m.done = performance.now();
        });
        observer.observe(document, { attributes: true, subtree: true });
      },
      { selector },
    );
    await page.goto(
      `http://127.0.0.1:5373/${lesson === "plates" ? "?spread=tectonics.plate-boundaries&page=spread" : ""}`,
    );
    await page.locator(`${selector}[data-transition="done"]`).waitFor({ timeout: 120000 });
    results.push({
      lesson,
      browser: browser.version(),
      backend: await page.locator(selector).getAttribute("data-backend"),
      ...(await page.evaluate(() => window.entranceMeasurements)),
    });
    await page.evaluate(() => {
      window.entranceMeasurements = { phases: [] };
    });
    await page.getByRole("button", { name: "Replay the drawing" }).click();
    await page.locator(`${selector}[data-transition="done"]`).waitFor({ timeout: 120000 });
    results.push({ lesson, replay: true, ...(await page.evaluate(() => window.entranceMeasurements)) });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
writeFileSync(new URL("./timing.json", import.meta.url), JSON.stringify(results, null, 2) + "\n");
