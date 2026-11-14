/* global document, window, performance, navigator, setTimeout */
/**
 * Session 6A: the complete reader journey, measured in visible (headed) installed Chrome.
 *
 * From the repository root:
 *
 *   pnpm build && pnpm --filter @uplift/book preview --host 127.0.0.1 --port 4190 --strictPort
 *   node docs/perf/measure.mjs --backend=both --reps=5          # in a second terminal
 *
 * Options:
 *   --backend=webgpu|cpu|both   webgpu: the default route (auto selection: WebGPU glacier, auto research terrain);
 *                               cpu: ?glacier=cpu&backend=cpu-worker (the CPU worker paths of both models)
 *   --reps=N                    repetitions per backend (each a fresh browser process and empty profile)
 *   --base=URL                  default http://127.0.0.1:4190
 *   --headless                  diagnostics only; never reported as a target-hardware result
 *   --out=DIR                   default docs/perf/results/raw
 *
 * Each repetition writes one JSON file as soon as it finishes. `summarize.mjs` turns them into the tables
 * in README.md. Every time is measured by the page itself (instrument.js), not by this script's polling.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import console from "node:console";
import { chromium } from "@playwright/test";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : true;
};
const BASE = arg("base", "http://127.0.0.1:4190");
const REPS = Number(arg("reps", 5));
const HEADLESS = arg("headless", false) === true;
const BACKENDS = arg("backend", "both") === "both" ? ["webgpu", "cpu"] : [arg("backend")];
const OUT = arg("out", fileURLToPath(new URL("./results/raw/", import.meta.url)));
const INSTRUMENT = fileURLToPath(new URL("./instrument.js", import.meta.url));
mkdirSync(OUT, { recursive: true });

const QUERY = { webgpu: "/", cpu: "/?glacier=cpu&backend=cpu-worker" };
/** Model years each run is played to: the registered matched time (100) for comparison; runs to the horizon on WebGPU. */
const MATCHED_YEARS = 100;
const REPEATED_RUNS = { webgpu: 6, cpu: 4 };
const REPEATED_RUN_YEARS = { webgpu: 300, cpu: 100 };
const NAV_CYCLES = 6;
/** Playback windows: 1x then 4x, short enough that a WebGPU run (10 and 40 model years per second) stays below the 300-year horizon. */
const PLAY_1X_MS = 6_000;
const PLAY_MAX_MS = 4_000;
const PLAY_WINDOW_MS = 10_000;

const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
  encoding: "utf8",
}).trim();

function powershell(command) {
  try {
    return execFileSync("powershell.exe", ["-NoProfile", "-Command", command], { encoding: "utf8" }).trim();
  } catch (error) {
    return `error: ${error.message}`;
  }
}
/** Thermal-zone temperatures (Kelvin, from the Windows performance counters; no administrator rights needed). */
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
        return [k.trim(), { kelvin: Number(v), celsius: Math.round(Number(v) - 273.15) }];
      }),
  );
}
function machine() {
  const json = powershell(
    "$g=Get-CimInstance Win32_VideoController; $c=Get-CimInstance Win32_Processor; $s=Get-CimInstance Win32_ComputerSystem; $b=Get-CimInstance Win32_Battery; $p=Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\User\\PowerSchemes'; [pscustomobject]@{ gpu=$g.Name; gpuDriver=$g.DriverVersion; gpuDriverDate=$g.DriverDate.ToString('yyyy-MM-dd'); display=('{0}x{1}@{2}Hz' -f $g.CurrentHorizontalResolution,$g.CurrentVerticalResolution,$g.CurrentRefreshRate); cpu=$c.Name; model=('{0} {1}' -f $s.Manufacturer,$s.Model); ramBytes=$s.TotalPhysicalMemory; batteryStatus=$b.BatteryStatus; batteryPercent=$b.EstimatedChargeRemaining; powerScheme=$p.ActivePowerScheme; powerOverlayAc=$p.ActiveOverlayAcPowerScheme; os=[System.Environment]::OSVersion.VersionString } | ConvertTo-Json -Compress",
  );
  try {
    const m = JSON.parse(json);
    // Win32_Battery.BatteryStatus 2 = on AC power. Overlay ded574b5-… = Windows power mode "Best performance".
    m.onAcPower = m.batteryStatus === 2;
    return m;
  } catch {
    return { error: json };
  }
}
/** Working set and private bytes of this browser's processes (identified by the profile directory). */
function processMemory(profileDir) {
  const raw = powershell(
    `$d='${profileDir.replace(/'/g, "''")}'; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*$d*" } | ForEach-Object { '{0}|{1}|{2}|{3}' -f ([regex]::Match($_.CommandLine,'--type=([\\w-]+)').Groups[1].Value), $_.ProcessId, $_.WorkingSetSize, $_.PrivatePageCount }`,
  );
  const rows = raw
    .split(/\r?\n/)
    .filter((l) => l.includes("|"))
    .map((l) => {
      const [type, pid, ws, priv] = l.split("|");
      return { type: type || "browser", pid: Number(pid), ws: Number(ws), priv: Number(priv) };
    });
  const renderers = rows.filter((r) => r.type === "renderer").sort((a, b) => b.priv - a.priv);
  const gpu = rows.find((r) => r.type === "gpu-process");
  const mb = (x) => (x === undefined ? null : Math.round((x / 2 ** 20) * 10) / 10);
  return {
    rendererLargest: {
      pid: renderers[0]?.pid ?? null,
      wsMB: mb(renderers[0]?.ws),
      privateMB: mb(renderers[0]?.priv),
    },
    gpuProcess: { wsMB: mb(gpu?.ws), privateMB: mb(gpu?.priv) },
    totalPrivateMB: mb(rows.reduce((s, r) => s + r.priv, 0)),
  };
}

