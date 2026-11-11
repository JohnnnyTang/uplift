/**
 * One asynchronous solver interface for both backends (session 5I), so the runtime (5J) selects a backend
 * without branching on it. It mirrors the frozen synchronous `GlacierSolver` contract method for method;
 * the CPU adapter below wraps the reference solver unchanged.
 */
import type { GlacierConfig } from "../contract/config";
import {
  type GlacierProbes,
  type SectionMeasure,
  type SectionOptions,
  measureSection,
} from "../contract/probes";
import type { GlacierDiagnostics, GlacierSnapshot, IceBudget } from "../contract/state";
import type { CpuGlacierSolver } from "../cpu/solver";

export type GlacierBackendId = "webgpu" | "cpu";

export interface AsyncGlacierSolver {
  /** Which solver computes this run. Fixed for the life of the run. */
  readonly backend: GlacierBackendId;
  readonly config: GlacierConfig;
  /** Completed fixed steps (unit: steps). */
  readonly step: number;
  /** `step × dtYears` (unit: model years). */
  readonly modelYears: number;
  /** Advance by whole fixed steps. Rejects (and the run halts) on failure; never switches backend. */
  advance(steps: number): Promise<void>;
  /** Advance by `round(years / dtYears)` steps. */
  advanceYears(years: number): Promise<void>;
  /** A Float32 copy of the current state (view data). Never changes the model. */
  snapshot(): Promise<GlacierSnapshot>;
  probes(): Promise<GlacierProbes>;
  section(i: number, options?: SectionOptions): Promise<SectionMeasure>;
  budget(): Promise<IceBudget>;
  diagnostics(): Promise<GlacierDiagnostics>;
  /** 16-hex digest of step + Float64 bed and ice (the GPU hashes its Float64 lane reconstruction). */
  hash(): Promise<string>;
  dispose(): Promise<void>;
}

/** Wraps the CPU reference solver in the asynchronous interface. The CPU solver is not changed. */
export function asyncCpuGlacier(cpu: CpuGlacierSolver): AsyncGlacierSolver {
  const grid = { nx: cpu.config.nx, ny: cpu.config.ny, metresPerCell: cpu.config.metresPerCell };
  const run = <T>(fn: () => T): Promise<T> => {
    try {
      return Promise.resolve(fn());
    } catch (error) {
      return Promise.reject(error);
    }
  };
  return {
    backend: "cpu",
    config: cpu.config,
    get step() {
      return cpu.step;
    },
    get modelYears() {
      return cpu.modelYears;
    },
    advance: (steps) => run(() => cpu.advance(steps)),
    advanceYears: (years) => run(() => cpu.advanceYears(years)),
    snapshot: () => run(() => cpu.snapshot()),
    probes: () => run(() => cpu.probes()),
    section: (i, options) =>
      run(() => measureSection(cpu.fields.bedM, cpu.fields.iceThicknessM, grid, i, options)),
    budget: () => run(() => cpu.budget()),
    diagnostics: () => run(() => cpu.diagnostics()),
    hash: () => run(() => cpu.hash()),
    dispose: () => Promise.resolve(),
  };
}
