// Frame times during continuous play: node uplift/book/src/scenes/plates/review/perf.mjs [boundary] [gpu]
// Reports animation-frame intervals while the chosen boundary plays early → late (12 view seconds).
/* global document, performance, requestAnimationFrame, setTimeout -- used only inside page.evaluate (browser) */
import console from "node:console";
import process from "node:process";
import { chromium } from "playwright";
const [boundary = "convergent", gpu = "swiftshader"] = process.argv.slice(2);
const origin = process.env.ORIGIN ?? "http://127.0.0.1:4194";
const args =
  gpu === "swiftshader"
    ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    : ["--enable-gpu", "--ignore-gpu-blocklist"];
const browser = await chromium.launch({ args, headless: gpu === "swiftshader" });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
await page.goto(`${origin}/e2e/fixtures/plates-scene.html?start=plates`);
await page.waitForFunction(() => document.querySelector(".ps-desk")?.dataset.transition === "done", null, {
  timeout: 90000,
});
await page.click(`.ps-choice[data-boundary=${boundary}]`);
await page.waitForTimeout(1500);
const result = await page.evaluate(async () => {
  const gaps = [];
  let last = performance.now();
  let run = true;
  const tick = (t) => {
    gaps.push(t - last);
    last = t;
    if (run) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.querySelector(".ps-stage .gs-play").click();
  await new Promise((r) => {
    const check = () =>
      document.querySelector(".ps-desk").dataset.playing === "false" ? r() : setTimeout(check, 100);
    setTimeout(check, 500);
  });
  run = false;
  gaps.sort((a, b) => a - b);
  const q = (p) => gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))].toFixed(1);
  const t = document.querySelector(".ps-desk").drawTimings();
  const d = t.drawMs.slice().sort((a, b) => a - b);
  const dq = (p) => d[Math.min(d.length - 1, Math.floor(p * d.length))].toFixed(1);
  return {
    draws: d.length,
    drawMedian: dq(0.5),
    drawP90: dq(0.9),
    drawMax: d.at(-1).toFixed(1),
    framesGenerated: t.framesGenerated,
    frames: gaps.length,
    median: q(0.5),
    p90: q(0.9),
    p99: q(0.99),
    max: gaps.at(-1).toFixed(1),
  };
});
console.log(boundary, gpu, JSON.stringify(result));
await browser.close();
