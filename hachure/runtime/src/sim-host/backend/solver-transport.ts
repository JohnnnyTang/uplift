import type { AuthoredTerrainInitial } from "../../reader/contracts";
import { authoredPreset, cloneAuthoredInitial } from "../authored";
import {
  extractChannel,
  measureFixedSectionIncision,
  resolveTerrainConfig,
  tiltedPlateauPreset,
  type SectionSurface,
  type StateSnapshot,
  type TerrainSolver,
  type TerrainSolverFactory,
} from "@hachure/terrain";
import type { HostCommand, HostReply, HostSample, HostTransport, LandscapeTimeStatus } from "../protocol";

type ReferenceSolver = TerrainSolver & {
  referenceLayers():
    Pick<SectionSurface, "bedrockM" | "sedimentM"> | Promise<Pick<SectionSurface, "bedrockM" | "sedimentM">>;
};
/** Main-thread GPU transport; the CPU64 fallback can use the same adapter. */
export class SolverTransport implements HostTransport {
  private chain: Promise<unknown> = Promise.resolve();
  private solver: ReferenceSolver | undefined;
  private baseline: StateSnapshot | undefined;
  private surface: SectionSurface | undefined;
  private baselinePath: ReturnType<typeof extractChannel> | undefined;
  private calibration: LandscapeTimeStatus = { status: "pending" };
  private disposed = false;
  private initial: AuthoredTerrainInitial | undefined;
  private authoredConfig: ReturnType<typeof resolveTerrainConfig> | undefined;
  constructor(private readonly factory: TerrainSolverFactory) {}
  private live(): ReferenceSolver {
    if (!this.solver) throw new Error("Backend is not initialized");
    return this.solver;
  }
  private async currentSurface(): Promise<SectionSurface> {
    const solver = this.live();
    return {
      gridSize: solver.config.gridSize,
      metresPerCell: solver.config.metresPerCell,
      ...(await solver.referenceLayers()),
    };
  }
  private async initialState() {
    const solver = this.live();
    if (this.initial) {
      for (const source of this.initial.sources) await solver.applyTool(source);
      return;
    }
    const layout = tiltedPlateauPreset.layout(solver.config);
    if (layout.outletFace !== "south") throw new Error("Unsupported preset outlet convention");
    await solver.applyTool(layout.source);
    this.baseline = await solver.snapshot();
    this.surface = await this.currentSurface();
    this.baselinePath = extractChannel(this.baseline, { source: layout.source.at });
  }
  private async sample(): Promise<HostSample> {
    const start = performance.now(),
      solver = this.live(),
      snapshot = await solver.snapshot();
    if (this.initial) {
      const empty = {
        path: [],
        method: "steepest-descent" as const,
        complete: false,
        stoppedAt: "boundary" as const,
      };
      return {
        snapshot,
        config: solver.config,
        diagnostics: {
          kind: "unavailable",
          reason: "Authored terrain has no fixed valley reference section or source profile.",
        },
        paths: { baseline: empty, current: { ...empty } },
        observationBaseline: { kind: "reset", step: 0 },
        probes: { incisionDepth: null, sedimentOut: snapshot.budget.exportedSedimentM3 },
        calibration: this.calibration,
        snapshotMs: performance.now() - start,
      };
    }
    const layout = tiltedPlateauPreset.layout(solver.config),
      current = extractChannel(snapshot, { source: layout.source.at }),
      incision = measureFixedSectionIncision(this.surface!, await this.currentSurface());
    return {
      snapshot,
      config: solver.config,
      paths: { baseline: this.baselinePath!, current },
      observationBaseline: { kind: "reset", step: this.baseline!.step },
      probes: { incisionDepth: incision.medianIncisionM, sedimentOut: snapshot.budget.exportedSedimentM3 },
      calibration: this.calibration,
      snapshotMs: performance.now() - start,
    };
  }
  request(command: HostCommand): Promise<HostReply> {
    if (this.disposed) return Promise.reject(new Error("Backend transport is disposed"));
    const accepted = structuredClone(command);
    const result = this.chain.then(() => this.execute(accepted));
    this.chain = result.catch(() => undefined);
    return result;
  }
  private async execute(command: HostCommand): Promise<HostReply> {
    const start = performance.now();
    let sample: HostSample | undefined, toolResult: HostReply["toolResult"], batch: HostReply["batch"];
    switch (command.kind) {
      case "init": {
        this.solver?.dispose();
        const config = resolveTerrainConfig(command.config);
        this.initial = command.initial ? cloneAuthoredInitial(command.initial, config) : undefined;
        this.authoredConfig = this.initial ? config : undefined;
        const solver = await this.factory(
          config,
          this.initial ? authoredPreset(this.initial) : tiltedPlateauPreset,
        );
        if (!("referenceLayers" in solver)) {
          solver.dispose();
          throw new Error("Backend must expose authoritative elevation diagnostics");
        }
        this.solver = solver as ReferenceSolver;
        this.calibration = command.calibration ?? { status: "pending" };
        await this.initialState();
        sample = await this.sample();
        break;
      }
      case "advance": {
        const then = performance.now();
        await this.live().step(command.steps);
        batch = { steps: command.steps, computeMs: performance.now() - then };
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
        if (this.initial) {
          this.live().configure(
            Object.fromEntries(
              Object.entries(this.authoredConfig!).filter(
                ([key]) => !["gridSize", "metresPerCell", "seed"].includes(key),
              ),
            ),
          );
          this.live().reset(authoredPreset(this.initial), this.authoredConfig!.seed);
        } else this.live().reset(tiltedPlateauPreset, this.live().config.seed);
        await this.initialState();
        sample = await this.sample();
        break;
    }
    return {
      processingMs: performance.now() - start,
      ...(sample ? { sample } : {}),
      ...(batch ? { batch } : {}),
      ...(toolResult ? { toolResult } : {}),
    };
  }
  dispose() {
    this.disposed = true;
    void this.chain.then(() => this.solver?.dispose());
  }
}
