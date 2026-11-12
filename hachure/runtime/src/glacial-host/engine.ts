/**
 * The glacier engine behind the glacial host: one live solver at a time, in a Worker (or in-process).
 *
 * - Backend: chosen once, at the first run, with `selectGlacierBackend` (WebGPU by default where the recorded
 *   parity and this device's kernel check allow it; CPU otherwise, with the labelled reason). Later runs use
 *   the chosen backend; a GPU failure moves the session to the CPU for good, always labelled.
 * - Recording: a run records its start and then a snapshot at every `snapshotIntervalYears` boundary, in the
 *   frozen capture format, and stops at `horizonYears`. Batches are split at those boundaries, so the
 *   recorded snapshots do not depend on how playback scheduled the steps.
 * - Failure: a run that fails is halted and latched. It never continues, on this or another backend; the
 *   host may start a NEW CPU run from the authored start (`restart-on-cpu`), labelled as such.
 */
import { DEFAULT_V_VALLEY, type GlacierConfig, resolveGlacierConfig } from "@hachure/glacier";
import {
  type AsyncGlacierSolver,
  type GlacierBackendSelection,
  type SelectGlacierBackendOptions,
  isGlacierGpuError,
  restartOnCpu,
  selectGlacierBackend,
} from "@hachure/glacier/gpu";
import {
  type RunFailure,
  type RunRecord,
  type RunStartIdentity,
  encodeRunRecord,
  planGlacialRuns,
  runQuantization,
} from "../runs/index";
import type {
  GlacialCommandMessage,
  GlacialFrame,
  GlacialInitCommand,
  GlacialReply,
  GlacialRunStarted,
} from "./protocol";

/** The authored start every run begins from (`v-valley/2`, D-W5-5G2); the solvers build it by default. */
export const GLACIAL_START: RunStartIdentity = Object.freeze({
  preset: "v-valley/2",
  options: Object.freeze({ ...DEFAULT_V_VALLEY }) as Readonly<Record<string, number>>,
});

export interface GlacialEngineOptions {
  /** Backend selection; defaults to `selectGlacierBackend`. Tests inject fakes. */
  readonly select?: (
    overrides: Partial<GlacierConfig>,
    init: Record<string, never>,
    options: SelectGlacierBackendOptions,
  ) => Promise<GlacierBackendSelection>;
  /** New CPU run after a GPU failure; defaults to `restartOnCpu`. */
  readonly restart?: typeof restartOnCpu;
}

interface LiveRun {
  readonly id: string;
  readonly solver: AsyncGlacierSolver;
  readonly config: GlacierConfig;
  readonly layers: GlacialRunStarted["layers"];
  nextIndex: number;
  nextRecordStep: number;
  halted: RunFailure | null;
  /** The labelled failure object, kept for `restartOnCpu`. */
  failure: unknown;
}

export class GlacialEngine {
  private init: GlacialInitCommand | undefined;
  private recordEverySteps = 0;
  private horizonSteps = 0;
  /** Backend of this session's runs, fixed at the first run; null before it. */
  private sessionBackend: "webgpu" | "cpu" | null = null;
  /** Why the session runs on the CPU when that was not what was asked for. */
  private sessionReason: string | null = null;
  private live: LiveRun | undefined;
  private disposed = false;
  private readonly select: NonNullable<GlacialEngineOptions["select"]>;
  private readonly restart: typeof restartOnCpu;

  constructor(options: GlacialEngineOptions = {}) {
    this.select = options.select ?? selectGlacierBackend;
    this.restart = options.restart ?? restartOnCpu;
  }

  async execute(command: GlacialCommandMessage): Promise<GlacialReply> {
    if (this.disposed) throw new Error("Glacier engine is disposed");
    const start = performance.now();
    const reply = await this.perform(command);
    return { ...reply, processingMs: performance.now() - start };
  }

