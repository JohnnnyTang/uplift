/* global document, window, performance, navigator, setTimeout */
/**
 * Session 6A2: the glacier batch-size measurements, in visible (headed) installed Chrome, with 6A's page
 * instrument (instrument.js) and 6A's method (fresh browser and profile per repetition, page-clock times,
 * window watchdog, frame-rate guard). It measures only what the batch size can change:
 *
 * - glacier playback at 1x and 4x: model years per real second and frame statistics;
 * - Pause: click → Play label shown, and click → the final live frame shown (the host has settled);
 * - scrub immediately after Pause with a kept run (6A miss 1): keydown → recorded moment shown;
 * - research departure while the glacier plays (first and repeat legs) and return, with the run checked.
 *
 * From the repository root:
 *
 *   pnpm build && pnpm --filter @uplift/book preview --host 127.0.0.1 --port 4190 --strictPort
 *   node docs/perf/batch-latency.mjs --label=after --backend=both --reps=5    # second terminal
 *   node docs/perf/batch-latency.mjs --summarize                             # pooled tables, every label
 *
 * Options: --backend=webgpu|cpu|both, --reps=N, --base=URL, --label=NAME (results/6a2/NAME/), --headless
 * (diagnostics only, never reported as a target-hardware result).
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
const ROOT = fileURLToPath(new URL("./results/6a2/", import.meta.url));
const QUERY = { webgpu: "/", cpu: "/?glacier=cpu&backend=cpu-worker" };
/** Pause-and-scrub cycles per repetition; each plays a different, fixed time so Pause lands at varied batch phases. */
const SCRUB_CYCLES = 12;
const NAV_CYCLES = 6;

function powershell(command) {
  try {
    return execFileSync("powershell.exe", ["-NoProfile", "-Command", command], { encoding: "utf8" }).trim();
  } catch (error) {
    return `error: ${error.message}`;
  }
}
function thermal() {
  const raw = powershell(
    "Get-Counter '\\Thermal Zone Information(*)\\Temperature' | Select-Object -ExpandProperty CounterSamples | ForEach-Object { '{0}={1}' -f $_.InstanceName, $_.CookedValue }",
  );
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .filter((l) => l.includes("="))
      .map((l) => {
        const [k, v] = l.split("=");
        return [k.trim(), Math.round(Number(v) - 273.15)];
      }),
  );
}
function machine() {
  const json = powershell(
    "$g=Get-CimInstance Win32_VideoController; $c=Get-CimInstance Win32_Processor; $b=Get-CimInstance Win32_Battery; $p=Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\User\\PowerSchemes'; [pscustomobject]@{ gpu=$g.Name; gpuDriver=$g.DriverVersion; display=('{0}x{1}@{2}Hz' -f $g.CurrentHorizontalResolution,$g.CurrentVerticalResolution,$g.CurrentRefreshRate); cpu=$c.Name; batteryStatus=$b.BatteryStatus; batteryPercent=$b.EstimatedChargeRemaining; powerScheme=$p.ActivePowerScheme; powerOverlayAc=$p.ActiveOverlayAcPowerScheme; os=[System.Environment]::OSVersion.VersionString } | ConvertTo-Json -Compress",
  );
  try {
    const m = JSON.parse(json);
    m.onAcPower = m.batteryStatus === 2;
    return m;
  } catch {
    return { error: json };
  }
}

