/* global URL, Image, document */
/**
 * Headless evidence for the ink dev page: screenshots at exaggeration 0, 0.5 and 1 on both backends, and
 * a pixel comparison of the flat SVG against the canvas at exaggeration 0 (the crossfade handoff).
 *
 *   pnpm --filter @hachure/ink capture
 *
 * Uses the system Chrome through Playwright (channel "chrome"). Writes into dev/evidence/. These are
 * renderer fixtures driven by the fake solver: not a performance benchmark and not science.
 */
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));
const evidence = fileURLToPath(new URL("./evidence/", import.meta.url));
const port = 5177;
const server = await createServer({
  configFile: `${here}vite.config.ts`,
  server: { host: "127.0.0.1", port, strictPort: true },
});
await server.listen();
await mkdir(evidence, { recursive: true });

const viewport = { width: 1000, height: 1400 };
const results = { runs: [], crossfade: {}, errors: [] };
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  results.browser = browser.version();
  {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/vitest-shim.ts`);
    results.adapter = await page.evaluate(async () => {
      const adapter = await globalThis.navigator.gpu?.requestAdapter();
      if (!adapter) return null;
      const { vendor, architecture, device, description } = adapter.info ?? {};
      return { vendor, architecture, device, description };
    });
    await page.close();
  }

  async function open(query) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => results.errors.push(`${query}: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") results.errors.push(`${query}: ${m.text()}`);
    });
    await page.goto(`http://127.0.0.1:${port}/?${query}`);
    await page.waitForFunction(() => globalThis.__ink?.ready || globalThis.__ink?.error, null, {
      timeout: 60_000,
    });
    const state = await page.evaluate(() => globalThis.__ink);
    if (state.error) throw new Error(`${query}: ${state.error}`);
    return { page, state };
  }

  for (const backend of ["webgpu", "webgl2"]) {
    for (const e of [0, 0.5, 1]) {
      // At 0 the canvas is in the handoff state (hachures and overlays hidden); above 0 all layers show.
      const query = `backend=${backend}&e=${e}&overlays=${e === 0 ? 0 : 1}`;
      const { page, state } = await open(query);
      const file = `${backend}-e${e}.png`;
      await page.locator("#stage").screenshot({ path: `${evidence}${file}` });
      results.runs.push({
        backend,
        requested: backend,
        reported: state.backend,
        exaggeration: e,
        file,
        stats: state.stats,
        timings: state.timings,
      });
      await page.close();
    }
  }

  // Full page with overlays at full lift, for layout context.
  {
    const { page } = await open("backend=webgpu&e=1");
    await page.screenshot({ path: `${evidence}page-webgpu-e1.png`, fullPage: true });
    await page.close();
  }

  // Interaction checks: live state updates, the animated lift, reduced motion, keyboard.
  for (const backend of ["webgpu", "webgl2"]) {
    const checks = {};
    {
      const { page } = await open(`backend=${backend}`);
      const stepOf = () => page.evaluate(() => globalThis.__ink.step());
      const before = await stepOf();
      await page.click("#play");
      await page.waitForTimeout(1500);
      await page.click("#play");
      checks.liveUpdates = { stepBefore: before, stepAfter: await stepOf() };
      await page.click("#lift");
      await page.waitForTimeout(300);
      checks.midLift = await page.evaluate(() => ({
        exaggeration: globalThis.__ink.view.exaggeration,
        canvasOpacity: Number(document.getElementById("terrain").style.opacity),
      }));
      await page.waitForTimeout(3200);
      checks.afterLift = await page.evaluate(() => ({
        exaggeration: globalThis.__ink.view.exaggeration,
        layers: globalThis.__ink.view.layers,
        canvasOpacity: Number(document.getElementById("terrain").style.opacity),
        flatOpacity: Number(document.getElementById("flat").style.opacity),
        status: document.getElementById("status").textContent,
      }));
      await page.locator("#stage").screenshot({ path: `${evidence}${backend}-after-live-run.png` });
      await page.click("#flatten");
      await page.locator("#exaggeration").focus();
      await page.keyboard.press("ArrowRight");
      checks.keyboard = await page.evaluate(() => globalThis.__ink.view.exaggeration);
      await page.close();
    }
    {
      const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
      page.on("pageerror", (e) => results.errors.push(`reduced-motion: ${e.message}`));
      await page.goto(`http://127.0.0.1:${port}/?backend=${backend}`);
      await page.waitForFunction(() => globalThis.__ink?.ready, null, { timeout: 60_000 });
      await page.click("#lift");
      checks.reducedMotionImmediately = await page.evaluate(() => ({
        exaggeration: globalThis.__ink.view.exaggeration,
        canvasOpacity: Number(document.getElementById("terrain").style.opacity),
      }));
      await page.close();
    }
    results.interaction = { ...results.interaction, [backend]: checks };
  }

  // Crossfade check: the flat SVG alone versus the canvas alone at exaggeration 0, overlays hidden.
  for (const backend of ["webgpu", "webgl2"]) {
    const shots = {};
    for (const show of ["svg", "canvas"]) {
      const { page } = await open(`backend=${backend}&e=0&overlays=0&show=${show}`);
      shots[show] = (
        await page.locator("#stage").screenshot({ path: `${evidence}crossfade-${backend}-${show}.png` })
      ).toString("base64");
      await page.close();
    }
    const page = await browser.newPage();
    results.crossfade[backend] = await page.evaluate(
      async ({ svg, canvas }) => {
        const load = (b64) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = `data:image/png;base64,${b64}`;
          });
        const [a, b] = await Promise.all([load(svg), load(canvas)]);
        const w = a.width;
        const h = a.height;
        const read = (img) => {
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0);
          return ctx.getImageData(0, 0, w, h).data;
        };
        const pa = read(a);
        const pb = read(b);
        // "Ink" pixels: noticeably darker than paper (luma below 200 of 255).
        const ink = (p, i) => 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2] < 200;
        const mask = (p) => {
          const m = new Uint8Array(w * h);
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) m[y * w + x] = ink(p, (y * w + x) * 4) ? 1 : 0;
          return m;
        };
        const ma = mask(pa);
        const mb = mask(pb);
        // Fraction of ink pixels in one image with an ink pixel within `r` px in the other.
        const near = (from, to, r) => {
          let total = 0;
          let hit = 0;
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              if (!from[y * w + x]) continue;
              total++;
              let found = false;
              for (let dy = -r; dy <= r && !found; dy++)
                for (let dx = -r; dx <= r && !found; dx++) {
                  const xx = x + dx;
                  const yy = y + dy;
                  if (xx >= 0 && yy >= 0 && xx < w && yy < h && to[yy * w + xx]) found = true;
                }
              if (found) hit++;
            }
          return { inkPixels: total, matchedFraction: total ? hit / total : 1 };
        };
        let sum = 0;
        for (let i = 0; i < pa.length; i += 4)
          sum += Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
        // Paper colour at the stage centre-left margin, where neither image has lines.
        const at = (p, x, y) => Array.from(p.slice((y * w + x) * 4, (y * w + x) * 4 + 3));
        return {
          size: [w, h],
          meanAbsDiffPerChannel: sum / ((pa.length / 4) * 3),
          svgInkWithin1px: near(ma, mb, 1),
          canvasInkWithin1px: near(mb, ma, 1),
          svgInkWithin2px: near(ma, mb, 2),
          canvasInkWithin2px: near(mb, ma, 2),
          paperSampleSvg: at(pa, 4, 4),
          paperSampleCanvas: at(pb, 4, 4),
        };
      },
      { svg: shots.svg, canvas: shots.canvas },
    );
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}

await writeFile(`${evidence}results.json`, `${JSON.stringify(results, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify({ browser: results.browser, crossfade: results.crossfade, errors: results.errors, runs: results.runs.map((r) => [r.backend, r.reported, r.exaggeration, r.stats?.lastUpdateMs]) }, null, 2)}\n`,
);
