/**
 * Session 5J browser tests: runs, time and comparison (wave plan §4) in a real Worker, on the reference grid.
 * Fixture: e2e/fixtures/glacial-runtime.html. Evidence: e2e/fixtures/glacial-runtime-evidence.json and
 * docs/review/glacial/runtime/README.md.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { format, resolveConfig } from "prettier";
import type { GlacialHost } from "../hachure/runtime/src/glacial-host/index";

test.use({ launchOptions: { args: ["--enable-unsafe-webgpu"] } });
test.setTimeout(120_000);

const origin =
  process.env.READER_FIXTURE_ORIGIN ?? `http://127.0.0.1:${process.env.UPLIFT_FIXTURE_PORT ?? "4174"}`;

interface RunView {
  id: string;
  ordinal: number;
  rockId: string;
  backend: string;
  fallbackReason: string | null;
  status: string;
  step: number;
  hashes: string[];
  recordedBytes: number;
  clampedValues: number;
}
interface FixtureState {
  readiness: string;
  error: string | null;
  activity: string;
  departed: boolean;
  speed: number;
  rockId: string;
  backend: string | null;
  fallbackReason: string | null;
  live: RunView | null;
  kept: RunView[];
  view: { kind: string; index?: number; ofLiveRun?: boolean };
  viewLabel: string | null;
  viewStep: number | null;
  compareRunId: string | null;
  comparison: { status: string; label: string } | null;
  notice: { kind: string; ordinal?: number } | null;
  offer: { kind: string } | null;
  memoryBytes: number;
  memoryBudgetBytes: number;
  level: string;
}

const EVIDENCE = "e2e/fixtures/glacial-runtime-evidence.json";
const BROWSER = process.env.UPLIFT_E2E_CHANNEL ?? "playwright-chromium";
/** Merges one finding into the evidence file, per browser (each test records its own; a rerun replaces it). */
async function record(key: string, value: unknown) {
  const current = existsSync(EVIDENCE)
    ? (JSON.parse(readFileSync(EVIDENCE, "utf8")) as Record<string, Record<string, unknown>>)
    : {};
  const browsers = (current.browsers ?? {}) as Record<string, Record<string, unknown>>;
  const next = {
    session: "5J",
    browsers: { ...browsers, [BROWSER]: { ...browsers[BROWSER], [key]: value } },
  };
  // Prettier-formatted, so a rerun keeps `pnpm format:check` green.
  writeFileSync(
    EVIDENCE,
    await format(JSON.stringify(next), {
      ...(await resolveConfig(EVIDENCE)),
      parser: "json",
      filepath: EVIDENCE,
    }),
  );
}

/** Optional stress knob: `GLACIAL_E2E_CPU_THROTTLE=4` slows the page's main thread 4× (CDP). Off by default. */
const CPU_THROTTLE = Number(process.env.GLACIAL_E2E_CPU_THROTTLE ?? "1");
const throttled = new WeakSet<Page>();

async function open(page: Page, query = "") {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (CPU_THROTTLE > 1 && !throttled.has(page)) {
    throttled.add(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });
  }
  await page.goto(`${origin}/e2e/fixtures/glacial-runtime.html${query}`);
  await expect(page.locator("body"))
    .toHaveAttribute("data-ready", "ready", { timeout: 60_000 })
    .catch(async (error: Error) => {
      throw new Error(
        `${query}: ${errors.join("; ")} ${await page.locator("#error").textContent()} ${error.message}`,
      );
    });
  return errors;
}
async function state(page: Page): Promise<FixtureState> {
  return JSON.parse((await page.locator("#state").textContent()) ?? "null") as FixtureState;
}
async function until(page: Page, predicate: (s: FixtureState) => boolean, timeout = 60_000) {
  await expect.poll(async () => predicate(await state(page)), { timeout }).toBe(true);
  return state(page);
}
async function idle(page: Page) {
  await page.evaluate(() =>
    (window as unknown as { glacialFixture: { host: GlacialHost } }).glacialFixture.host.whenIdle(),
  );
}
/**
 * The page's WebGPU adapter as the browser describes it. Software adapters (SwiftShader, llvmpipe, lavapipe,
 * WARP or any adapter flagged as a fallback) are correct but far slower. CI's bundled Chromium on Linux offers
 * one, and auto selection may use it when it passes the device check.
 */