async function run(backend, rep, base, out, headless) {
  const { chromium } = await import("@playwright/test");
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" });
  const profile = mkdtempSync(join(tmpdir(), "uplift-6a2-"));
  const result = {
    session: "6A2",
    sha,
    workingTreeClean: dirty.trim() === "",
    backend,
    rep,
    url: base + QUERY[backend],
    headless,
    startedAt: new Date().toISOString(),
    machine: machine(),
    thermalStart: thermal(),
    steps: {},
    samples: {},
    guards: [],
    interruptions: [],
    errors: [],
  };
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chrome",
    headless,
    viewport: null,
    args: ["--start-maximized"],
  });
  result.chrome = context.browser()?.version() ?? null;
  await context.addInitScript({ path: fileURLToPath(new URL("./instrument.js", import.meta.url)) });
  const page = context.pages()[0] ?? (await context.newPage());
  page.on("pageerror", (e) => result.errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") result.errors.push(`console: ${m.text()}`);
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  let watching = true;
  let lastGood = Date.now();
  const watchdog = (async () => {
    while (watching) {
      try {
        const { windowId } = await cdp.send("Browser.getWindowForTarget");
        const { bounds } = await cdp.send("Browser.getWindowBounds", { windowId });
        if (bounds.windowState === "minimized") {
          const from = lastGood;
          await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
          await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "maximized" } });
          await page.bringToFront();
          result.interruptions.push({ from, to: Date.now() + 1500 });
        } else lastGood = Date.now();
      } catch {
        /* navigating or closing */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  })();

  const desk = page.locator(".gs-desk");
  const years = async () => Number(await desk.getAttribute("data-model-years"));
  const ev = (fn, a) => page.evaluate(fn, a);
  const now = () => ev(() => performance.now());
  const add = (name, sample) => (result.samples[name] ??= []).push(sample);
  const windowStats = (t0, t1, attr) => ev(([a, b, c]) => window.__perf.window(a, b, c), [t0, t1, attr]);
  const lastInput = (types) =>
    ev((t) => [...window.__perf.inputs].reverse().find((e) => t.includes(e.type)) ?? null, types);

  async function respond(action, attr, test, inputTypes) {
    const [marks, inputs] = await ev(() => [window.__perf.marks.length, window.__perf.inputs.length]);
    await action();
    const handle = await page.waitForFunction(
      ([m, a, t]) => {
        const hit = window.__perf.findMark(m, a, t);
        return hit && hit !== "pending" ? hit : false;
      },
      [marks, attr, test],
      { polling: 25, timeout: 120_000 },
    );
    const mark = await handle.jsonValue();
    const input = await ev(([i, types]) => window.__perf.inputSince(i, types), [inputs, inputTypes]);
    return {
      origin: await ev(() => performance.timeOrigin),
      inputAt: Math.round(input.t),
      visibleMs: Math.round(mark.painted - input.t),
      value: mark.value,
    };
  }
  async function guard(phase) {
    let fps = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      await page.bringToFront();
      try {
        const { windowId } = await cdp.send("Browser.getWindowForTarget");
        await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "maximized" } });
      } catch {
        /* headless */
      }
      const t0 = await now();
      await page.waitForTimeout(600);
      fps = (await windowStats(t0, await now())).fps ?? 0;
      if (fps >= 50) break;
      await page.waitForTimeout(2000);
    }
    result.guards.push({ phase, fps, throttled: fps < 50 });
  }
  async function steadyWindow(ms) {
    const [mt0, t0, v0] = [(await cdp.send("Performance.getMetrics")).metrics, await now(), await years()];
    await page.waitForTimeout(ms);
    const [mt1, t1, v1] = [(await cdp.send("Performance.getMetrics")).metrics, await now(), await years()];
    const busy = (m) => m.find((x) => x.name === "TaskDuration").value;
    const wall = (t1 - t0) / 1000;
    return {
      ...(await windowStats(t0, t1)),
      valueStart: v0,
      valueEnd: v1,
      valuePerS: Math.round(((v1 - v0) / wall) * 100) / 100,
      mainThreadBusyPct: Math.round(((busy(mt1) - busy(mt0)) / wall) * 100),
    };
  }
  const playButton = () => page.getByRole("button", { name: "Play", exact: true });
  const pauseButton = () => page.getByRole("button", { name: "Pause", exact: true });
  async function play() {
    await playButton().click();
    await page.waitForSelector('.gs-desk[data-playing="true"]');
  }
  /**
   * Pause: click → Play label shown (`data-playing` false, painted), and click → final live frame shown: the
   * last `data-model-years` change within 1.5 s of the click (0 when the frame already matched the run).
   */
  async function pauseMeasured(sampleName) {
    const s = await respond(() => pauseButton().click(), "data-playing", { kind: "eq", value: "false" }, [
      "pointerup",
    ]);
    const click = s.inputAt;
    await page.waitForTimeout(1500);
    const settled = await ev((t) => {
      const ms = window.__perf.marks.filter(
        (m) => m.attr === "data-model-years" && (m.el ?? "").includes("gs-desk") && m.t >= t && m.painted,
      );
      return ms.length ? ms.at(-1).painted - t : 0;
    }, click);
    add(sampleName, { ...s, settledMs: Math.round(settled) });
  }
  const radio = (rock) => page.locator(".gs-tray").getByRole("radio", { name: new RegExp(rock, "i") });
  async function chooseNewRock() {
    const live = await desk.getAttribute("data-live-rock");
    const rock = ["sandstone", "shale", "granite"].find((r) => r !== live);
    await radio(rock).click();
    await page.waitForSelector(`.gs-desk[data-live-rock="${rock}"]`);
    await page.waitForTimeout(400);
  }

  try {
    await page.goto(base + QUERY[backend]);
    await page.waitForSelector('.gs-desk[data-source="live"][data-transition="done"]', { timeout: 180_000 });
    await page.waitForTimeout(1500);
    result.device = await ev(() => ({ userAgent: navigator.userAgent, origin: performance.timeOrigin }));

    // ---- 1. Playback at 1x then 4x (model years per second), then Pause measured. ----
    await guard("playback");
    await play();
    await page.waitForTimeout(1500);
    result.steps.play1x = await steadyWindow(6000);
    const speed = page.locator(".gs-speed input");
    await speed.focus();
    await page.keyboard.press("End");
    result.steps.speedMax = await speed.inputValue();
    await page.waitForTimeout(500);
    result.steps.play4x = await steadyWindow(4000);
    await pauseMeasured("pause");
    await speed.focus();
    await page.keyboard.press("Home");
    // 1x again: the slider's Home is the slowest speed; step up to 1x exactly as a reader would.
    for (let k = 0; k < 20 && (await speed.inputValue()) !== "1"; k++)
      await page.keyboard.press("ArrowRight");
    result.steps.speedAfter = await speed.inputValue();

    // ---- 2. Scrub immediately after Pause, with a kept run (the run above is kept by a new rock). ----
    await guard("scrub after pause");
    await chooseNewRock();
    const slider = page.getByRole("slider", { name: "Recorded time" });
    for (let c = 0; c < SCRUB_CYCLES; c++) {
      await play();
      await page.waitForTimeout(1200 + (c % 5) * 137);
      if (c % 2 === 0) {
        await pauseMeasured("pause");
        // Reader pauses, waits, then scrubs: the scrub itself is then not waiting on the pause.
      }
      const playing = (await desk.getAttribute("data-playing")) === "true";
      if (playing) {
        await pauseButton().click();
        await page.waitForSelector('.gs-desk[data-playing="false"]');
      }
      await slider.focus();
      add(
        playing ? "scrubAfterPause" : "scrubAfterSettledPause",
        await respond(() => page.keyboard.press("Home"), "data-model-years", { kind: "eq", value: "0" }, [
          "keydown",
        ]),
      );
      result.steps.ghostAtScrub ??= await desk.getAttribute("data-ghost");
      await page.getByRole("button", { name: "Back to the latest moment" }).click();
      await page.waitForSelector('.gs-desk[data-view="live"]');
      await page.waitForTimeout(300);
    }

    // ---- 3. Research departure while the glacier plays, and return (6A's legs). ----
    await chooseNewRock();
    await play();
    await page.waitForTimeout(1500);
    const before = {
      run: await desk.getAttribute("data-run-id"),
      rock: await desk.getAttribute("data-live-rock"),
    };
    for (let c = 0; c <= NAV_CYCLES; c++) {
      await guard(`navigation ${c}`);
      if (c > 0) {
        await page.waitForTimeout(1200 + (c % 3) * 211); // playing again since the return
      }
      await page.getByRole("button", { name: "Contents" }).click();
      const id = await ev(() => {
        const p = window.__perf;
        p.armed ??= [];
        const slot = { t: null, painted: null };
        p.armed.push(slot);
        const check = () => {
          const el = document.querySelector('[data-view="research"] .book');
          if (el && el.checkVisibility() && el.getBoundingClientRect().height > 0) {
            slot.t = performance.now();
            window.requestAnimationFrame(() => setTimeout(() => (slot.painted = performance.now()), 0));
          } else window.requestAnimationFrame(check);
        };
        check();
        return p.armed.length - 1;
      });
      await page.getByRole("button", { name: "Research example", exact: true }).click();
      const click = await lastInput(["pointerup"]);
      const painted = await (
        await page.waitForFunction((i) => window.__perf.armed[i].painted ?? false, id, { polling: 25 })
      ).jsonValue();
      const leg = { origin: await ev(() => performance.timeOrigin), inputAt: Math.round(click.t) };
      leg.visibleMs = Math.round(painted - click.t);
      if (c === 0) {
        // As in 6A: the research lesson's own terrain run, which keeps running while hidden.
        await page.waitForSelector('.book[data-backend-ready="true"]', { timeout: 180_000 });
        await page.getByRole("button", { name: "Lift the drawing", exact: true }).click();
        await page.waitForFunction(() => Number(document.querySelector(".book").dataset.step) > 0, null, {
          polling: 100,
          timeout: 120_000,
        });
        await page.waitForTimeout(3000);
      } else await page.waitForTimeout(800);
      await page.getByRole("button", { name: "Return to the book", exact: true }).click();
      await page.waitForSelector('[data-view="reader"] .gs-desk[data-source="live"][data-transition="done"]');
      await page.waitForTimeout(800);
      leg.sameRun = (await desk.getAttribute("data-run-id")) === before.run;
      leg.sameRock = (await desk.getAttribute("data-live-rock")) === before.rock;
      leg.playingAfterReturn = (await desk.getAttribute("data-playing")) === "true";
      add(c === 0 ? "departFirst" : "departRepeat", leg);
    }
  } catch (error) {
    result.errors.push(`journey: ${error.stack ?? error}`);
    await page.screenshot({ path: join(out, `failure-${backend}-${rep}.png`) }).catch(() => undefined);
  }
  watching = false;
  await watchdog;
  result.thermalEnd = thermal();
  result.finishedAt = new Date().toISOString();
  await context.close();
  rmSync(profile, { recursive: true, force: true });
  const file = join(out, `${result.startedAt.replace(/[:.]/g, "-")}-${backend}-${rep}.json`);
  writeFileSync(file, JSON.stringify(result, null, 1) + "\n");
  console.log(`${backend} rep ${rep}: ${result.errors.length ? result.errors.join(" | ") : "ok"} → ${file}`);
}

