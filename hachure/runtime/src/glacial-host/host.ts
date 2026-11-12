/**
 * The glacial host (session 5J): runs, time and comparison for "From V to U" (wave plan §4), on the main
 * thread, driving the glacier engine in a Worker.
 *
 * Every reader action is one command through `dispatch`. The page's rock selector and the 3D specimen
 * gesture both send `{ kind: "choose-rock", rockId }`; there is no second path.
 *
 * - A rock choice applies to a whole run. Before a run has advanced it just sets the rock; once the live run
 *   has history, it starts a new run from the authored start and the previous run is kept. Kept runs beyond
 *   `maxKeptRuns` are dropped oldest first, with a visible notice. A rock choice never alters a run.
 * - Play, pause, step and speed control real model advancement; speed changes scheduling only.
 * - Scrubbing pauses and shows a recorded snapshot, labelled as earlier; play or step returns to the live
 *   run's latest state. There is no branching from the past.
 * - Comparison looks a kept run up at the recorded time nearest to the viewed time; runs on different
 *   backends only at matched times.
 * - Reset needs an explicit confirmation when kept runs exist. Leaving pauses and keeps everything; returning
 *   restores the play intent with no hidden advance or catch-up.
 * - Level, camera, cut position and ice view are not host state at all: they cannot touch a run.
 */
import {
  DEFAULT_GLACIER_CONFIG,
  type GlacierConfig,
  type GlacierProbes,
  type GlacierSnapshot,
  type RockId,
  isRockId,
  resolveGlacierConfig,
} from "@hachure/glacier";
import { FixedStepClock } from "../sim-host/clock";
import {
  GLACIAL_SPEED_RANGE,
  type GlacialRunConfig,
  type GlacialRunPlan,
  RecordedRun,
  type RunBackend,
  type RunComparison,
  type RunFailure,
  type RunStatus,
  RunStore,
  maxBatchSteps,
  planGlacialRuns,
} from "../runs/index";
import { keptRunLabel, liveViewLabel, pastViewLabel } from "./labels";
import type {
  GlacialBackendPreference,
  GlacialFrame,
  GlacialGpuFault,
  GlacialReply,
  GlacialTransport,
} from "./protocol";

/** Every reader action on runs and time. View-only state (level, camera, cut, ice view) is not here. */
export type GlacialCommand =
  /** Page rock selector and 3D specimen drop alike. */
  | { readonly kind: "choose-rock"; readonly rockId: RockId }
  | { readonly kind: "play" }
  | { readonly kind: "pause" }
  /** Whole fixed steps; by default up to the next recorded time (one snapshot interval). */
  | { readonly kind: "step"; readonly steps?: number }
  | { readonly kind: "set-speed"; readonly speed: number }
  /** Pause and show the recorded snapshot of `runId` (default: the live run) nearest to `modelYears`. */
  | { readonly kind: "scrub"; readonly modelYears: number; readonly runId?: string }
  | { readonly kind: "return-to-live" }
  /** Compare against a held run (null: no comparison). */
  | { readonly kind: "compare"; readonly runId: string | null }
  /** Back to the authored defaults with no runs. Needs `confirmed` when kept runs exist. */
  | { readonly kind: "reset"; readonly confirmed?: boolean }
  /** After a halted WebGPU run: start a new, labelled CPU run from the authored start. */
  | { readonly kind: "restart-on-cpu" }
  | { readonly kind: "dismiss-notice" };

export type GlacialCommandResult =
  | { readonly kind: "done" }
  | { readonly kind: "unchanged"; readonly reason: string }
  | {
      readonly kind: "new-run";
      readonly runId: string;
      /** The previous live run, now kept (null when it had not advanced and was replaced). */
      readonly kept: string | null;
      readonly evicted: string | null;
    }
  | { readonly kind: "confirm-required"; readonly keptRuns: number };

/** A run as the page and the deeper level see it. */
export interface GlacialRunSummary {
  readonly id: string;
  readonly ordinal: number;
  readonly rockId: RockId;
  readonly backend: RunBackend;
  readonly fallbackReason: string | null;
  readonly status: RunStatus;
  readonly failure: RunFailure | null;
  /** Live position (live run) or where it stopped (kept run). */
  readonly step: number;
  readonly modelYears: number;
  /** Recorded snapshot times (unit: model years). */
  readonly recordedYears: readonly number[];
  /** Hash of the Float64 state at each recorded snapshot. */
  readonly recordedHashes: readonly string[];
  readonly recordedBytes: number;
  readonly clampedValues: number;
}

