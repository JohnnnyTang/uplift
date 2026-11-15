// Quick look: node docs/review/plates/scene/shot.mjs <url-query> <out.png> [actions-json]
/* global document -- used only inside page.evaluate (browser) */
import console from "node:console";
import process from "node:process";
import { chromium } from "playwright";
const [query = "", out = "shot.png", actions = "[]"] = process.argv.slice(2);
const origin = process.env.ORIGIN ?? "http://127.0.0.1:4194";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({
  viewport: { width: Number(process.env.W ?? 1366), height: Number(process.env.H ?? 900) },
  deviceScaleFactor: Number(process.env.DPR ?? 1),
});
page.on(
  "console",
  (m) => (m.type() === "error" || m.type() === "warning") && console.log("console:", m.text()),
);
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto(`${origin}/e2e/fixtures/plates-scene.html?start=plates&${query}`);
await page.waitForSelector(".ps-desk[data-ready='true']", { timeout: 60000 });
await page.waitForFunction(
  () =>
    document.querySelector(".ps-desk")?.dataset.transition === "done" ||
    document.querySelector(".ps-desk")?.dataset.static === "true",
  null,
  { timeout: 60000 },
);
for (const a of JSON.parse(actions)) {
  if (a.click) await page.click(a.click);
  if (a.eval) await page.evaluate(a.eval);
  if (a.wait) await page.waitForTimeout(a.wait);
}
await page.waitForTimeout(800);
const clip = process.env.CLIP ? JSON.parse(process.env.CLIP) : undefined;
if (process.env.SCROLL)
  await page.evaluate(
    (sel) => document.querySelector(sel)?.scrollIntoView({ block: "center" }),
    process.env.SCROLL,
  );
await page.waitForTimeout(400);
await page.screenshot({ path: out, fullPage: !!process.env.FULL, ...(clip ? { clip } : {}) });
console.log(
  await page.evaluate(() =>
    JSON.stringify({
      ...document.querySelector(".ps-desk").dataset,
      status: document.querySelector(".ps-scene [role=status]")?.textContent,
    }),
  ),
);
await browser.close();