  private async perform(command: GlacialCommandMessage): Promise<Omit<GlacialReply, "processingMs">> {
    switch (command.kind) {
      case "init":
        return this.initialize(command);
      case "start-run":
        return this.startRun(command.runId, command.rockId);
      case "restart-on-cpu":
        return this.restartRun(command.runId);
      case "advance":
        return this.advance(command.steps, command.frame);
      case "frame": {
        const run = this.running();
        return { frame: await this.frame(run), step: run.solver.step, modelYears: run.solver.modelYears };
      }
      case "hash":
        return { hash: await this.running().solver.hash() };
      case "fault": {
        const solver = this.running().solver as AsyncGlacierSolver & { loseDeviceForTest?: () => void };
        if (solver.backend !== "webgpu" || !solver.loseDeviceForTest)
          throw new Error("Device-loss diagnostic needs a live WebGPU run");
        solver.loseDeviceForTest();
        return {};
      }
    }
  }

  private initialize(command: GlacialInitCommand): Omit<GlacialReply, "processingMs"> {
    if (this.init) throw new Error("Glacier engine is already initialized");
    if ("rockId" in command.model) throw new Error("The rock is chosen per run, never in the shared model");
    const model = resolveGlacierConfig(command.model);
    const plan = planGlacialRuns(
      { snapshotIntervalYears: command.snapshotIntervalYears, horizonYears: command.horizonYears },
      model,
    );
    this.init = structuredClone(command);
    this.recordEverySteps = plan.recordEverySteps;
    this.horizonSteps = plan.horizonSteps;
    return {};
  }

  private initialized(): GlacialInitCommand {
    if (!this.init) throw new Error("Glacier engine is not initialized");
    return this.init;
  }

  private running(): LiveRun {
    if (!this.live) throw new Error("No live glacier run");
    return this.live;
  }

  private async chooseBackend(overrides: Partial<GlacierConfig>): Promise<GlacierBackendSelection> {
    const init = this.initialized();
    const gpu = init.diagnostics?.gpuForceFault ? { forceFault: init.diagnostics.gpuForceFault } : {};
    if (this.sessionBackend === null) {
      const selection = await this.select(overrides, {}, { prefer: init.prefer, gpu });
      this.sessionBackend = selection.backend;
      this.sessionReason = selection.fallbackReason;
      return selection;
    }
    if (this.sessionBackend === "webgpu") {
      try {
        return await this.select(overrides, {}, { prefer: "webgpu", gpu, deviceCheck: false });
      } catch (error) {
        const reason = `WebGPU not used for this run, running on CPU: ${error instanceof Error ? error.message : String(error)}`;
        this.sessionBackend = "cpu";
        this.sessionReason = reason;
      }
    }
    // CPU session: carry the session's reason, so every run says why it is on the CPU.
    const selection = await this.select(overrides, {}, { prefer: "cpu" });
    return { ...selection, fallbackReason: this.sessionReason };
  }

  private async disposeLive(): Promise<void> {
    const live = this.live;
    this.live = undefined;
    if (live) await live.solver.dispose().catch(() => undefined);
  }

  private async startRun(
    runId: string,
    rockId: GlacierConfig["rockId"],
  ): Promise<Omit<GlacialReply, "processingMs">> {
    const init = this.initialized();
    await this.disposeLive();
    const selection = await this.chooseBackend({ ...init.model, rockId });
    return this.begin(runId, selection);
  }

  private async restartRun(runId: string): Promise<Omit<GlacialReply, "processingMs">> {
    const live = this.running();
    if (!live.halted || live.halted.backend !== "webgpu")
      throw new Error("A new CPU run is offered only after a halted WebGPU run");
    const selection = this.restart(live.config, {}, live.failure, live.halted.atStep);
    this.sessionBackend = "cpu";
    this.sessionReason = selection.fallbackReason;
    await this.disposeLive();
    return this.begin(runId, selection);
  }

