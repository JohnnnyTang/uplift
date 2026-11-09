import {
  createCpuSolver,
  extractChannel,
  measureFixedSectionIncision,
  tiltedPlateauPreset,
  type CpuTerrainSolver,
  type ChannelResult,
  type StateSnapshot,
  type PresetLayout,
  type SectionSurface,
} from "@hachure/terrain";
import type {
  HostCommand,
  HostReply,
  HostSample,
  LandscapeTimeStatus,
  WorkerReply,
  WorkerRequest,
} from "./protocol";

/** Worker-owned solver. This class is also directly testable without browser globals. */
export class TerrainWorkerEngine {
  private solver: CpuTerrainSolver | undefined;
  private calibration: LandscapeTimeStatus = { status: "pending" };
  private layout: PresetLayout | undefined;
  private baseline: StateSnapshot | undefined;
  private baselineSurface: SectionSurface | undefined;
  private baselinePath: ChannelResult | undefined;
  private async initialState(): Promise<void> {
    const solver = this.live();
    const layout = (this.layout = tiltedPlateauPreset.layout(solver.config));
    if (layout.outletFace !== "south" || solver.outletBaseLevelM !== layout.baseLevelM)
      throw new Error("Preset outlet metadata disagrees with CPU boundary convention");
    await solver.applyTool(layout.source);
    this.baseline = await solver.snapshot();
    this.baselineSurface = this.referenceSurface();
    this.baselinePath = extractChannel(this.baseline, { source: layout.source.at });
  }
  private live(): CpuTerrainSolver {
    if (!this.solver) throw new Error("Worker is not initialized");
    return this.solver;
  }
  private referenceSurface(): SectionSurface {
    const solver = this.live();
    const { bedrockM, sedimentM } = solver.referenceLayers();
    return {
      gridSize: solver.config.gridSize,
      metresPerCell: solver.config.metresPerCell,
      bedrockM,
      sedimentM,
    };
  }
  private async sample(): Promise<HostSample> {
    const start = performance.now();
    const solver = this.live();
    const snapshot = await solver.snapshot();
    const layout = this.layout!;
    const baseline = this.baselinePath!;
    const current = extractChannel(snapshot, { source: layout.source.at });
    const incision = measureFixedSectionIncision(this.baselineSurface!, this.referenceSurface());
    return {
      snapshot,
      config: solver.config,
      paths: { baseline, current },
      observationBaseline: { kind: "reset", step: this.baseline!.step },
      probes: { incisionDepth: incision.medianIncisionM, sedimentOut: snapshot.budget.exportedSedimentM3 },
      calibration: this.calibration,
      snapshotMs: performance.now() - start,
    };
  }
  async execute(command: HostCommand): Promise<HostReply> {
    const start = performance.now();
    let sample: HostSample | undefined;
    let toolResult;
    let batch: HostReply["batch"];
    switch (command.kind) {
      case "init":
        this.solver?.dispose();
        this.solver = createCpuSolver(command.config, tiltedPlateauPreset);
        this.calibration = command.calibration ?? { status: "pending" };
        await this.initialState();
        sample = await this.sample();
        break;
      case "advance": {
        const stepStart = performance.now();
        this.live().step(command.steps);
        batch = { steps: command.steps, computeMs: performance.now() - stepStart };
        if (command.sample) sample = await this.sample();
        break;
      }
      case "sample":
        sample = await this.sample();
        break;
      case "configure":
        this.live().configure(command.patch);
        sample = await this.sample();
        break;
      case "tool":
        toolResult = await this.live().applyTool(command.op);
        sample = await this.sample();
        break;
      case "reset":
        this.live().reset(tiltedPlateauPreset, this.live().config.seed);
        await this.initialState();
        sample = await this.sample();
        break;
    }
    return {
      ...(sample ? { sample } : {}),
      ...(toolResult ? { toolResult } : {}),
      processingMs: performance.now() - start,
      ...(batch ? { batch } : {}),
    };
  }
  dispose(): void {
    this.solver?.dispose();
  }
}

/** Only snapshot copies are transferred; authoritative solver and baseline arrays stay in the Worker. */
export function snapshotTransfers(reply: HostReply): ArrayBuffer[] {
  return Object.values(reply.sample?.snapshot.layers ?? {}).map((layer) => layer.buffer as ArrayBuffer);
}
export interface TerrainWorkerScope {
  addEventListener(type: "message", listener: (event: MessageEvent<WorkerRequest>) => void): void;
  postMessage(message: WorkerReply, transfer: Transferable[]): void;
}
export function installTerrainWorker(scope: TerrainWorkerScope): void {
  const engine = new TerrainWorkerEngine();
  let queue = Promise.resolve();
  scope.addEventListener("message", ({ data }) => {
    queue = queue.then(async () => {
      try {
        const reply = await engine.execute(data.command);
        scope.postMessage({ id: data.id, reply }, snapshotTransfers(reply));
      } catch (error) {
        scope.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) }, []);
      }
    });
  });
}
