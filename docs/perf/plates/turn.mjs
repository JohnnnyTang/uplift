/* global document, window, performance, requestAnimationFrame, setTimeout */
/**
 * Session 7F: a bounded performance check of lesson 2 (_Where plates meet_) and the page turn between the two
 * lessons, in visible (headed) installed Chrome with 6A's method: a fresh browser process and profile per
 * repetition, page-clock times (the input event's own timestamp → the frame that shows the answer), the
 * production build. Lesson 1's own journey is checked against the 6A2 baseline with 6A2's harness
 * (`docs/perf/batch-latency.mjs --root=docs/perf/plates`); this script measures only what 7F adds.
 *
 *   pnpm build && pnpm --filter @uplift/book preview --host 127.0.0.1 --port 4190 --strictPort
 *   node docs/perf/plates/turn.mjs --reps=5             # second terminal; writes docs/perf/plates/turn/
 *   node docs/perf/plates/turn.mjs --summarize          # pooled table → docs/perf/plates/turn-summary.json
 *
 * Options: --reps=N, --base=URL (default http://127.0.0.1:4190), --headless (diagnostics only).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import console from "node:console";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : true;
};
const OUT = fileURLToPath(new URL("./turn/", import.meta.url));
const BASE = arg("base", "http://127.0.0.1:4190");
const REPS = Number(arg("reps", 5));
const HEADLESS = arg("headless", false) === true;
const TURN_CYCLES = 4;
const PLAY_MS = 6000;

/** Page-side helpers, installed before any script of the app runs. */
const INSTRUMENT = () => {
  const p = (window.__plates = { inputs: [], frames: null });
  for (const type of ["pointerup", "keydown"])
    window.addEventListener(type, (e) => p.inputs.push({ type, t: e.timeStamp }), { capture: true });
  /** Resolves the first painted frame after `test()` holds (polled each animation frame). */
  p.until = (test, timeoutMs = 120000) =>
    new Promise((resolve, reject) => {
      const start = performance.now();
      const check = () => {
        if (test()) requestAnimationFrame(() => setTimeout(() => resolve(performance.now()), 0));
        else if (performance.now() - start > timeoutMs) reject(new Error("timeout"));
        else requestAnimationFrame(check);
      };
      check();
    });
  /** Frame intervals for `ms` (unit: ms). */
  p.frameWindow = (ms) =>
    new Promise((resolve) => {
      const out = [];
      let last = performance.now();
      const end = last + ms;
      const tick = (t) => {
        out.push(t - last);
        last = t;
        if (t < end) requestAnimationFrame(tick);
        else resolve(out);
      };
      requestAnimationFrame(tick);
    });
};

const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
  return { n: s.length, median: q(0.5), p90: q(0.9), max: s.at(-1) };
};
/** Frame statistics of a window of frame intervals (unit: ms). */
const frames = (iv) => {
  const s = [...iv].sort((a, b) => a - b);
  const r = (x) => Math.round(x * 10) / 10;
  return {
    fps: r((1000 * iv.length) / iv.reduce((a, b) => a + b, 0)),
    p95Ms: r(s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]),
    maxMs: r(s.at(-1)),
    over50: iv.filter((x) => x > 50).length,
  };
};