  private async begin(
    runId: string,
    selection: GlacierBackendSelection,
  ): Promise<Omit<GlacialReply, "processingMs">> {
    const solver = selection.solver;
    try {
      if (solver.step !== 0) throw new Error("A run starts from the authored start at step 0");
      const snapshot = await solver.snapshot();
      const layers = runQuantization(snapshot.bedM);
      const run: LiveRun = {
        id: runId,
        solver,
        config: solver.config,
        layers,
        nextIndex: 0,
        nextRecordStep: 0,
        halted: null,
        failure: null,
      };
      const first = await this.record(run, snapshot);
      this.live = run;
      return {
        run: {
          runId,
          rockId: solver.config.rockId,
          backend: selection.backend,
          fallbackReason: selection.fallbackReason,
          config: solver.config,
          start: GLACIAL_START,
          layers,
        },
        records: [first],
        frame: { snapshot, probes: first.probes },
        step: 0,
        modelYears: 0,
        complete: false,
      };
    } catch (error) {
      await solver.dispose().catch(() => undefined);
      throw error;
    }
  }

  private async record(
    run: LiveRun,
    snapshot?: Awaited<ReturnType<AsyncGlacierSolver["snapshot"]>>,
  ): Promise<RunRecord> {
    const snap = snapshot ?? (await run.solver.snapshot());
    const [probes, stateHash] = await Promise.all([run.solver.probes(), run.solver.hash()]);
    const record = encodeRunRecord({
      index: run.nextIndex,
      config: run.config,
      start: GLACIAL_START,
      layers: run.layers,
      snapshotIntervalYears: this.initialized().snapshotIntervalYears,
      snapshot: snap,
      probes,
      stateHash,
    });
    run.nextIndex++;
    run.nextRecordStep += this.recordEverySteps;
    return record;
  }

  private async frame(run: LiveRun): Promise<GlacialFrame> {
    const [snapshot, probes] = await Promise.all([run.solver.snapshot(), run.solver.probes()]);
    return { snapshot, probes };
  }

  private async advance(steps: number, wantFrame: boolean): Promise<Omit<GlacialReply, "processingMs">> {
    if (!Number.isInteger(steps) || steps < 0) throw new RangeError("Steps must be a nonnegative integer");
    const run = this.running();
    if (run.halted) throw new Error(`Run ${run.id} is halted (${run.halted.reason}); it never continues`);
    const solver = run.solver;
    const records: RunRecord[] = [];
    let remaining = Math.min(steps, this.horizonSteps - solver.step);
    const done0 = solver.step;
    let computeMs = 0;
    let lastGood = solver.step;
    try {
      while (remaining > 0) {
        const chunk = Math.min(remaining, run.nextRecordStep - solver.step);
        const t0 = performance.now();
        await solver.advance(chunk);
        computeMs += performance.now() - t0;
        remaining -= chunk;
        if (solver.step === run.nextRecordStep) records.push(await this.record(run));
        lastGood = solver.step;
      }
    } catch (error) {
      const reason = isGlacierGpuError(error) ? error.reason : "solver-error";
      run.halted = {
        reason,
        message: error instanceof Error ? error.message : String(error),
        atStep: lastGood,
        backend: solver.backend,
      };
      run.failure = error;
      if (solver.backend === "webgpu") this.sessionBackend = "cpu";
      if (solver.backend === "webgpu")
        this.sessionReason = `WebGPU run halted (${reason}); later runs use the CPU`;
      await solver.dispose().catch(() => undefined);
      return {
        records,
        halted: run.halted,
        step: lastGood,
        modelYears: lastGood * run.config.dtYears,
        batch: { steps: lastGood - done0, computeMs },
      };
    }
    const complete = solver.step >= this.horizonSteps;
    return {
      records,
      ...(wantFrame || complete ? { frame: await this.frame(run) } : {}),
      step: solver.step,
      modelYears: solver.modelYears,
      complete,
      batch: { steps: solver.step - done0, computeMs },
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    void this.disposeLive();
  }
}