export type GlacialView =
  | { readonly kind: "live" }
  | {
      readonly kind: "recorded";
      readonly runId: string;
      readonly index: number;
      readonly step: number;
      readonly modelYears: number;
      /** True when this is an earlier moment of the live run (label "earlier"). */
      readonly ofLiveRun: boolean;
    };

export type GlacialNotice =
  | {
      readonly kind: "evicted";
      readonly runId: string;
      readonly ordinal: number;
      readonly rockId: RockId;
      readonly backend: RunBackend;
    }
  | {
      readonly kind: "run-halted";
      readonly runId: string;
      readonly ordinal: number;
      readonly failure: RunFailure;
    };

export interface GlacialHostState {
  readonly readiness: "loading" | "ready" | "error" | "disposed";
  readonly error: string | null;
  /**
   * "busy": a command or step is being applied while not playing. "settling": playback has stopped (pause or
   * leave) and accepted work is draining. "paused" is published only once settled: the shown live frame then
   * equals the live position, and nothing more changes until the next command.
   */
  readonly activity: "paused" | "playing" | "busy" | "settling";
  /** Left the page: paused, everything kept; `resume` restores the play intent. */
  readonly departed: boolean;
  readonly speed: number;
  /** Rock of the live run. */
  readonly rockId: RockId;
  /** Backend of the live run, and why it is not the requested one (deeper level / diagnostics). */
  readonly backend: RunBackend | null;
  readonly fallbackReason: string | null;
  readonly live: GlacialRunSummary | null;
  /** Kept runs, oldest first. */
  readonly kept: readonly GlacialRunSummary[];
  readonly view: GlacialView;
  readonly compareRunId: string | null;
  readonly notice: GlacialNotice | null;
  readonly offer: { readonly kind: "restart-on-cpu"; readonly haltedRunId: string } | null;
  /** Recorded bytes held, and the ceiling (unit: bytes). */
  readonly memoryBytes: number;
  readonly memoryBudgetBytes: number;
  /** Increments whenever the live frame changes; re-read `viewFrame()` then. */
  readonly frameSerial: number;
}

/** What the scene shows now: the live state, or a recorded moment, with its bound label. */
export interface GlacialViewFrame {
  readonly kind: "live" | "recorded";
  readonly runId: string;
  readonly ordinal: number;
  readonly rockId: RockId;
  readonly backend: RunBackend;
  readonly step: number;
  readonly modelYears: number;
  readonly snapshot: GlacierSnapshot;
  readonly probes: GlacierProbes;
  readonly label: string;
}

export type GlacialComparison = RunComparison & { readonly label: string };

export interface GlacialHostOptions {
  readonly transport: GlacialTransport;
  /** Recording, budget and scheduling. Defaults: D-W5-5G item 7 and wave plan §4. */
  readonly runConfig?: Partial<GlacialRunConfig>;
  /** Model overrides shared by every run (never the rock). Defaults: `DEFAULT_GLACIER_CONFIG`. */
  readonly model?: Partial<Omit<GlacierConfig, "rockId">>;
  /** Default "auto": WebGPU where parity and the device check allow, else the CPU (D-W5-5I). */
  readonly prefer?: GlacialBackendPreference;
  /** Rock of the first run and after reset. Default: `DEFAULT_GLACIER_CONFIG.rockId`. */
  readonly defaultRockId?: RockId;
  /** Diagnostic fault injection for the fallback tests. Never set in product code. */
  readonly diagnostics?: { readonly gpuForceFault?: GlacialGpuFault };
}

/** Wall-clock seconds accepted from one animation frame; longer gaps are not caught up. */
const MAX_FRAME_SECONDS = 0.25;