async function rep(index) {
  const { chromium } = await import("@playwright/test");
  const profile = mkdtempSync(join(tmpdir(), "uplift-7f-"));
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chrome",
    headless: HEADLESS,
    viewport: null,
    args: ["--start-maximized"],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.addInitScript(INSTRUMENT);
  const result = {
    session: "7F",
    sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    chrome: context.browser()?.version() ?? null,
    headless: HEADLESS,
    startedAt: new Date().toISOString(),
    samples: {},
    frames: {},
    checks: {},
    memory: [],
    errors: [],
  };
  const add = (key, v) => (result.samples[key] ??= []).push(Math.round(v));
  page.on("pageerror", (e) => result.errors.push(`pageerror: ${e.message}`));
  const ev = (fn, a) => page.evaluate(fn, a);
  const lastInput = () => ev(() => window.__plates.inputs.at(-1).t);
  /** Input → the frame after `test` holds, in page time. */
  const answer = async (action, test, a) => {
    const done = ev(
      ([src, arg]) => window.__plates.until(() => new Function("arg", `return (${src})(arg)`)(arg)),
      [test.toString(), a],
    );
    await action();
    const t1 = await done;
    return t1 - (await lastInput());
  };
  const deskSel = ".gs-desk";
  try {
    await page.goto(`${BASE}/`);
    await page.waitForSelector('.gs-desk[data-source="live"][data-transition="done"]', { timeout: 120000 });
    result.checks.viewport = await ev(() => [window.innerWidth, window.innerHeight, window.devicePixelRatio]);
    result.checks.glacier = await page.locator(deskSel).getAttribute("data-backend");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForFunction(() => Number(document.querySelector(".gs-desk").dataset.modelYears) > 5);
    const run = await page.locator(deskSel).getAttribute("data-run-id");
    result.memory.push({
      label: "lesson 1 playing",
      ...(await ev(() => ({
        heapMB: Math.round(performance.memory.usedJSHeapSize / 1e5) / 10,
        dom: document.getElementsByTagName("*").length,
      }))),
    });

    for (let c = 0; c < TURN_CYCLES; c++) {
      // ---- Turn to lesson 2 (lesson 1 playing): drawing, stage ready, transition, usable. ----
      const yearsAtLeave = Number(await page.locator(deskSel).getAttribute("data-model-years"));
      const marks = ev(() => {
        const p = window.__plates;
        const q = (s) => document.querySelector(s);
        return Promise.all([
          p.until(() => q(".ps-desk .gs-drawing svg")?.checkVisibility()),
          p.until(() => ["running", "done"].includes(q(".ps-desk")?.dataset.transition)),
          p.until(() => q(".ps-desk")?.dataset.transition === "done"),
        ]);
      });
      await page.getByRole("button", { name: "Turn to Where plates meet" }).click();
      const t0 = await lastInput();
      const transitionFrames = ev(
        async (ms) => {
          await window.__plates.until(() =>
            ["running", "done"].includes(document.querySelector(".ps-desk")?.dataset.transition),
          );
          return window.__plates.frameWindow(ms);
        },
        c === 0 ? 2400 : 400,
      );
      const [drawn, stage, usable] = await marks;
      add(c === 0 ? "turnDrawingFirstMs" : "turnDrawingRepeatMs", drawn - t0);
      add(c === 0 ? "turnStageFirstMs" : "turnStageRepeatMs", stage - t0);
      add(c === 0 ? "turnUsableFirstMs" : "turnUsableRepeatMs", usable - t0);
      if (c === 0) result.frames.transitionFirst = frames(await transitionFrames);
      else await transitionFrames;
      await page.waitForTimeout(500);

      if (c === 0) {
        // ---- Lesson 2: choose (picker), play, scrub (keyboard), arrow key on a plate handle. ----
        add(
          "chooseConvergentMs",
          await answer(
            () => page.locator(".ps-choice[data-boundary=convergent]").click(),
            () => document.querySelector(".ps-desk").dataset.boundary === "convergent",
          ),
        );
        add(
          "playToPlayingMs",
          await answer(
            () => page.locator(".ps-stage .gs-play").click(),
            () => document.querySelector(".ps-desk").dataset.playing === "true",
          ),
        );
        result.frames.play = frames(await ev((ms) => window.__plates.frameWindow(ms), PLAY_MS));
        result.checks.stageAfterPlay = Number(await page.locator(".ps-desk").getAttribute("data-stage"));
        await page.locator(".ps-stage .gs-play").click();
        await page.locator("#ps-stage").focus();
        add(
          "scrubEndMs",
          await answer(
            () => page.keyboard.press("End"),
            () => document.querySelector(".ps-desk").dataset.stage === "1",
          ),
        );
        for (let k = 0; k < 6; k++) {
          const before = await page.locator(".ps-desk").getAttribute("data-stage");
          add(
            "scrubStepMs",
            await answer(
              () => page.keyboard.press("ArrowLeft"),
              (b) => document.querySelector(".ps-desk").dataset.stage !== b,
              before,
            ),
          );
        }
        add(
          "chooseDivergentMs",
          await answer(
            () => page.locator(".ps-choice[data-boundary=divergent]").click(),
            () => document.querySelector(".ps-desk").dataset.boundary === "divergent",
          ),
        );
        await page.locator(".hb-handle[data-handle=left]").focus();
        add(
          "arrowKeyTransformMs",
          await answer(
            () => page.keyboard.press("ArrowUp"),
            () => document.querySelector(".ps-desk").dataset.boundary === "transform",
          ),
        );
        await page.locator("#ps-stage").focus();
        await page.keyboard.press("End");
        await page.waitForTimeout(400);
        result.frames.ghostsIdle = frames(await ev((ms) => window.__plates.frameWindow(ms), 2000));
      }

      // ---- Turn back to lesson 1: usable, same run, no hidden advance. ----
      const back = ev(() =>
        window.__plates.until(() => {
          const d = document.querySelector(".gs-desk:not(.ps-desk)");
          return d?.dataset.source === "live" && d.dataset.transition === "done";
        }),
      );
      await page.getByRole("button", { name: "Turn to From V to U" }).click();
      const t1 = await lastInput();
      add(c === 0 ? "returnUsableFirstMs" : "returnUsableRepeatMs", (await back) - t1);
      const yearsBack = Number(await page.locator(deskSel).getAttribute("data-model-years"));
      (result.checks.returns ??= []).push({
        sameRun: (await page.locator(deskSel).getAttribute("data-run-id")) === run,
        yearsAtLeave,
        yearsOnReturn: yearsBack,
        playing: (await page.locator(deskSel).getAttribute("data-playing")) === "true",
      });
      result.memory.push({
        label: `after turn cycle ${c + 1}`,
        ...(await ev(() => ({
          heapMB: Math.round(performance.memory.usedJSHeapSize / 1e5) / 10,
          dom: document.getElementsByTagName("*").length,
        }))),
      });
      await page.waitForTimeout(1500);
    }
  } catch (error) {
    result.errors.push(`journey: ${error.stack ?? error}`);
  }
  result.finishedAt = new Date().toISOString();
  await context.close();
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `${result.startedAt.replace(/[:.]/g, "-")}-${index}.json`);
  writeFileSync(file, JSON.stringify(result, null, 1) + "\n");
  console.log(`rep ${index}: ${result.errors.length ? result.errors.join(" | ") : "ok"} → ${file}`);
}

