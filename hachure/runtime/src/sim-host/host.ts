import type { TerrainConfig, ToolOp, ToolResult, TunableConfig } from "@hachure/terrain";
import { FixedStepClock } from "./clock";
import type { HostCommand, HostReply, HostSample, HostTransport, LandscapeTimeStatus } from "./protocol";

/** CPU Worker host. Scheduling degrades wall-clock speed, never numerical dt or deterministic step order. */
export class SimHost {
  readonly clock: FixedStepClock;
  playing = false;
  speed = 1;
  sample: HostSample | undefined;
  readonly timings = {
    roundTripMs: 0,
    processingMs: 0,
    transportAndSchedulingMs: 0,
    lastBatchSteps: 0,
    lastBatchMs: 0,
  };
  private generation = 0;
  private busy = false;
  private disposed = false;
  private sampleElapsed = 0;
  private readonly listeners = new Set<(sample: HostSample) => void>();
  private readonly errors = new Set<(error: Error) => void>();
  constructor(
    private readonly transport: HostTransport,
    stepsPerRealSecond: number,
    readonly sampleIntervalSeconds = 0.5,
  ) {
    this.clock = new FixedStepClock(stepsPerRealSecond);
    if (sampleIntervalSeconds < 0.25 || !Number.isFinite(sampleIntervalSeconds))
      throw new RangeError("View/probe sampling must be bounded");
  }
  private async request(command: HostCommand, generation = this.generation): Promise<HostReply> {
    const start = performance.now();
    const reply = await this.transport.request(command);
    if (this.disposed || generation !== this.generation) return reply;
    this.timings.roundTripMs = performance.now() - start;
    this.timings.processingMs = reply.processingMs;
    this.timings.transportAndSchedulingMs = Math.max(0, this.timings.roundTripMs - reply.processingMs);
    if (reply.batch) {
      this.timings.lastBatchSteps = reply.batch.steps;
      this.timings.lastBatchMs = reply.batch.computeMs;
    }
    if (reply.sample) {
      this.sample = reply.sample;
      for (const listener of this.listeners) listener(reply.sample);
    }
    return reply;
  }
  async initialize(config: Partial<TerrainConfig>, calibration?: LandscapeTimeStatus): Promise<void> {
    await this.request({ kind: "init", config, ...(calibration ? { calibration } : {}) });
  }
  play(): void {
    this.playing = true;
  }
  pause(): void {
    this.playing = false;
    this.clock.reset();
  }
  setSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed < 0.25 || speed > 4)
      throw new RangeError("Speed must be between a quarter and four times normal");
    this.speed = speed;
  }
  /** Called by rAF; returns immediately, never queues another automatic batch while awaiting a reply. */
  advance(realSeconds: number): void {
    if (this.disposed || !this.playing) return;
    this.clock.add(realSeconds, this.speed);
    this.sampleElapsed += Math.min(realSeconds, 0.25);
    if (this.busy) return;
    const steps = this.clock.take();
    if (!steps) return;
    const sample = this.sampleElapsed >= this.sampleIntervalSeconds;
    if (sample) this.sampleElapsed = 0;
    const generation = this.generation;
    this.busy = true;
    void this.request({ kind: "advance", steps, sample })
      .catch((error: unknown) => {
        if (this.disposed || generation !== this.generation) return;
        this.pause();
        for (const listener of this.errors)
          listener(error instanceof Error ? error : new Error(String(error)));
      })
      .finally(() => {
        this.busy = false;
      });
  }
  async refresh(): Promise<void> {
    await this.request({ kind: "sample" });
  }
  async configure(patch: Partial<TunableConfig>): Promise<void> {
    await this.request({ kind: "configure", patch });
  }
  async applyTool(op: ToolOp): Promise<ToolResult> {
    const reply = await this.request({ kind: "tool", op });
    if (!reply.toolResult) throw new Error("Worker omitted tool result");
    return reply.toolResult;
  }
  async reset(): Promise<void> {
    this.pause();
    this.speed = 1;
    this.sampleElapsed = 0;
    this.generation++;
    await this.request({ kind: "reset" });
  }
  subscribe(listener: (sample: HostSample) => void): () => void {
    this.listeners.add(listener);
    if (this.sample) listener(this.sample);
    return () => {
      this.listeners.delete(listener);
    };
  }
  onError(listener: (error: Error) => void): () => void {
    this.errors.add(listener);
    return () => {
      this.errors.delete(listener);
    };
  }
  dispose(): void {
    this.disposed = true;
    this.pause();
    this.transport.dispose();
    this.listeners.clear();
    this.errors.clear();
  }
}