export class GlacialHost {
  readonly plan: GlacialRunPlan;
  readonly model: GlacierConfig;
  private readonly transport: GlacialTransport;
  private readonly options: GlacialHostOptions;
  private readonly defaultRockId: RockId;
  private readonly store: RunStore;
  private readonly clock: FixedStepClock;
  private readonly listeners = new Set<(state: GlacialHostState) => void>();
  private chain: Promise<unknown> = Promise.resolve();
  private readiness: GlacialHostState["readiness"] = "loading";
  private errorMessage: string | null = null;
  private playing = false;
  private busy = 0;
  /** Pauses and departures still draining; "paused" is reported only at zero. */
  private settling = 0;
  private departed = false;
  private resumeIntent = false;
  private skipNextAdvance = false;
  private batchInFlight = false;
  private speed = 1;
  private frameElapsed = 0;
  private frame: GlacialFrame | null = null;
  private frameSerial = 0;
  private view: GlacialView = { kind: "live" };
  private compareRunId: string | null = null;
  private notice: GlacialNotice | null = null;
  private offer: GlacialHostState["offer"] = null;
  private runSeq = 0;
  private lastOrdinal = 0;
  private cachedState: GlacialHostState | undefined;
  private decoded = new Map<string, GlacierSnapshot>();
  /** Last automatic or stepped batch (diagnostic). */
  lastBatch: { readonly steps: number; readonly computeMs: number; readonly processingMs: number } | null =
    null;