async function webgpuAdapter(page: Page): Promise<{ available: boolean; software: boolean; label: string }> {
  return page.evaluate(async () => {
    type Info = {
      vendor?: string;
      architecture?: string;
      device?: string;
      description?: string;
      isFallbackAdapter?: boolean;
    };
    const gpu = (
      navigator as unknown as {
        gpu?: { requestAdapter(): Promise<{ info?: Info; isFallbackAdapter?: boolean } | null> };
      }
    ).gpu;
    const adapter = await gpu?.requestAdapter().catch(() => null);
    if (!adapter) return { available: false, software: false, label: "none" };
    const info = adapter.info ?? {};
    const label = [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(" / ");
    const software =
      info.isFallbackAdapter === true ||
      adapter.isFallbackAdapter === true ||
      /swiftshader|llvmpipe|lavapipe|softpipe|software|microsoft basic render|warp/i.test(label);
    return { available: true, software, label };
  });
}
async function commands(page: Page) {
  return page.evaluate(
    () => (window as unknown as { glacialFixture: { commands: unknown[] } }).glacialFixture.commands,
  );
}

test("the page selector and the specimen drop send one rock command, while paused and while running", async ({
  page,
}) => {
  const errors = await open(page);
  let s = await state(page);
  expect(s).toMatchObject({ backend: "cpu", rockId: "sandstone", activity: "paused", kept: [] });
  expect(s.live).toMatchObject({ ordinal: 1, step: 0 });

  // Before any run: the selector just sets the rock.
  await page.getByLabel("granite", { exact: true }).click();
  s = await until(page, (x) => x.rockId === "granite" && x.activity === "paused");
  expect(s.kept).toEqual([]);
  expect(s.live).toMatchObject({ ordinal: 1, rockId: "granite", step: 0 });

  // While paused, after the run has advanced: a new run, the first kept unchanged.
  await page.getByRole("button", { name: "Step to next recorded time" }).click();
  s = await until(page, (x) => x.live?.step === 100 && x.activity === "paused");
  const granite = s.live!;
  await page.getByLabel("shale", { exact: true }).click();
  s = await until(page, (x) => x.rockId === "shale");
  expect(s.activity).toBe("paused");
  expect(s.kept).toEqual([granite]);
  expect(s.live).toMatchObject({ ordinal: 2, rockId: "shale", step: 0 });
  expect(s.compareRunId).toBe(granite.id);

  // While running: the specimen dropped on the block sends the same command.
  await page.getByRole("button", { name: "Play" }).click();
  await until(page, (x) => x.activity === "playing" && (x.live?.step ?? 0) > 0);
  await page.locator("#specimen-sandstone").dragTo(page.locator("#block"));
  s = await until(page, (x) => x.rockId === "sandstone");
  expect(s.kept.map((r) => [r.ordinal, r.rockId])).toEqual([
    [1, "granite"],
    [2, "shale"],
  ]);
  expect(s.kept[0]).toEqual(granite);
  expect(s.live).toMatchObject({ ordinal: 3, rockId: "sandstone" });
  await until(page, (x) => x.activity === "playing" && (x.live?.step ?? 0) > 0);
  const shaleStopped = (await state(page)).kept[1]!.step;
  await page.waitForTimeout(500);
  expect((await state(page)).kept[1]!.step).toBe(shaleStopped); // a kept run never advances

  const rockCommands = (await commands(page)).filter((c) => (c as { kind: string }).kind === "choose-rock");
  expect(rockCommands).toEqual([
    { kind: "choose-rock", rockId: "granite" },
    { kind: "choose-rock", rockId: "shale" },
    { kind: "choose-rock", rockId: "sandstone" },
  ]);
  expect(errors).toEqual([]);
});

test("scrubbing shows a labelled earlier moment and play returns to live; the level never touches runs", async ({
  page,
}) => {
  await open(page);
  for (let k = 0; k < 3; k++) {
    await page.getByRole("button", { name: "Step to next recorded time" }).click();
    await until(page, (x) => x.live?.step === 100 * (k + 1) && x.activity === "paused");
  }
  const timeline = page.getByLabel("Timeline");
  await timeline.fill("0.25");
  let s = await until(page, (x) => x.view.kind === "recorded");
  expect(s).toMatchObject({ activity: "paused", viewStep: 100, view: { index: 1, ofLiveRun: true } });
  await expect(page.locator("#view-label")).toContainText("earlier · model time 0.25 model years");
  await expect(page.getByRole("button", { name: "Return to live" })).toBeVisible();

  const before = await state(page);
  await page.getByLabel("Reading level").selectOption("uni");
  await expect(page.locator("#diagnostics")).toBeVisible();
  await expect(page.locator("#diagnostics")).toContainText("Backend: cpu");
  const atUni = await state(page);
  expect({ ...atUni, level: "hs" }).toEqual(before);
  await page.getByLabel("Reading level").selectOption("hs");
  await expect(page.locator("#diagnostics")).toBeHidden();

  await page.getByRole("button", { name: "Return to live" }).click();
  s = await until(page, (x) => x.view.kind === "live");
  expect(s.viewStep).toBe(300);
  await expect(page.locator("#view-label")).toContainText("model time 0.75 model years");
  await expect(page.locator("#view-label")).not.toContainText("earlier");

  await timeline.fill("0");
  await until(page, (x) => x.view.kind === "recorded" && x.viewStep === 0);
  await page.getByRole("button", { name: "Play" }).click();
  await until(page, (x) => x.view.kind === "live" && x.activity === "playing");
  await until(page, (x) => (x.live?.step ?? 0) > 300);
});

test("comparison uses the nearest recorded time, and the oldest of three kept runs is dropped with a visible note", async ({
  page,
}) => {
  await open(page);
  const rocks = ["sandstone", "shale", "granite", "shale"] as const;
  for (const [k, rock] of rocks.entries()) {
    if (k > 0) {
      await page.getByLabel(rock, { exact: true }).click();
      await until(page, (x) => x.live?.ordinal === k + 1);
    }
    await page.getByRole("button", { name: "Step to next recorded time" }).click();
    await until(page, (x) => x.live?.step === 100 && x.activity === "paused");
  }
  const s = await state(page);
  expect(s.kept.map((r) => r.ordinal)).toEqual([2, 3]);
  expect(s.notice).toMatchObject({ kind: "evicted", ordinal: 1 });
  await expect(page.locator("#notice")).toContainText("Run 1 (sandstone) was dropped");
  expect(s.memoryBytes).toBe(6 * 4 * 160 * 64 * 2);
  expect(s.memoryBytes).toBeLessThanOrEqual(s.memoryBudgetBytes);
  expect(s.kept.every((r) => r.clampedValues === 0) && s.live!.clampedValues === 0).toBe(true);
  // Live at a recorded time: the kept run's matching moment, labelled with its time.
  expect(s.comparison).toEqual({ status: "matched", label: "kept run 3 · model time 0.25 model years" });
  await page.getByLabel("Compare with").selectOption({ label: "run 2 · shale · cpu" });
  await expect(page.locator("#compare-label")).toHaveText("kept run 2 · model time 0.25 model years");
  await page.getByRole("button", { name: "Dismiss note" }).click();
  await expect(page.locator("#notice")).toHaveText("");
  await record("eviction", {
    kept: s.kept.map((r) => [r.ordinal, r.rockId]),
    memoryBytes: s.memoryBytes,
    budget: s.memoryBudgetBytes,
  });
});

test("leaving mid-run pauses and keeps everything; returning resumes without catch-up", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Play" }).click();
  await until(page, (x) => (x.live?.step ?? 0) >= 100);
  await page.getByRole("button", { name: "Leave page" }).click();
  // "paused" is published only once settled ("settling" before), so the frame must already match the run.
  const left = await until(page, (x) => x.departed && x.activity === "paused");
  expect(left.viewStep).toBe(left.live!.step); // a final, consistent frame
  await page.waitForTimeout(1500);
  expect(await state(page)).toEqual(left); // no hidden advance
  await page.getByLabel("granite", { exact: true }).click();
  await expect(page.locator("#error")).toContainText("resume");
  expect((await state(page)).rockId).toBe("sandstone");
  await page.getByRole("button", { name: "Return to page" }).click();
  const back = await until(page, (x) => !x.departed && x.activity === "playing");
  // No catch-up for 1.5 s away: at 1 model year per second that would be 600 steps at once.
  expect(back.live!.step - left.live!.step).toBeLessThan(200);
  await until(page, (x) => (x.live?.step ?? 0) > left.live!.step);
});

