import { createCpuSolver, resolveTerrainConfig, type TerrainConfig } from "@hachure/terrain";
import type { HostCommand, HostReply, HostSample, HostTransport, LandscapeTimeStatus } from "../protocol";
import { SolverTransport } from "./solver-transport";

export type TerrainBackend = "webgpu" | "cpu-worker" | "cpu-64" | "flat";
export const TERRAIN_BACKENDS: readonly TerrainBackend[] = ["webgpu", "cpu-worker", "cpu-64", "flat"];
/** Engineering tiers cover the same domain; these are not calibrated field parameters. */
export function backendConfig(backend: TerrainBackend, config: Partial<TerrainConfig> = {}): TerrainConfig {
  const gridSize = backend === "webgpu" ? 256 : backend === "cpu-worker" ? 128 : 64;
  const metresPerCell = 1280 / gridSize;
  return resolveTerrainConfig({ ...config, gridSize, metresPerCell, pipeAreaM2: 0.2 * metresPerCell ** 2 });
}
export function forcedBackend(search: string): TerrainBackend | undefined {
  const value = new URLSearchParams(search).get("backend");
  if (value === null || value === "auto") return undefined;
  if (TERRAIN_BACKENDS.includes(value as TerrainBackend)) return value as TerrainBackend;
  throw new RangeError(`Unknown backend: ${value}`);
}
export interface BackendSelectionOptions {
  readonly config?: Partial<TerrainConfig>;
  readonly calibration?: LandscapeTimeStatus;
  readonly search?: string;
  readonly createWorkerTransport: () => HostTransport | Promise<HostTransport>;
  /** Defaults to a real WebGL2 context check. False leaves a flat drawing after GPU failure. */
  readonly canRenderWebGL2?: () => boolean | Promise<boolean>;
  /** Test/embedding injection; production lazily imports the complete GPU solver. */
  readonly createGpuTransport?: () => HostTransport | Promise<HostTransport>;
  readonly createCpu64Transport?: () => HostTransport | Promise<HostTransport>;
  /** Compute admission bound, excluding rendering. Default 1000/30 ms. Forced tiers bypass this probe. */
  readonly maxStepMs?: number;
  /** Optional extra admission check. May advance the solver: selection reinitializes afterwards. */
  readonly admit?: (
    backend: Exclude<TerrainBackend, "flat">,
    transport: HostTransport,
    config: TerrainConfig,
  ) => boolean | Promise<boolean>;
}
export interface BackendSelection {
  readonly backend: TerrainBackend;
  readonly config: TerrainConfig;
  readonly transport: HostTransport | null;
  readonly initialSample: HostSample;
  readonly measuredStepMs: number | null;
  readonly failures: readonly { backend: TerrainBackend; reason: string }[];
}
export function canRenderWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const context = document.createElement("canvas").getContext("webgl2");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(context);
  } catch {
    return false;
  }
}
/** Select before running: degrade resolution, never numerical dt or fixed step order. */
export async function selectTerrainBackend(options: BackendSelectionOptions): Promise<BackendSelection> {
  const forced = forcedBackend(options.search ?? "");
  const failures: { backend: TerrainBackend; reason: string }[] = [];
  const maxStepMs = options.maxStepMs ?? 1000 / 30;
  if (!(Number.isFinite(maxStepMs) && maxStepMs > 0))
    throw new RangeError("Step admission budget must be positive and finite");
  const flat = async (): Promise<BackendSelection> => ({
    backend: "flat",
    config: backendConfig("flat", options.config),
    transport: null,
    initialSample: await createFlatTerrainSample(options.config, options.calibration),
    measuredStepMs: null,
    failures,
  });
  for (const backend of forced ? [forced] : TERRAIN_BACKENDS) {
    if (backend === "flat") return flat();
    const config = backendConfig(backend, options.config);
    let transport: HostTransport | undefined;
    let measuredStepMs: number | null = null;
    try {
      if (backend !== "webgpu" && !(await (options.canRenderWebGL2 ?? canRenderWebGL2)()))
        throw new Error("WebGL2 rendering unavailable");
      if (backend === "webgpu")
        transport = options.createGpuTransport
          ? await options.createGpuTransport()
          : new SolverTransport((config, preset) =>
              import("@hachure/terrain/gpu").then((m) => m.createGpuTerrainSolver(config, preset)),
            );
      else if (backend === "cpu-worker") transport = await options.createWorkerTransport();
      else
        transport = options.createCpu64Transport
          ? await options.createCpu64Transport()
          : new SolverTransport(createCpuSolver);
      const init: HostCommand = {
        kind: "init",
        config,
        ...(options.calibration ? { calibration: options.calibration } : {}),
      };
      let reply = await transport.request(init);
      if (!forced) {
        await transport.request({ kind: "advance", steps: 4, sample: false });
        const start = performance.now();
        const measured = await transport.request({ kind: "advance", steps: 4, sample: false });
        measuredStepMs = (measured.batch?.computeMs ?? performance.now() - start) / 4;
        if (measuredStepMs > maxStepMs)
          throw new Error(
            `Measured compute ${measuredStepMs.toFixed(2)} ms/step exceeds ${maxStepMs.toFixed(2)} ms admission budget`,
          );
      }
      if (options.admit && !(await options.admit(backend, transport, config)))
        throw new Error("Tier exceeds supplied admission budget");
      // Benchmarks never become reader state: restore the same preset, sources, counters and baseline.
      if (!forced || options.admit) reply = await transport.request(init);
      if (!reply.sample) throw new Error("Backend omitted its initial atomic sample");
      const selected = transport;
      let cached: HostReply | undefined = reply;
      return {
        backend,
        config,
        failures,
        initialSample: reply.sample,
        measuredStepMs,
        transport: {
          request(command) {
            if (command.kind === "init") {
              const normalized: HostCommand = { ...command, config: backendConfig(backend, command.config) };
              const sameConfig = JSON.stringify(normalized.config) === JSON.stringify(config);
              const sameCalibration =
                JSON.stringify(command.calibration ?? { status: "pending" }) ===
                JSON.stringify(options.calibration ?? { status: "pending" });
              if (cached && sameConfig && sameCalibration) {
                const result = cached;
                cached = undefined;
                return Promise.resolve(result);
              }
              cached = undefined;
              return selected.request(normalized);
            }
            cached = undefined;
            return selected.request(command);
          },
          dispose() {
            selected.dispose();
          },
        },
      };
    } catch (error) {
      transport?.dispose();
      failures.push({ backend, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return flat();
}
export { SolverTransport } from "./solver-transport";

/** Real preset at step zero, usable immediately before any GPU/Worker initialization. */
export async function createFlatTerrainSample(
  config: Partial<TerrainConfig> = {},
  calibration?: LandscapeTimeStatus,
): Promise<HostSample> {
  const transport = new SolverTransport(createCpuSolver);
  try {
    const reply = await transport.request({
      kind: "init",
      config: backendConfig("flat", config),
      ...(calibration ? { calibration } : {}),
    });
    return reply.sample!;
  } finally {
    transport.dispose();
  }
}

/** Read-only host for a real step-zero preset drawing; it never advances a model. */
export function createFlatTerrainTransport(sample: HostSample): HostTransport {
  if (sample.snapshot.step !== 0) throw new RangeError("Flat terrain transport requires a step-zero sample");
  const initial = structuredClone(sample);
  let disposed = false;
  return {
    request(command) {
      if (disposed) return Promise.reject(new Error("Flat terrain transport is disposed"));
      if (command.kind === "init" || command.kind === "sample" || command.kind === "reset")
        return Promise.resolve({ processingMs: 0, sample: structuredClone(initial) });
      return Promise.reject(new Error("Flat drawing is read-only; live simulation controls are unavailable"));
    },
    dispose() {
      disposed = true;
    },
  };
}