  constructor(options: GlacialHostOptions) {
    if (options.model && "rockId" in options.model)
      throw new Error("The rock is chosen per run with choose-rock, never in the shared model");
    this.options = options;
    this.transport = options.transport;
    this.model = resolveGlacierConfig(options.model ?? {});
    this.plan = planGlacialRuns(options.runConfig ?? {}, this.model);
    this.defaultRockId = options.defaultRockId ?? DEFAULT_GLACIER_CONFIG.rockId;
    if (!isRockId(this.defaultRockId)) throw new RangeError(`Unknown rock ${String(this.defaultRockId)}`);
    this.store = new RunStore(this.plan);
    this.clock = new FixedStepClock(
      this.plan.config.modelYearsPerRealSecond / this.plan.dtYears,
      maxBatchSteps(this.plan),
    );
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────────────────

  /** Selects the backend and starts run 1 at the authored start, paused. */
  async initialize(): Promise<void> {
    if (this.readiness !== "loading") throw new Error("Glacial host is already initialized");
    try {
      await this.exclusive(async () => {
        await this.transport.request({
          kind: "init",
          model: this.options.model ?? {},
          prefer: this.options.prefer ?? "auto",
          snapshotIntervalYears: this.plan.config.snapshotIntervalYears,
          horizonYears: this.plan.config.horizonYears,
          ...(this.options.diagnostics ? { diagnostics: this.options.diagnostics } : {}),
        });
        await this.startRun(this.defaultRockId);
      });
      this.readiness = "ready";
      this.publish();
    } catch (error) {
      this.fail(error);
      throw error;
    }
  }

  /** Leaving the page: pause, drain accepted work, publish a final consistent state. Keeps every run. */
  async pauseAndSettle(): Promise<void> {
    if (this.readiness === "disposed") return;
    if (!this.departed) {
      this.departed = true;
      this.resumeIntent = this.playing;
      this.playing = false;
      this.clock.reset();
    }
    await this.settle();
  }

  /**
   * Reports "settling" until every accepted batch has landed and the live frame matches the live position,
   * then publishes "paused" once. Never publishes a paused state whose frame lags the run.
   */
  private async settle(): Promise<void> {
    this.settling++;
    this.publish();
    try {
      await this.whenIdle();
      if (this.readiness === "ready")
        await this.exclusive(() => this.refreshFrame()).catch((e: unknown) => this.fail(e));
    } finally {
      this.settling--;
      this.publish();
    }
  }

  /** Returning: restore the play intent. No hidden advance or catch-up for the time away. */
  resume(): void {
    if (!this.departed || this.readiness === "disposed") return;
    this.departed = false;
    this.clock.reset();
    this.skipNextAdvance = true;
    this.playing = this.resumeIntent && this.canPlay();
    this.resumeIntent = false;
    this.publish();
  }

  async dispose(): Promise<void> {
    if (this.readiness === "disposed") return;
    this.playing = false;
    this.readiness = "disposed";
    this.publish();
    this.listeners.clear();
    await this.chain.catch(() => undefined);
    this.transport.dispose();
  }

  /** Resolves when every accepted command and batch has been applied. */
  async whenIdle(): Promise<void> {
    let seen: Promise<unknown>;
    do {
      seen = this.chain;
      await seen.catch(() => undefined);
    } while (seen !== this.chain);
  }

  // ── Reading state ───────────────────────────────────────────────────────────────────────────────────

  state(): GlacialHostState {
    this.cachedState ??= this.buildState();
    return this.cachedState;
  }

  /** Emits the current state now, then on every change. Unsubscribing is idempotent. */
  subscribe(listener: (state: GlacialHostState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** A held run (live or kept), as recorded view data in the capture format. */
  run(runId: string): RecordedRun | undefined {
    return this.store.get(runId);
  }
  /** Held runs, kept (oldest first) then live. */
  runs(): readonly RecordedRun[] {
    return this.store.all();
  }

  viewFrame(): GlacialViewFrame | null {
    const live = this.store.live;
    if (!live) return null;
    const view = this.view;
    if (view.kind === "live") {
      if (!this.frame) return null;
      const { snapshot, probes } = this.frame;
      return {
        kind: "live",
        runId: live.id,
        ordinal: live.ordinal,
        rockId: live.rockId,
        backend: live.backend,
        step: snapshot.step,
        modelYears: snapshot.modelYears,
        snapshot,
        probes,
        label: liveViewLabel(snapshot.modelYears),
      };
    }
    const run = this.store.get(view.runId);
    if (!run) return null;
    return {
      kind: "recorded",
      runId: run.id,
      ordinal: run.ordinal,
      rockId: run.rockId,
      backend: run.backend,
      step: view.step,
      modelYears: view.modelYears,
      snapshot: this.decode(run, view.index),
      probes: run.probes(view.index),
      label: view.ofLiveRun ? pastViewLabel(view.modelYears) : keptRunLabel(run.ordinal, view.modelYears),
    };
  }

  /** The compared run at the recorded time nearest to the viewed time (null when nothing is compared). */
  comparison(): GlacialComparison | null {
    const frame = this.viewFrame();
    if (!frame || this.compareRunId === null) return null;
    const result = this.store.compare(
      { runId: frame.runId, modelYears: frame.modelYears, backend: frame.backend },
      this.compareRunId,
    );
    if (!result) return null;
    const run = this.store.get(result.runId)!;
    if (result.status === "unmatched") return { ...result, label: result.reason };
    return {
      ...result,
      snapshot: () => this.decode(run, result.index),
      label:
        run === this.store.live
          ? `live run ${run.ordinal} · ${liveViewLabel(result.modelYears)}`
          : keptRunLabel(run.ordinal, result.modelYears),
    };
  }

  /** Hash of the live solver's Float64 state (diagnostic; equal runs give equal hashes). */
  liveHash(): Promise<string> {
    return this.exclusive(async () => {
      const reply = await this.transport.request({ kind: "hash" });
      return reply.hash!;
    });
  }

  /** Diagnostic: destroy the GPU device under the live run, to exercise the mid-run failure path. */
  injectDeviceLossForTest(): Promise<void> {
    return this.exclusive(async () => {
      await this.transport.request({ kind: "fault", fault: "lose-device" });
    });
  }

  // ── Commands ────────────────────────────────────────────────────────────────────────────────────────

  /** The one entry point for reader actions on runs and time. */
  dispatch(command: GlacialCommand): Promise<GlacialCommandResult> {
    if (this.readiness !== "ready")
      return Promise.reject(new Error(`Glacial host is ${this.readiness}; commands are not accepted`));
    if (this.departed)
      return Promise.reject(new Error("Glacial host is settled after leaving; resume before changing runs"));
    switch (command.kind) {
      case "choose-rock":
        return this.chooseRock(command.rockId);
      case "play":
        return this.play();
      case "pause":
        return this.pause();
      case "step":
        return this.step(command.steps);
      case "set-speed": {
        const { speed } = command;
        if (!Number.isFinite(speed) || speed < GLACIAL_SPEED_RANGE.min || speed > GLACIAL_SPEED_RANGE.max)
          return Promise.reject(new RangeError("Speed must be between a quarter and four times normal"));
        this.speed = speed;
        this.publish();
        return Promise.resolve({ kind: "done" });
      }
      case "scrub":
        return this.scrub(command.modelYears, command.runId);
      case "return-to-live":
        return this.exclusive(async () => {
          if (this.view.kind === "live") return { kind: "unchanged", reason: "Already showing the live run" };
          this.view = { kind: "live" };
          this.publish();
          return { kind: "done" };
        });
      case "compare":
        return this.compare(command.runId);
      case "reset":
        return this.reset(command.confirmed === true);
      case "restart-on-cpu":
        return this.restartOnCpu();
      case "dismiss-notice":
        this.notice = null;
        this.publish();
        return Promise.resolve({ kind: "done" });
    }
  }

  /** Called every animation frame with the real seconds since the last one. Never blocks. */
  advance(realSeconds: number): void {
    if (!this.playing || this.departed || this.readiness !== "ready") return;
    if (this.skipNextAdvance) {
      this.skipNextAdvance = false;
      return;
    }
    const seconds = Math.min(Math.max(Number.isFinite(realSeconds) ? realSeconds : 0, 0), MAX_FRAME_SECONDS);
    this.clock.add(seconds, this.speed);
    this.frameElapsed += seconds;
    if (this.batchInFlight) return;
    const steps = this.clock.take();
    if (!steps) return;
    const wantFrame = this.frameElapsed >= this.plan.config.frameIntervalSeconds;
    if (wantFrame) this.frameElapsed = 0;
    this.batchInFlight = true;
    void this.exclusive(async () => {
      if (!this.playing) return;
      await this.advanceLive(steps, wantFrame);
    })
      .catch((error: unknown) => this.fail(error))
      .finally(() => {
        this.batchInFlight = false;
      });
  }

  // ── Internals ───────────────────────────────────────────────────────────────────────────────────────

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const result = this.chain.then(task);
    this.chain = result.catch(() => undefined);
    return result;
  }

  /** Serialized and marked busy, for commands that wait on the engine. */
  private command<T>(task: () => Promise<T>): Promise<T> {
    return this.exclusive(async () => {
      this.busy++;
      this.publish();
      try {
        return await task();
      } finally {
        this.busy--;
        this.publish();
      }
    });
  }

  private canPlay(): boolean {
    return this.readiness === "ready" && !this.departed && this.store.live?.status === "active";
  }

  private async chooseRock(rockId: RockId): Promise<GlacialCommandResult> {
    if (!isRockId(rockId)) throw new RangeError(`Unknown rock ${String(rockId)}`);
    // Keep the play intent across the change: a run started while playing plays on from its start.
    const intent = this.playing;
    this.playing = false;
    return this.command(async () => {
      const live = this.store.live!;
      if (live.rockId === rockId && live.status !== "halted") {
        this.playing = intent && this.canPlay();
        return { kind: "unchanged", reason: "That rock is already the live run's rock" };
      }
      const result = await this.startRun(rockId);
      this.playing = intent && this.canPlay();
      return result;
    });
  }

  private async play(): Promise<GlacialCommandResult> {
    return this.exclusive(async () => {
      const live = this.store.live!;
      const wasPast = this.view.kind !== "live";
      this.view = { kind: "live" };
      if (live.status !== "active") {
        this.publish();
        return wasPast
          ? { kind: "done" }
          : { kind: "unchanged", reason: `The live run is ${live.status}; it does not advance` };
      }
      this.clock.reset();
      this.frameElapsed = this.plan.config.frameIntervalSeconds;
      this.playing = true;
      this.publish();
      return { kind: "done" };
    });
  }

  private async pause(): Promise<GlacialCommandResult> {
    const was = this.playing;
    this.playing = false;
    this.clock.reset();
    await this.settle();
    if (this.readiness === "error") throw new Error(this.errorMessage ?? "Glacial host failed while pausing");
    return was ? { kind: "done" } : { kind: "unchanged", reason: "Already paused" };
  }

  private async step(steps?: number): Promise<GlacialCommandResult> {
    if (steps !== undefined && (!Number.isInteger(steps) || steps < 1))
      throw new RangeError("Steps must be a positive integer");
    this.playing = false;
    this.clock.reset();
    return this.command(async () => {
      this.view = { kind: "live" };
      const live = this.store.live!;
      if (live.status !== "active") {
        this.publish();
        return { kind: "unchanged", reason: `The live run is ${live.status}; it does not advance` };
      }
      const every = this.plan.recordEverySteps;
      const toNext = every * (Math.floor(live.step / every) + 1) - live.step;
      await this.advanceLive(steps ?? toNext, true);
      return { kind: "done" };
    });
  }

  private async scrub(modelYears: number, runId?: string): Promise<GlacialCommandResult> {
    if (!Number.isFinite(modelYears)) throw new RangeError("Scrub time must be finite");
    this.playing = false;
    this.clock.reset();
    return this.exclusive(async () => {
      const live = this.store.live!;
      const moment = this.store.nearest(runId ?? live.id, modelYears);
      if (!moment) {
        this.publish();
        return { kind: "unchanged", reason: `No recorded run ${runId ?? live.id}` };
      }
      if (moment.run === live && moment.step === live.step && this.frame?.snapshot.step === live.step)
        this.view = { kind: "live" };
      else
        this.view = {
          kind: "recorded",
          runId: moment.run.id,
          index: moment.index,
          step: moment.step,
          modelYears: moment.modelYears,
          ofLiveRun: moment.run === live,
        };
      this.publish();
      return { kind: "done" };
    });
  }

  private compare(runId: string | null): Promise<GlacialCommandResult> {
    if (runId !== null && !this.store.get(runId))
      return Promise.reject(new RangeError(`No held run ${runId} to compare with`));
    if (runId === this.compareRunId)
      return Promise.resolve({ kind: "unchanged", reason: "Already compared" });
    this.compareRunId = runId;
    this.publish();
    return Promise.resolve({ kind: "done" });
  }

  private async reset(confirmed: boolean): Promise<GlacialCommandResult> {
    const keptRuns = this.store.kept.length;
    if (keptRuns > 0 && !confirmed) return { kind: "confirm-required", keptRuns };
    this.playing = false;
    this.clock.reset();
    return this.command(async () => {
      this.store.clear();
      this.lastOrdinal = 0;
      this.speed = 1;
      this.view = { kind: "live" };
      this.compareRunId = null;
      this.notice = null;
      this.offer = null;
      this.decoded.clear();
      const result = await this.startRun(this.defaultRockId);
      return result.kind === "new-run" ? { kind: "done" } : result;
    });
  }

  private async restartOnCpu(): Promise<GlacialCommandResult> {
    if (!this.offer) return { kind: "unchanged", reason: "No halted WebGPU run to replace" };
    this.playing = false;
    return this.command(async () => {
      const runId = `run-${++this.runSeq}`;
      const reply = await this.transport.request({ kind: "restart-on-cpu", runId });
      return this.adoptLive(reply, ++this.lastOrdinal);
    });
  }

  private async startRun(rockId: RockId): Promise<GlacialCommandResult> {
    const live = this.store.live;
    const replaces = live !== null && !live.hasHistory;
    const ordinal = replaces ? live.ordinal : ++this.lastOrdinal;
    const runId = `run-${++this.runSeq}`;
    const reply = await this.transport.request({ kind: "start-run", runId, rockId });
    return this.adoptLive(reply, ordinal);
  }

  private adoptLive(reply: GlacialReply, ordinal: number): GlacialCommandResult {
    const started = reply.run;
    if (!started || !reply.frame) throw new Error("Engine did not start a run");
    const run = new RecordedRun({
      id: started.runId,
      ordinal,
      rockId: started.rockId,
      backend: started.backend,
      fallbackReason: started.fallbackReason,
      config: started.config,
      start: started.start,
      layers: started.layers,
      snapshotIntervalYears: this.plan.config.snapshotIntervalYears,
      maxSnapshots: this.plan.snapshotsPerRun,
    });
    for (const record of reply.records ?? []) run.append(record);
    const handoff = this.store.startLive(run);
    this.frame = reply.frame;
    this.frameSerial++;
    this.view = { kind: "live" };
    this.offer = null;
    // The newly kept run is the default comparison (wave plan §1, "Compare"); the reader may pick another.
    if (handoff.kept) this.compareRunId = handoff.kept.id;
    if (handoff.evicted) {
      const gone = handoff.evicted;
      this.notice = {
        kind: "evicted",
        runId: gone.id,
        ordinal: gone.ordinal,
        rockId: gone.rockId,
        backend: gone.backend,
      };
      for (const key of [...this.decoded.keys()]) if (key.startsWith(`${gone.id}:`)) this.decoded.delete(key);
    }
    if (this.compareRunId !== null && !this.store.get(this.compareRunId)) this.compareRunId = null;
    this.publish();
    return {
      kind: "new-run",
      runId: run.id,
      kept: handoff.kept?.id ?? null,
      evicted: handoff.evicted?.id ?? null,
    };
  }

  private async advanceLive(steps: number, wantFrame: boolean): Promise<void> {
    const live = this.store.live!;
    if (live.status !== "active") {
      this.playing = false;
      this.publish();
      return;
    }
    const reply = await this.transport.request({ kind: "advance", steps, frame: wantFrame });
    if (reply.batch)
      this.lastBatch = {
        steps: reply.batch.steps,
        computeMs: reply.batch.computeMs,
        processingMs: reply.processingMs,
      };
    for (const record of reply.records ?? []) live.append(record);
    if (reply.step !== undefined && reply.modelYears !== undefined)
      live.advanceTo(reply.step, reply.modelYears);
    if (reply.frame) {
      this.frame = reply.frame;
      this.frameSerial++;
    }
    if (reply.halted) {
      live.halt(reply.halted);
      this.playing = false;
      this.notice = { kind: "run-halted", runId: live.id, ordinal: live.ordinal, failure: reply.halted };
      if (reply.halted.backend === "webgpu") this.offer = { kind: "restart-on-cpu", haltedRunId: live.id };
    } else if (reply.complete) {
      live.complete();
      this.playing = false;
    }
    this.store.assertBudget();
    this.publish();
  }

  /** Makes the live frame match the live position (after a pause or before leaving). */
  private async refreshFrame(): Promise<void> {
    const live = this.store.live;
    if (!live || live.status === "halted" || this.frame?.snapshot.step === live.step) return;
    const reply = await this.transport.request({ kind: "frame" });
    if (reply.frame) {
      this.frame = reply.frame;
      this.frameSerial++;
      this.publish();
    }
  }

  private decode(run: RecordedRun, index: number): GlacierSnapshot {
    const key = `${run.id}:${index}`;
    let snapshot = this.decoded.get(key);
    if (!snapshot) {
      snapshot = run.snapshot(index);
      // Hold a few decoded moments only (the view and the comparison); recorded bytes stay the source.
      if (this.decoded.size >= 4) this.decoded.delete(this.decoded.keys().next().value!);
      this.decoded.set(key, snapshot);
    }
    return snapshot;
  }

  private fail(error: unknown): void {
    if (this.readiness === "disposed") return;
    this.playing = false;
    this.readiness = "error";
    this.errorMessage = error instanceof Error ? error.message : String(error);
    this.publish();
  }

  private summary(run: RecordedRun): GlacialRunSummary {
    return {
      id: run.id,
      ordinal: run.ordinal,
      rockId: run.rockId,
      backend: run.backend,
      fallbackReason: run.fallbackReason,
      status: run.status,
      failure: run.failure,
      step: run.step,
      modelYears: run.modelYears,
      recordedYears: run.times,
      recordedHashes: Array.from({ length: run.count }, (_, k) => run.stateHash(k)),
      recordedBytes: run.recordedBytes,
      clampedValues: run.clampedValues,
    };
  }

  private buildState(): GlacialHostState {
    const live = this.store.live;
    return Object.freeze({
      readiness: this.readiness,
      error: this.errorMessage,
      activity: this.playing ? "playing" : this.settling > 0 ? "settling" : this.busy > 0 ? "busy" : "paused",
      departed: this.departed,
      speed: this.speed,
      rockId: live?.rockId ?? this.defaultRockId,
      backend: live?.backend ?? null,
      fallbackReason: live?.fallbackReason ?? null,
      live: live ? this.summary(live) : null,
      kept: this.store.kept.map((run) => this.summary(run)),
      view: this.view,
      compareRunId: this.compareRunId,
      notice: this.notice,
      offer: this.offer,
      memoryBytes: this.store.memoryBytes(),
      memoryBudgetBytes: this.plan.config.memoryBudgetBytes,
      frameSerial: this.frameSerial,
    });
  }

  private publish(): void {
    this.cachedState = undefined;
    if (this.listeners.size === 0) return;
    const state = this.state();
    for (const listener of this.listeners) listener(state);
  }
}