async function run(backend, rep) {
  const profile = mkdtempSync(join(tmpdir(), "uplift-6a-"));
  const result = {
    session: "6A",
    sha,
    workingTreeClean: dirty === "",
    backend,
    rep,
    url: BASE + QUERY[backend],
    headless: HEADLESS,
    startedAt: new Date().toISOString(),
    machine: machine(),
    thermalStart: thermal(),
    steps: {},
    samples: {},
    memory: [],
    checks: {},
    guards: [],
    interruptions: [],
    errors: [],
  };
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chrome",
    headless: HEADLESS,
    viewport: null,
    args: ["--start-maximized"],
  });
  const browser = context.browser();
  result.chrome = browser?.version() ?? null;
  await context.addInitScript({ path: INSTRUMENT });
  const page = context.pages()[0] ?? (await context.newPage());
  page.on("pageerror", (e) => result.errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") result.errors.push(`console: ${m.text()}`);
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const bcdp = browser ? await browser.newBrowserCDPSession() : null;
  result.commandLine = bcdp
    ? (await bcdp.send("Browser.getBrowserCommandLine").catch(() => null))?.arguments
    : null;

  /**
   * Keep-visible watchdog. A minimised window is throttled to about one frame per second. Every 500 ms this
   * checks the window state; a minimised window is restored and maximised, and the interval (epoch ms, from
   * the last good check to 1.5 s after the restore) is logged in `interruptions`. summarize.mjs drops every
   * sample and window that overlaps one.
   */
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
          result.interruptions.push({ from, to: Date.now() + 1500, state: bounds.windowState });
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
  const add = (name, sample) => {
    (result.samples[name] ??= []).push(sample);
    return sample;
  };

  /** Runs `action` and measures input → app state change → next produced frame, all on the page clock. */
  async function respond(action, attr, test, inputTypes, timeout = 120_000) {
    const [marks, inputs] = await ev(() => [window.__perf.marks.length, window.__perf.inputs.length]);
    await action();
    const handle = await page.waitForFunction(
      ([m, a, t]) => {
        const hit = window.__perf.findMark(m, a, t);
        return hit && hit !== "pending" ? hit : false;
      },
      [marks, attr, test],
      { polling: 25, timeout },
    );
    const mark = await handle.jsonValue();
    const input = await ev(([i, types]) => window.__perf.inputSince(i, types), [inputs, inputTypes]);
    if (!input) throw new Error(`no ${inputTypes} input recorded for ${attr}`);
    return {
      origin: await ev(() => performance.timeOrigin),
      inputAt: Math.round(input.t),
      domMs: Math.round(mark.t - input.t),
      visibleMs: Math.round(mark.painted - input.t),
      value: mark.value,
    };
  }
  /** Arms a page-side check for `selector` becoming visible; `done()` resolves to its produced-frame time. */
  async function armVisible(selector) {
    const id = await ev((sel) => {
      const p = window.__perf;
      p.armed ??= [];
      const slot = { sel, t: null, painted: null };
      p.armed.push(slot);
      const check = () => {
        const el = document.querySelector(sel);
        if (el && el.isConnected && el.checkVisibility() && el.getBoundingClientRect().height > 0) {
          slot.t = performance.now();
          window.requestAnimationFrame(() => setTimeout(() => (slot.painted = performance.now()), 0));
        } else window.requestAnimationFrame(check);
      };
      check();
      return p.armed.length - 1;
    }, selector);
    return {
      done: async (timeout = 120_000) => {
        const h = await page.waitForFunction((i) => window.__perf.armed[i].painted ?? false, id, {
          polling: 25,
          timeout,
        });
        return h.jsonValue();
      },
    };
  }
  const lastInput = (types) =>
    ev((t) => [...window.__perf.inputs].reverse().find((e) => t.includes(e.type)) ?? null, types);
  const windowStats = (t0, t1, attr) => ev(([a, b, c]) => window.__perf.window(a, b, c), [t0, t1, attr]);
  const now = () => ev(() => performance.now());
  /**
   * Visible-window guard: brings the window to the front and checks that Chrome produces frames at the display
   * rate before a measured phase. A covered, minimised or unfocused window is throttled (about 1 frame per
   * second here); such phases are recorded with `throttled: true` and excluded by summarize.mjs.
   */
  async function guard(phase) {
    let fps = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      await page.bringToFront();
      try {
        const { windowId } = await cdp.send("Browser.getWindowForTarget");
        await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "maximized" } });
      } catch {
        /* window control unavailable (headless) */
      }
      const t0 = await now();
      await page.waitForTimeout(600);
      fps = (await windowStats(t0, await now())).fps ?? 0;
      if (fps >= 50) break;
      await page.waitForTimeout(2000);
    }
    const g = { phase, fps, throttled: fps < 50, visibility: await ev(() => document.visibilityState) };
    result.guards.push(g);
    return g;
  }
  async function cpuTimes() {
    if (!bcdp) return null;
    const info = await bcdp.send("SystemInfo.getProcessInfo").catch(() => null);
    if (!info) return null;
    const sums = {};
    for (const p of info.processInfo) sums[p.type] = (sums[p.type] ?? 0) + p.cpuTime;
    return sums;
  }
  async function mainThread() {
    const { metrics } = await cdp.send("Performance.getMetrics");
    return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
  }
  /** Measures a window of `ms` while whatever is running keeps running. */
  async function steadyWindow(ms, attr = "data-model-years", read = years) {
    const [cpu0, mt0, t0, v0] = [await cpuTimes(), await mainThread(), await now(), await read()];
    await page.waitForTimeout(ms);
    const [cpu1, mt1, t1, v1] = [await cpuTimes(), await mainThread(), await now(), await read()];
    const wall = (t1 - t0) / 1000;
    const cpu =
      cpu0 && cpu1
        ? Object.fromEntries(
            Object.keys(cpu1).map((k) => [k, Math.round(((cpu1[k] - (cpu0[k] ?? 0)) / wall) * 100)]),
          )
        : null;
    return {
      ...(await windowStats(t0, t1, attr)),
      valueStart: v0,
      valueEnd: v1,
      valuePerS: Math.round(((v1 - v0) / wall) * 100) / 100,
      mainThreadBusyPct: Math.round(((mt1.TaskDuration - mt0.TaskDuration) / wall) * 100),
      cpuPctByProcessType: cpu,
    };
  }
  async function memory(label, extra = {}) {
    await cdp.send("HeapProfiler.collectGarbage");
    const heap = await cdp.send("Runtime.getHeapUsage");
    const dom = await cdp.send("Memory.getDOMCounters");
    const sample = {
      label,
      ...extra,
      jsHeapUsedMB: Math.round((heap.usedSize / 2 ** 20) * 10) / 10,
      domNodes: dom.nodes,
      listeners: dom.jsEventListeners,
      documents: dom.documents,
      process: processMemory(profile),
    };
    result.memory.push(sample);
    return sample;
  }
  async function playUntil(target, statusDone = false) {
    if ((await desk.getAttribute("data-playing")) !== "true")
      await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForFunction(
      ([t, s]) => {
        const d = document.querySelector(".gs-desk");
        return Number(d.dataset.modelYears) >= t || (s && d.dataset.runStatus === "complete");
      },
      [target, statusDone],
      { polling: 200, timeout: 600_000 },
    );
    const pause = page.getByRole("button", { name: "Pause", exact: true });
    if (await pause.isVisible().catch(() => false)) await pause.click();
    await page.waitForSelector('.gs-desk[data-playing="false"]', { timeout: 60_000 });
  }
  async function dropSpecimen(rock) {
    const chip = await page.locator(`.gs-specimen[data-rock="${rock}"]`).boundingBox();
    const outline = (await ev(() => document.querySelector(".gs-desk").blockScreenGeometry())).outline;
    const to = {
      x: outline.reduce((s, p) => s + p.x, 0) / outline.length,
      y: outline.reduce((s, p) => s + p.y, 0) / outline.length,
    };
    const from = { x: chip.x + 12, y: chip.y + chip.height / 2 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++)
      await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
    await page.waitForSelector(".gs-drop-overlay[data-active]", { timeout: 10_000 });
    await page.mouse.up();
  }
  const radio = (rock) => page.locator(".gs-tray").getByRole("radio", { name: new RegExp(rock, "i") });
  async function chooseByPage(rock, sampleName) {
    const s = await respond(() => radio(rock).click(), "data-live-rock", { kind: "eq", value: rock }, [
      "pointerup",
    ]);
    add(sampleName, s);
    await page.waitForTimeout(400);
    return s;
  }
  async function chooseByDrop(rock, sampleName) {
    const s = await respond(() => dropSpecimen(rock), "data-live-rock", { kind: "eq", value: rock }, [
      "pointerup",
    ]);
    add(sampleName, s);
    await page.waitForTimeout(400);
    return s;
  }
  async function scrubKeys(toYears, sampleName) {
    const slider = page.getByRole("slider", { name: "Recorded time" });
    await slider.focus();
    const atZero = (await years()) === 0 && (await desk.getAttribute("data-view")) === "past";
    if (!atZero)
      add(
        sampleName,
        await respond(() => page.keyboard.press("Home"), "data-model-years", { kind: "eq", value: "0" }, [
          "keydown",
        ]),
      );
    for (let y = 20; y <= toYears; y += 20)
      add(
        sampleName,
        await respond(
          () => page.keyboard.press("ArrowRight"),
          "data-model-years",
          { kind: "eq", value: String(y) },
          ["keydown"],
        ),
      );
  }
  /** Startup from navigation start, read from the page's own clock once the scene is usable. */
  async function startup(kind) {
    await page.waitForSelector('.gs-desk[data-source="live"][data-transition="done"]', { timeout: 180_000 });
    await page.waitForTimeout(1500);
    return ev((k) => {
      const p = window.__perf;
      const nav = performance.getEntriesByType("navigation")[0];
      const first = (attr, value, el = "gs-desk") =>
        p.marks.find((m) => m.attr === attr && m.value === value && (m.el ?? "").includes(el));
      const running = first("data-transition", "running");
      const done = first("data-transition", "done");
      const live = first("data-source", "live");
      const ready = first("data-ready", "true");
      const resources = performance.getEntriesByType("resource");
      const r = (x) => (x === null || x === undefined ? null : Math.round(x));
      const interactive = Math.max(done?.painted ?? 0, live?.painted ?? 0);
      return {
        kind: k,
        origin: performance.timeOrigin,
        responseEndMs: r(nav?.responseEnd),
        domContentLoadedMs: r(nav?.domContentLoadedEventEnd),
        loadMs: r(nav?.loadEventEnd),
        fcpMs: r(p.paints["first-contentful-paint"]),
        lcpMs: r(p.lcp.at(-1)?.t),
        lcpElement: p.lcp.at(-1)?.el ?? null,
        drawingVisibleMs: r(p.drawingAt?.painted),
        stageReadyMs: r(ready?.painted),
        liveSourceMs: r(live?.painted),
        transitionStartMs: r(running?.t),
        transitionDoneMs: r(done?.painted),
        transitionMs: running && done ? r(done.t - running.t) : null,
        interactiveMs: r(interactive),
        startupWindow: p.window(0, interactive),
        transitionWindow: running && done ? p.window(running.t, done.t) : null,
        requests: resources.length + 1,
        transferKB: r((resources.reduce((s, e) => s + e.transferSize, 0) + (nav?.transferSize ?? 0)) / 1024),
        decodedKB: r(
          (resources.reduce((s, e) => s + e.decodedBodySize, 0) + (nav?.decodedBodySize ?? 0)) / 1024,
        ),
        resources: resources.map((e) => ({
          name: e.name.replace(/^.*\/\/[^/]+/, ""),
          start: r(e.startTime),
          end: r(e.responseEnd),
          transferB: e.transferSize,
          decodedB: e.decodedBodySize,
        })),
        visibility: document.visibilityState,
        focused: document.hasFocus(),
        viewport: [window.innerWidth, window.innerHeight, window.devicePixelRatio],
      };
    }, kind);
  }

  try {
    // ---- 1. Cold start: fresh browser process, empty profile and cache. ----
    await page.goto(BASE + QUERY[backend]);
    result.steps.startupCold = await startup("cold");
    result.device = await ev(async () => {
      const a = await navigator.gpu?.requestAdapter();
      return {
        userAgent: navigator.userAgent,
        webgpuAdapter: a
          ? {
              vendor: a.info.vendor,
              architecture: a.info.architecture,
              device: a.info.device,
              description: a.info.description,
            }
          : null,
        stageRenderer: document.querySelector(".gs-desk").dataset.backend,
        hardwareConcurrency: navigator.hardwareConcurrency,
      };
    });
    await guard("idle");
    result.steps.idle = await steadyWindow(3000);
    await memory("after startup");

    // ---- 2. First interaction and rock choice before the run advances (replaces the unadvanced run). ----
    await guard("rock choice");
    for (const rock of ["shale", "granite", "sandstone", "shale"])
      await chooseByPage(rock, "rockSelectReplace");
    result.steps.firstInteraction = result.samples.rockSelectReplace[0];
    for (const rock of ["granite", "sandstone", "shale"]) await chooseByDrop(rock, "rockDropReplace");

    // ---- 3. Direct manipulation that never touches the model: the front face (keyboard twin) and the camera. ----
    await guard("manipulation");
    const cut = page.getByRole("slider", { name: "Front face" });
    await cut.focus();
    for (let k = 0; k < 5; k++)
      add(
        "cutKey",
        await respond(() => page.keyboard.press("ArrowLeft"), "data-cut-column", { kind: "any" }, [
          "keydown",
        ]),
      );
    {
      // On the desk beside the book: the orbit ignores presses on text regions and controls (view-controls.ts).
      const deskbox = await desk.boundingBox();
      const start = { x: deskbox.x + 60, y: deskbox.y + deskbox.height * 0.5 };
      const t0 = await now();
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      for (let i = 1; i <= 60; i++) {
        await page.mouse.move(start.x + Math.sin(i / 10) * 120, start.y - Math.min(i, 30) * 2);
        await page.waitForTimeout(16);
      }
      await page.mouse.up();
      const t1 = await now();
      result.steps.orbitDrag = await windowStats(t0, t1);
      await page.getByRole("button", { name: "Reset view" }).click();
      await page.waitForTimeout(400);
    }

    // ---- 4. Playback at 1x and at the fastest speed. ----
    await guard("playback");
    add(
      "playStart",
      await respond(
        () => page.getByRole("button", { name: "Play", exact: true }).click(),
        "data-playing",
        { kind: "eq", value: "true" },
        ["pointerup"],
      ),
    );
    {
      const click = await lastInput(["pointerup"]);
      const firstAdvance = await page.waitForFunction(
        (since) =>
          window.__perf.marks.find(
            (m) => m.attr === "data-model-years" && Number(m.value) > 0 && m.t > since && m.painted,
          ) ?? false,
        click.t,
        { polling: 25, timeout: 120_000 },
      );
      const m = await firstAdvance.jsonValue();
      result.steps.firstAdvanceVisibleMs = Math.round(m.painted - click.t);
    }
    result.steps.play1x = await steadyWindow(PLAY_1X_MS);
    const speed = page.locator(".gs-speed input");
    await speed.focus();
    await page.keyboard.press("End");
    result.steps.speedMax = await speed.inputValue();
    result.steps.playMax = await steadyWindow(PLAY_MAX_MS);
    await playUntil(MATCHED_YEARS);
    add("pause", { settledYears: await years() });

    // ---- 5. Scrubbing the recorded past (keyboard steps, then a pointer sweep), and back to live. ----
    await guard("scrub");
    await scrubKeys(MATCHED_YEARS, "scrubKey");
    {
      const slider = page.getByRole("slider", { name: "Recorded time" });
      const box = await slider.boundingBox();
      const t0 = await now();
      await page.mouse.move(box.x + 2, box.y + box.height / 2);
      await page.mouse.down();
      for (let i = 0; i <= 40; i++) {
        await page.mouse.move(box.x + 2 + ((box.width - 4) * (i % 21)) / 20, box.y + box.height / 2);
        await page.waitForTimeout(16);
      }
      await page.mouse.up();
      const t1 = await now();
      result.steps.scrubSweep = await windowStats(t0, t1);
    }
    add(
      "backToLive",
      await respond(
        () => page.getByRole("button", { name: "Back to the latest moment" }).click(),
        "data-view",
        { kind: "eq", value: "live" },
        ["pointerup"],
      ),
    );

    // ---- 6. A second rock by the 3D drop after the run advanced (new run, the first is kept); compare at matched time. ----
    await guard("comparison");
    await chooseByDrop("granite", "rockDropNewRun");
    result.checks.ghostAfterDrop = await desk.getAttribute("data-ghost");
    await playUntil(MATCHED_YEARS);
    await scrubKeys(MATCHED_YEARS, "scrubCompare");
    result.checks.matched = {
      years: await years(),
      ghost: await desk.getAttribute("data-ghost"),
      compareNote: await page
        .locator('.gs-margin [data-note="compare"]')
        .innerText()
        .catch(() => null),
    };
    for (let k = 0; k < 2; k++) {
      add(
        "compareToggle",
        await respond(
          () => page.locator(".gs-compare input[value='']").click(),
          "data-ghost",
          { kind: "eq", value: "" },
          ["pointerup"],
        ),
      );
      add(
        "compareToggle",
        await respond(
          () => page.locator(".gs-compare input").first().click(),
          "data-ghost",
          { kind: "ne", value: "" },
          ["pointerup"],
        ),
      );
    }
    await page.getByRole("button", { name: "Back to the latest moment" }).click();
    await page.waitForSelector('.gs-desk[data-view="live"]');

    // ---- 7. Snapshot memory over repeated runs (page selector after advance: new runs, kept runs bounded). ----
    await guard("repeated runs");
    const cycle = ["sandstone", "shale", "granite"];
    for (let i = 0; i < REPEATED_RUNS[backend]; i++) {
      const rock = cycle[i % 3];
      if ((await desk.getAttribute("data-live-rock")) === rock) continue;
      await chooseByPage(rock, "rockSelectNewRun");
      await playUntil(REPEATED_RUN_YEARS[backend], true);
      await memory(`after run ${i + 1}`, {
        run: i + 1,
        modelYears: await years(),
        kept: Math.max(0, (await page.locator(".gs-compare input").count()) - 1),
      });
    }

    // ---- 8. Research departure while the glacier plays, the research terrain, return; repeated navigation. ----
    const live = await desk.getAttribute("data-live-rock");
    await chooseByPage(
      cycle.find((r) => r !== live),
      "rockSelectNewRun",
    );
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForSelector('.gs-desk[data-playing="true"]');
    await page.waitForTimeout(1500);
    const before = {
      run: await desk.getAttribute("data-run-id"),
      rock: await desk.getAttribute("data-live-rock"),
      ghost: await desk.getAttribute("data-ghost"),
    };
    for (let c = 0; c <= NAV_CYCLES; c++) {
      const leg = { guard: await guard(`navigation ${c}`) };
      await page.getByRole("button", { name: "Contents" }).click();
      const there = await armVisible('[data-view="research"] .book');
      const t0 = await now();
      await page.getByRole("button", { name: "Research example", exact: true }).click();
      const departClick = await lastInput(["pointerup"]);
      const painted = await there.done();
      leg.departVisibleMs = Math.round(painted - departClick.t);
      const yearsAtLeave = await ev(() => {
        const marks = window.__perf.marks.filter(
          (m) => m.attr === "data-model-years" && (m.el ?? "").includes("gs-desk"),
        );
        return marks.length ? Number(marks.at(-1).value) : null;
      });
      if (c === 0) {
        await page.waitForSelector('.book[data-backend-ready="true"]', { timeout: 180_000 });
        leg.researchReadyMs = Math.round((await now()) - departClick.t);
        result.research = await ev(() => {
          const b = document.querySelector(".book");
          return {
            backend: b.dataset.backend,
            grid: Number(b.dataset.grid),
            failures: b.dataset.backendFailures,
          };
        });
        // The research lesson's own lift and run (the retained terrain backend).
        const lift = page.getByRole("button", { name: "Lift the drawing", exact: true });
        await lift.click();
        await page.waitForFunction(() => Number(document.querySelector(".book").dataset.step) > 0, null, {
          polling: 100,
          timeout: 120_000,
        });
        const stepOf = async () => Number(await page.locator(".book").getAttribute("data-step"));
        await page.waitForTimeout(1500);
        result.steps.researchPlay = await steadyWindow(PLAY_WINDOW_MS, "data-step", stepOf);
        result.steps.researchPlay.batch = await ev(() => {
          const d = document.querySelector(".book").dataset;
          return {
            batchSteps: Number(d.batchSteps),
            batchMs: Number(d.batchMs),
            workerMs: Number(d.workerMs),
            snapshotMs: Number(d.snapshotMs),
            viewUpdateMs: Number(d.viewUpdateMs ?? NaN),
          };
        });
      }
      const t1 = await now();
      leg.departWindow = await windowStats(t0, t1);
      const back = await armVisible(
        '[data-view="reader"] .gs-desk[data-source="live"][data-transition="done"]',
      );
      const t2 = await now();
      await page.getByRole("button", { name: "Return to the book", exact: true }).click();
      const returnClick = await lastInput(["pointerup"]);
      leg.returnVisibleMs = Math.round((await back.done()) - returnClick.t);
      await page.waitForTimeout(800);
      leg.returnWindow = await windowStats(t2, await now());
      const yearsAtReturn = await ev((since) => {
        const m = window.__perf.marks.find(
          (x) => x.attr === "data-model-years" && x.t > since && (x.el ?? "").includes("gs-desk"),
        );
        return m ? Number(m.value) : Number(document.querySelector(".gs-desk").dataset.modelYears);
      }, returnClick.t);
      leg.state = {
        sameRun: (await desk.getAttribute("data-run-id")) === before.run,
        sameRock: (await desk.getAttribute("data-live-rock")) === before.rock,
        sameGhost: (await desk.getAttribute("data-ghost")) === before.ghost,
        yearsAtLeave,
        yearsAtReturn,
        noHiddenAdvance: yearsAtLeave === null || yearsAtReturn === yearsAtLeave,
      };
      add(c === 0 ? "navFirst" : "navRepeat", leg);
      await memory(`after navigation ${c}`, { cycle: c });
    }

    // ---- 9. Backend read-back (the deeper level, university reading; words only, the run is untouched). ----
    await page.getByRole("button", { name: "University level" }).click();
    await page.waitForTimeout(500);
    result.glacierSolver = await ev(
      () => /Solver: (\w+)/.exec(document.querySelector(".gs-deeper")?.textContent ?? "")?.[1] ?? null,
    );
    await page.getByRole("button", { name: "University level" }).click();

    // ---- 10. Warm start (same browser: HTTP and shader caches) and leaving the page while a run plays. ----
    await guard("warm start");
    await page.reload();
    result.steps.startupWarm = await startup("warm");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForTimeout(2000);
    {
      const t = Date.now();
      await page.goto("about:blank");
      result.steps.leavePageWallMs = Date.now() - t;
    }
  } catch (error) {
    result.errors.push(`journey: ${error.stack ?? error}`);
    await page.screenshot({ path: join(OUT, `failure-${backend}-${rep}.png`) }).catch(() => undefined);
  }
  watching = false;
  await watchdog;
  result.thermalEnd = thermal();
  result.finishedAt = new Date().toISOString();
  await context.close();
  rmSync(profile, { recursive: true, force: true });
  const file = join(OUT, `${result.startedAt.replace(/[:.]/g, "-")}-${backend}-${rep}.json`);
  writeFileSync(file, JSON.stringify(result, null, 1) + "\n");
  console.log(
    `${backend} rep ${rep}: ${result.errors.length ? `${result.errors.length} errors` : "ok"} → ${file}`,
  );
  return result;
}

for (let rep = 1; rep <= REPS; rep++) for (const backend of BACKENDS) await run(backend, rep);