test("reset asks for an inline confirmation when kept runs exist", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Step to next recorded time" }).click();
  await until(page, (x) => x.live?.step === 100);
  await page.getByLabel("granite", { exact: true }).click();
  await until(page, (x) => x.kept.length === 1);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reset everything" })).toBeFocused();
  expect((await state(page)).kept).toHaveLength(1);
  await page.keyboard.press("Enter");
  const s = await until(page, (x) => x.kept.length === 0);
  expect(s).toMatchObject({
    rockId: "sandstone",
    speed: 1,
    compareRunId: null,
    live: { ordinal: 1, step: 0 },
  });
  await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeFocused();
});

test.describe("backend selection and fallback", () => {
  test("auto selection reports its backend and reason; a failed device check falls back to a labelled CPU run", async ({
    page,
  }) => {
    await open(page, "?prefer=auto");
    const auto = await state(page);
    expect(["webgpu", "cpu"]).toContain(auto.backend);
    if (auto.backend === "cpu") expect(auto.fallbackReason).toBeTruthy();
    else expect(auto.fallbackReason).toBeNull();
    await record("autoBackend", { backend: auto.backend, fallbackReason: auto.fallbackReason });

    await open(page, "?prefer=auto&fault=skew-erosion");
    const skewed = await state(page);
    expect(skewed.backend).toBe("cpu");
    expect(skewed.fallbackReason).toMatch(
      auto.backend === "webgpu" ? /device-check-failed/ : /WebGPU|adapter/,
    );
    await page.getByLabel("Reading level").selectOption("uni");
    await expect(page.locator("#diagnostics")).toContainText(`Backend: cpu (${skewed.fallbackReason}`);
    await record("forcedDeviceCheckFault", {
      backend: skewed.backend,
      fallbackReason: skewed.fallbackReason,
    });
  });

  test("a mid-run GPU failure halts the run and offers a new labelled CPU run (labelled CPU-as-GPU test fake)", async ({
    page,
  }) => {
    await open(page, "?prefer=auto&fakeGpuFailAt=250");
    expect(await state(page)).toMatchObject({ backend: "webgpu", fallbackReason: null });
    await page.getByRole("button", { name: "Play" }).click();
    let s = await until(page, (x) => x.live?.status === "halted");
    expect(s.activity).toBe("paused");
    // Halted at the last completed batch before step 250; snapshots at 0, 100 and 200 were recorded.
    expect(s.live).toMatchObject({ backend: "webgpu" });
    expect(s.live!.step).toBeGreaterThanOrEqual(200);
    expect(s.live!.step).toBeLessThanOrEqual(250);
    expect(s.live!.hashes).toHaveLength(3);
    const haltedAt = s.live!.step;
    await expect(page.locator("#notice")).toContainText("Run 1 stopped: [device-lost]");
    await expect(page.getByRole("button", { name: "Play" })).toBeDisabled();
    await page.getByRole("button", { name: "Start a new run on the CPU" }).click();
    s = await until(page, (x) => x.live?.ordinal === 2);
    expect(s.live).toMatchObject({ backend: "cpu", step: 0, rockId: "sandstone" });
    expect(s.fallbackReason).toContain(
      `halted at step ${haltedAt} (device-lost); new CPU run from the authored start`,
    );
    expect(s.kept[0]).toMatchObject({ ordinal: 1, backend: "webgpu", status: "halted" });
    await expect(page.locator("#offer")).toBeHidden();
    // Cross-backend comparison only at matched recorded times.
    await page.getByRole("button", { name: "Step to next recorded time" }).click();
    s = await until(page, (x) => x.live?.step === 100);
    expect(s.comparison?.status).toBe("matched");
    await record("midRunFake", { halted: s.kept[0], restartReason: s.fallbackReason });
  });

  test("real WebGPU: a lost device mid-run halts the run and offers a CPU run", async ({ page }) => {
    await open(page, "?prefer=auto");
    test.skip(
      (await state(page)).backend !== "webgpu",
      "WebGPU not selected in this browser; the fake covers the path",
    );
    await page.getByRole("button", { name: "Step to next recorded time" }).click();
    await until(page, (x) => x.live?.step === 100);
    await page.evaluate(() =>
      (
        window as unknown as { glacialFixture: { host: GlacialHost } }
      ).glacialFixture.host.injectDeviceLossForTest(),
    );
    await page.getByRole("button", { name: "Step to next recorded time" }).click();
    const s = await until(page, (x) => x.live?.status === "halted");
    expect(s.live).toMatchObject({ backend: "webgpu", step: 100 });
    await expect(page.getByRole("button", { name: "Start a new run on the CPU" })).toBeVisible();
    await record("realDeviceLoss", { failure: s.notice });
  });
});

