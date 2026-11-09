/**
 * TerrainSolver: the one interface every backend implements (CPU reference, CPU in a Worker, WebGPU, and
 * the test fake). Mutating calls are synchronous and ordered: a GPU backend enqueues work, a Worker backend
 * posts a message. Reads are async, so GPU readback fits behind the same interface.
 */
import type { TerrainConfig, TunableConfig } from "./config";
import type { BudgetCounters, Cell, LayerName, TerrainLayers, TerrainState } from "./state";
import type { ToolOp, ToolResult } from "./tools";

/** A starting landscape. Presets are data plus a deterministic builder (session 2B). */
export interface TerrainPreset {
  /** Stable id, for example "tilted-plateau". */
  readonly id: string;
  /**
   * Builds the initial state for this grid size, cell size and seed. Must be deterministic: the same
   * inputs give a bitwise-identical state within the same JavaScript engine. Must not use `Math.random()`.
   */
  create(config: Pick<TerrainConfig, "gridSize" | "metresPerCell" | "seed" | "hardnessRange">): TerrainState;
}

/** A read-only copy of solver state at one step. Mutating it never affects the solver. */
export interface StateSnapshot {
  /** Steps taken since the last reset. */
  readonly step: number;
  /** Simulated time since the last reset (unit: simulated years). */
  readonly simYears: number;
  readonly gridSize: number;
  /** Cell size (unit: metres). */
  readonly metresPerCell: number;
  readonly outlet: Cell;
  /** The requested layers (all of them by default). */
  readonly layers: Partial<TerrainLayers>;
  readonly budget: BudgetCounters;
}

export interface SnapshotOptions {
  /** Read back only these layers. Defaults to every layer. Lets probes keep GPU readback small. */
  readonly layers?: readonly LayerName[];
}

export type SolverBackend = "cpu" | "cpu-worker" | "gpu" | "fake";

export interface TerrainSolver {
  readonly backend: SolverBackend;
  /** The current config, including changes made through `configure`. */
  readonly config: TerrainConfig;
  /** Steps taken since the last reset, counting steps already enqueued. */
  readonly stepCount: number;

  /** Advances `n` fixed steps (default 1). `n` must be a non-negative integer. */
  step(n?: number): void;
  /** Changes tunable parameters from the next step on. Never resets the state. */
  configure(patch: Partial<TunableConfig>): void;
  /** Applies one tool op. The result reports any clamps that engaged. */
  applyTool(op: ToolOp): Promise<ToolResult>;
  /** Copies the current state. */
  snapshot(options?: SnapshotOptions): Promise<StateSnapshot>;
  /** The budget counters since the last reset. */
  budget(): Promise<BudgetCounters>;
  /**
   * A digest of the full state and step count. Same config, preset, seed and op log ⇒ same hash: bitwise
   * on the CPU within the same JavaScript engine, and on the same device/driver for the GPU (tension T5). Computed with `hashSnapshot`.
   */
  hash(): Promise<string>;
  /** Rebuilds the state from a preset with this seed, zeroes the step count and budget, removes sources. */
  reset(preset: TerrainPreset, seed: number): void;
  /** Frees resources. Every later call throws. */
  dispose(): void;
}

/** Signature every backend's factory follows. The solver starts reset to `preset` with `config.seed`. */
export type TerrainSolverFactory = (
  config: TerrainConfig,
  preset: TerrainPreset,
) => TerrainSolver | Promise<TerrainSolver>;

/** Thrown by any call on a disposed solver. */
export class SolverDisposedError extends Error {
  constructor() {
    super("TerrainSolver has been disposed");
    this.name = "SolverDisposedError";
  }
}