function summarize() {
  const runs = readdirSync(OUT)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(OUT, f), "utf8")))
    .filter((r) => !r.headless);
  const pool = (get) => stats(runs.flatMap(get).filter((x) => x !== undefined && x !== null));
  const keys = [...new Set(runs.flatMap((r) => Object.keys(r.samples)))];
  const summary = {
    reps: runs.length,
    errors: runs.reduce((a, r) => a + r.errors.length, 0),
    sha: [...new Set(runs.map((r) => r.sha.slice(0, 7)))],
    chrome: [...new Set(runs.map((r) => r.chrome))],
    samples: Object.fromEntries(keys.map((k) => [k, pool((r) => r.samples[k] ?? [])])),
    frames: Object.fromEntries(
      ["transitionFirst", "play", "ghostsIdle"].flatMap((w) =>
        ["fps", "p95Ms", "maxMs", "over50"].map((m) => [`${w}.${m}`, pool((r) => [r.frames[w]?.[m]])]),
      ),
    ),
    returns: {
      sameRun: runs.flatMap((r) => r.checks.returns ?? []).filter((x) => x.sameRun).length,
      of: runs.flatMap((r) => r.checks.returns ?? []).length,
      advanceOnReturnYears: pool((r) =>
        (r.checks.returns ?? []).map((x) => x.yearsOnReturn - x.yearsAtLeave),
      ),
    },
    memory: runs.map((r) => r.memory.map((m) => `${m.heapMB} MB / ${m.dom} nodes`)),
  };
  writeFileSync(
    fileURLToPath(new URL("./turn-summary.json", import.meta.url)),
    JSON.stringify(summary, null, 1) + "\n",
  );
  console.log(JSON.stringify(summary, null, 1));
}

if (arg("summarize", false)) summarize();
else for (let i = 1; i <= REPS; i++) await rep(i);