test("determinism: the same rock and backend reproduce the same run in a Worker and on the main thread, at any speed", async ({
  page,
}) => {
  async function run(query: string, drive: "play" | "step") {
    await open(page, query);
    if (drive === "play") {
      await page.getByLabel("Speed").selectOption("4");
      await page.getByRole("button", { name: "Play" }).click();
    } else {
      await page.evaluate(async () => {
        const { host } = (window as unknown as { glacialFixture: { host: GlacialHost } }).glacialFixture;
        while (host.state().live!.status === "active") await host.dispatch({ kind: "step", steps: 37 });
      });
    }
    const s = await until(page, (x) => x.live?.status === "complete", 90_000);
    await idle(page);
    return s.live!;
  }
  const worker = await run("?transport=worker", "play");
  const main = await run("?transport=main", "step");
  const again = await run("?transport=worker", "step");
  expect(worker.hashes).toHaveLength(9);
  expect(new Set(worker.hashes).size).toBe(9);
  expect(main.hashes).toEqual(worker.hashes);
  expect(again.hashes).toEqual(worker.hashes);
  await record("determinism", { hashes: worker.hashes, step: worker.step });
});

// Correctness on whatever WebGPU backend auto selection actually picks, a software adapter included (they are
// short runs). Only the full-horizon production run needs a hardware adapter.
test.describe("WebGPU runs (skipped where auto selection does not pick WebGPU)", () => {
  test("same-device replay is reproducible at any speed, and differs from the CPU run (a different run)", async ({
    page,
  }) => {
    await open(page, "?prefer=auto");
    test.skip((await state(page)).backend !== "webgpu", "WebGPU not selected in this browser");
    async function gpuRun(drive: "play" | "step") {
      await open(page, "?prefer=auto");
      expect((await state(page)).backend).toBe("webgpu");
      if (drive === "play") {
        await page.getByLabel("Speed").selectOption("4");
        await page.getByRole("button", { name: "Play" }).click();
      } else
        await page.evaluate(async () => {
          const { host } = (window as unknown as { glacialFixture: { host: GlacialHost } }).glacialFixture;
          while (host.state().live!.status === "active") await host.dispatch({ kind: "step", steps: 53 });
        });
      return (await until(page, (x) => x.live?.status === "complete", 90_000)).live!;
    }
    const a = await gpuRun("play");
    const b = await gpuRun("step");
    expect(b.hashes).toEqual(a.hashes);
    await open(page, "?prefer=cpu");
    await page.evaluate(async () => {
      const { host } = (window as unknown as { glacialFixture: { host: GlacialHost } }).glacialFixture;
      while (host.state().live!.status === "active") await host.dispatch({ kind: "step", steps: 100 });
    });
    const cpu = (await until(page, (x) => x.live?.status === "complete", 90_000)).live!;
    // Not bitwise equal to the CPU, even at the start: the GPU hashes its two-lane float32 reconstruction
    // (D-W5-5I). Backends are numerically different runs; kept runs carry their backend label.
    expect(cpu.hashes).not.toEqual(a.hashes);
    await record("webgpuDeterminism", { gpuHashes: a.hashes, cpuHashes: cpu.hashes });
  });

  test("production recording: a full 300-year run records 16 snapshots inside the memory budget", async ({
    page,
  }) => {
    // A GPU-evidence run: only in an installed browser (UPLIFT_E2E_CHANNEL, e.g. chrome) on a hardware adapter.
    // CI's bundled Chromium may offer a software WebGPU adapter that passes the device check but needs far
    // longer than the test budget for 120 000 steps.
    test.skip(
      !process.env.UPLIFT_E2E_CHANNEL,
      "GPU evidence run: set UPLIFT_E2E_CHANNEL=chrome on a machine with a GPU",
    );
    await open(page, "?prefer=auto&runs=production");
    const adapter = await webgpuAdapter(page);
    test.skip(
      (await state(page)).backend !== "webgpu" || adapter.software,
      `Needs WebGPU on a hardware adapter (120 000 steps); here: backend ${(await state(page)).backend}, adapter ${adapter.label}${adapter.software ? " (software)" : ""}`,
    );
    const started = Date.now();
    await page.getByLabel("Speed").selectOption("4");
    await page.getByRole("button", { name: "Play" }).click();
    const s = await until(page, (x) => x.live?.status === "complete", 110_000);
    const seconds = (Date.now() - started) / 1000;
    expect(s.live!.step).toBe(120_000);
    expect(s.live!.hashes).toHaveLength(16);
    expect(s.live!.recordedBytes).toBe(16 * 81_920);
    expect(s.live!.clampedValues).toBe(0);
    expect(s.memoryBudgetBytes).toBe(32 * 1024 * 1024);
    await page.getByLabel("Timeline").fill("100");
    await expect(page.locator("#view-label")).toContainText("earlier · model time 100 model years");
    await record("productionWebgpuRun", {
      step: s.live!.step,
      snapshots: s.live!.hashes.length,
      recordedBytes: s.live!.recordedBytes,
      worstCaseBytesLivePlusTwoKept: 3 * 16 * 81_920,
      budgetBytes: s.memoryBudgetBytes,
      wallSecondsAt4x: seconds,
      adapter: adapter.label,
    });
  });
});