// ---- Summary: pooled per label and backend; samples overlapping a window interruption are dropped. ----
function summarize() {
  const pct = (xs, p) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : null;
  };
  const stat = (xs) =>
    xs.length ? { n: xs.length, median: pct(xs, 50), p90: pct(xs, 90), max: Math.max(...xs) } : null;
  const labels = readdirSync(ROOT).filter((d) => existsSync(join(ROOT, d)) && !d.endsWith(".json"));
  const summary = {};
  for (const label of labels) {
    const runs = readdirSync(join(ROOT, label))
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(ROOT, label, f), "utf8")))
      .filter((r) => !r.headless);
    for (const backend of ["webgpu", "cpu"]) {
      const mine = runs.filter((r) => r.backend === backend);
      if (!mine.length) continue;
      let dropped = 0;
      const ok = (r, s) => {
        const hit = (r.interruptions ?? []).some(
          (i) => s.origin + s.inputAt <= i.to && s.origin + s.inputAt + (s.visibleMs ?? 0) + 1500 >= i.from,
        );
        if (hit) dropped++;
        return !hit;
      };
      const okWindow = (r, w) =>
        w && !(r.interruptions ?? []).some((i) => w.origin + w.t0 <= i.to && w.origin + w.t1 >= i.from);
      const samples = (name, field = "visibleMs") =>
        mine.flatMap((r) => (r.samples[name] ?? []).filter((s) => ok(r, s)).map((s) => s[field]));
      const windows = (name, field) =>
        mine.filter((r) => okWindow(r, r.steps[name])).map((r) => field(r.steps[name]));
      summary[`${label}/${backend}`] = {
        reps: mine.length,
        errors: mine.reduce((n, r) => n + r.errors.length, 0),
        sha: [...new Set(mine.map((r) => r.sha.slice(0, 7)))],
        chrome: [...new Set(mine.map((r) => r.chrome))],
        driver: [...new Set(mine.map((r) => r.machine.gpuDriver))],
        onAcPower: mine.every((r) => r.machine.onAcPower),
        thermalC: [
          Math.min(
            ...mine.flatMap((r) => [...Object.values(r.thermalStart), ...Object.values(r.thermalEnd)]),
          ),
          Math.max(
            ...mine.flatMap((r) => [...Object.values(r.thermalStart), ...Object.values(r.thermalEnd)]),
          ),
        ],
        window: [
          mine.map((r) => r.startedAt).sort()[0],
          mine
            .map((r) => r.finishedAt)
            .sort()
            .at(-1),
        ],
        play1xYearsPerS: stat(windows("play1x", (w) => w.valuePerS)),
        play4xYearsPerS: stat(windows("play4x", (w) => w.valuePerS)),
        play1xFps: stat(windows("play1x", (w) => w.fps)),
        play1xP95FrameMs: stat(windows("play1x", (w) => w.frameMs.p95)),
        play1xMaxFrameMs: stat(windows("play1x", (w) => w.frameMs.max)),
        play4xFps: stat(windows("play4x", (w) => w.fps)),
        play4xMaxFrameMs: stat(windows("play4x", (w) => w.frameMs.max)),
        play1xMainThreadBusyPct: stat(windows("play1x", (w) => w.mainThreadBusyPct)),
        play1xLandformUpdatesPerS: stat(windows("play1x", (w) => w.updatesPerS)),
        pauseToPlayLabelMs: stat(samples("pause")),
        pauseToSettledFrameMs: stat(samples("pause", "settledMs")),
        scrubAfterPauseMs: stat(samples("scrubAfterPause")),
        scrubAfterSettledPauseMs: stat(samples("scrubAfterSettledPause")),
        departFirstMs: stat(samples("departFirst")),
        departRepeatMs: stat(samples("departRepeat")),
        runKeptAfterReturn: mine.every((r) =>
          [...(r.samples.departFirst ?? []), ...(r.samples.departRepeat ?? [])].every(
            (l) => l.sameRun && l.sameRock && l.playingAfterReturn,
          ),
        ),
        throttledGuards: mine.reduce((n, r) => n + r.guards.filter((g) => g.throttled).length, 0),
        droppedSamples: dropped,
      };
    }
  }
  writeFileSync(join(ROOT, "summary.json"), JSON.stringify(summary, null, 1) + "\n");
  const f = (s) => (s ? `${s.median} / ${s.p90} / ${s.max} (n ${s.n})` : "—");
  const rows = [
    ["Glacier model years per second, 1x", "play1xYearsPerS"],
    ["Glacier model years per second, 4x", "play4xYearsPerS"],
    ["Playback 1x: frames per second", "play1xFps"],
    ["Playback 1x: p95 frame interval (ms)", "play1xP95FrameMs"],
    ["Playback 1x: longest frame (ms)", "play1xMaxFrameMs"],
    ["Playback 4x: frames per second", "play4xFps"],
    ["Playback 4x: longest frame (ms)", "play4xMaxFrameMs"],
    ["Playback 1x: main thread busy (%)", "play1xMainThreadBusyPct"],
    ["Playback 1x: landform updates per second", "play1xLandformUpdatesPerS"],
    ["Pause: click to Play label shown (ms)", "pauseToPlayLabelMs"],
    ["Pause: click to final live frame shown (ms)", "pauseToSettledFrameMs"],
    ["Scrub right after Pause, kept run (ms)", "scrubAfterPauseMs"],
    ["Scrub 1.5 s after Pause, kept run (ms)", "scrubAfterSettledPauseMs"],
    ["Research departure while playing, first (ms)", "departFirstMs"],
    ["Research departure while playing, repeat (ms)", "departRepeatMs"],
  ];
  const keys = Object.keys(summary);
  console.log(`| Measure (median / p90 / max) | ${keys.join(" | ")} |`);
  console.log(`| --- | ${keys.map(() => "---").join(" | ")} |`);
  for (const [name, key] of rows)
    console.log(`| ${name} | ${keys.map((k) => f(summary[k][key])).join(" | ")} |`);
  for (const k of keys) {
    const {
      reps,
      errors,
      sha,
      chrome,
      driver,
      onAcPower,
      thermalC,
      window: w,
      runKeptAfterReturn,
    } = summary[k];
    const extra = { throttled: summary[k].throttledGuards, dropped: summary[k].droppedSamples };
    console.log(
      k,
      JSON.stringify({
        reps,
        errors,
        sha,
        chrome,
        driver,
        onAcPower,
        thermalC,
        w,
        runKeptAfterReturn,
        extra,
      }),
    );
  }
}

if (arg("summarize", false)) summarize();
else {
  const label = arg("label", "run");
  const out = join(ROOT, label);
  mkdirSync(out, { recursive: true });
  const backends = arg("backend", "both") === "both" ? ["webgpu", "cpu"] : [arg("backend")];
  const reps = Number(arg("reps", 5));
  for (let rep = 1; rep <= reps; rep++)
    for (const backend of backends)
      await run(backend, rep, arg("base", "http://127.0.0.1:4190"), out, arg("headless", false) === true);
}
