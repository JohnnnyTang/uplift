/**
 * Shared pieces of the CPU/GPU glacier comparison suites (session 5I): adapter evidence, evidence files, and
 * an arm recorder producing the same per-snapshot record as the 5G review runner
 * (`src/testing/review/run-arm.review.test.ts`), so `evaluateProtocol` reads GPU arms exactly as CPU arms.
 */
import { server } from "vitest/browser";
import type { GlacierConfig } from "../../src/contract/config";
import { type SectionMeasure, measureSection } from "../../src/contract/probes";
import type { GlacierDiagnostics, GlacierProbes, IceBudget } from "../../src/contract/index";
import type { CpuGlacierSolver } from "../../src/cpu/solver";
import type { GpuGlacierSolver } from "../../src/gpu/index";
import { PROTOCOL_SECTIONS } from "../../src/testing/protocol";

/**
 * Evidence directory, relative to the Vitest root (hachure/glacier). GLACIER_GPU_OUT redirects it, so an
 * acceptance rerun (5N) keeps its own record and never overwrites the 5I evidence.
 */
export const EVIDENCE_DIR = __GLACIER_GPU_OUT__ ?? "../../docs/review/glacial/gpu";
/** Registered CPU records from 5G2 (relative to the Vitest root). */
export const CPU_RECORDS_DIR = "../../docs/review/glacial/model";

export async function adapterEvidence() {
  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: "high-performance" });
  return {
    available: Boolean(adapter),
    utc: new Date().toISOString(),
    userAgent: navigator.userAgent,
    adapter: adapter
      ? {
          vendor: adapter.info.vendor,
          architecture: adapter.info.architecture,
          device: adapter.info.device,
          description: adapter.info.description,
          isFallbackAdapter: (adapter.info as { isFallbackAdapter?: boolean }).isFallbackAdapter ?? null,
          maxStorageBuffersPerShaderStage: adapter.limits.maxStorageBuffersPerShaderStage,
        }
      : null,
    capability: adapter ? "available" : "SKIPPED: WebGPU adapter unavailable (not counted as parity)",
  };
}

export async function writeEvidence(name: string, data: unknown): Promise<void> {
  await server.commands.writeFile(`${EVIDENCE_DIR}/${name}`, JSON.stringify(data, null, 2) + "\n");
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await server.commands.readFile(path)) as T;
}

/** Lets the browser breathe during long synchronous CPU runs (the test RPC must stay responsive). */
export const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Advances the CPU in slices, yielding between them. Returns the milliseconds spent stepping. */
export async function advanceCpu(cpu: CpuGlacierSolver, steps: number, slice = 400): Promise<number> {
  let ms = 0;
  for (let done = 0; done < steps; done += slice) {
    const t0 = performance.now();
    cpu.advance(Math.min(slice, steps - done));
    ms += performance.now() - t0;
    await yieldToBrowser();
  }
  return ms;
}

export interface Fields {
  readonly bedM: ArrayLike<number>;
  readonly initialBedM: ArrayLike<number>;
  readonly iceThicknessM: ArrayLike<number>;
}

/** One backend seen through Float64 fields, for recording and comparison. */
export interface Recordable {
  readonly config: GlacierConfig;
  readonly modelYears: number;
  fields(): Promise<Fields>;
  section(i: number): Promise<SectionMeasure>;
  probes(): Promise<GlacierProbes>;
  budget(): Promise<IceBudget>;
  diagnostics(): Promise<GlacierDiagnostics>;
  hash(): Promise<string>;
}

export function recordableCpu(cpu: CpuGlacierSolver): Recordable {
  const grid = { nx: cpu.config.nx, ny: cpu.config.ny, metresPerCell: cpu.config.metresPerCell };
  return {
    config: cpu.config,
    get modelYears() {
      return cpu.modelYears;
    },
    fields: async () => cpu.fields,
    section: async (i) => measureSection(cpu.fields.bedM, cpu.fields.iceThicknessM, grid, i),
    probes: async () => cpu.probes(),
    budget: async () => cpu.budget(),
    diagnostics: async () => cpu.diagnostics(),
    hash: async () => cpu.hash(),
  };
}

export function recordableGpu(gpu: GpuGlacierSolver): Recordable {
  return {
    config: gpu.config,
    get modelYears() {
      return gpu.modelYears;
    },
    fields: () => gpu.fields(),
    section: (i) => gpu.section(i),
    probes: () => gpu.probes(),
    budget: () => gpu.budget(),
    diagnostics: () => gpu.diagnostics(),
    hash: () => gpu.hash(),
  };
}

export type SectionWithArea = SectionMeasure & { readonly erodedAreaM2: number };

export interface SeriesEntry {
  readonly modelYears: number;
  readonly probes: GlacierProbes;
  readonly budget: IceBudget;
  readonly diagnostics: GlacierDiagnostics;
  readonly sections: Record<string, SectionWithArea>;
}

/** Same measures as the 5G review runner records every snapshot interval (unrounded). */
export async function seriesEntry(s: Recordable): Promise<SeriesEntry> {
  const c = s.config;
  const f = await s.fields();
  const erodedAreaM2 = (i: number) => {
    let a = 0;
    for (let j = 0; j < c.ny; j++) a += f.initialBedM[j * c.nx + i]! - f.bedM[j * c.nx + i]!;
    return a * c.metresPerCell;
  };
  const sections: Record<string, SectionWithArea> = {};
  for (const [name, i] of Object.entries(PROTOCOL_SECTIONS))
    sections[name] = { ...(await s.section(i)), erodedAreaM2: erodedAreaM2(i) };
  return {
    modelYears: s.modelYears,
    probes: await s.probes(),
    budget: await s.budget(),
    diagnostics: await s.diagnostics(),
    sections,
  };
}

export function row(field: ArrayLike<number>, c: GlacierConfig, i: number): number[] {
  return Array.from({ length: c.ny }, (_, j) => field[j * c.nx + i]!);
}

/** The review runner's rounding (3 decimals; NaN → null), so GPU records match the CPU records' treatment. */
export const round = (x: number, d = 3) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null);
export const roundObj = (o: object) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "number" ? round(v) : v]));
export function roundEntry(e: SeriesEntry) {
  return {
    modelYears: round(e.modelYears),
    probes: roundObj(e.probes),
    budget: roundObj(e.budget),
    diagnostics: e.diagnostics,
    sections: Object.fromEntries(Object.entries(e.sections).map(([k, v]) => [k, roundObj(v)])),
  };
}
