/**
 * Messages between the glacial host (main thread) and the glacier engine (a Worker, or in-process for tests
 * and as a last resort). The engine owns the one live solver; recorded snapshots leave it as quantized
 * capture bytes and are held, with the kept runs, on the main thread.
 */
import type {
  GlacierConfig,
  GlacierProbes,
  GlacierSnapshot,
  LayerQuantization,
  RockId,
} from "@hachure/glacier";
import type { RunBackend, RunFailure, RunRecord, RunStartIdentity } from "../runs/index";

/** "auto": WebGPU where the recorded parity and this device's check allow it, else the CPU (D-W5-5I). */
export type GlacialBackendPreference = "auto" | RunBackend;

/** Diagnostic GPU faults for the fallback tests (passed to `createGpuGlacier`). Never set in product code. */
export type GlacialGpuFault = "invalid-shader" | "skew-erosion";

export interface GlacialInitCommand {
  readonly kind: "init";
  /** Model overrides for every run (never the rock: that is per run). */
  readonly model: Partial<Omit<GlacierConfig, "rockId">>;
  readonly prefer: GlacialBackendPreference;
  readonly snapshotIntervalYears: number;
  readonly horizonYears: number;
  readonly diagnostics?: { readonly gpuForceFault?: GlacialGpuFault };
}

export type GlacialCommandMessage =
  | GlacialInitCommand
  /** A new run from the authored start with this rock. Disposes the previous live solver. */
  | { readonly kind: "start-run"; readonly runId: string; readonly rockId: RockId }
  /** After a halted GPU run: a new, labelled CPU run from the authored start (never a continuation). */
  | { readonly kind: "restart-on-cpu"; readonly runId: string }
  /** Advance the live run by whole fixed steps, recording at every interval boundary, stopping at the horizon. */
  | { readonly kind: "advance"; readonly steps: number; readonly frame: boolean }
  | { readonly kind: "frame" }
  | { readonly kind: "hash" }
  /** Diagnostic: destroy the GPU device under the live run (exercises the mid-run failure path). */
  | { readonly kind: "fault"; readonly fault: "lose-device" };

/** The live state as the scene shows it (Float32 view data, not a checkpoint). */
export interface GlacialFrame {
  readonly snapshot: GlacierSnapshot;
  readonly probes: GlacierProbes;
}

export interface GlacialRunStarted {
  readonly runId: string;
  readonly rockId: RockId;
  readonly backend: RunBackend;
  readonly fallbackReason: string | null;
  readonly config: GlacierConfig;
  readonly start: RunStartIdentity;
  readonly layers: readonly LayerQuantization[];
}

export interface GlacialReply {
  /** Engine time spent on the request (unit: milliseconds). Diagnostic. */
  readonly processingMs: number;
  readonly run?: GlacialRunStarted;
  /** Snapshots recorded during the request, in order. */
  readonly records?: readonly RunRecord[];
  readonly frame?: GlacialFrame;
  /** Live position after the request. */
  readonly step?: number;
  readonly modelYears?: number;
  /** The run reached its horizon. */
  readonly complete?: boolean;
  /** The run failed during the request and is halted; records made before the failure are included. */
  readonly halted?: RunFailure;
  readonly hash?: string;
  /** Steps advanced and the solver time they took (unit: steps, milliseconds). Diagnostic. */
  readonly batch?: { readonly steps: number; readonly computeMs: number };
}

export interface GlacialTransport {
  request(command: GlacialCommandMessage): Promise<GlacialReply>;
  dispose(): void;
}

export interface GlacialWorkerRequest {
  readonly id: number;
  readonly command: GlacialCommandMessage;
}
export type GlacialWorkerReply =
  { readonly id: number; readonly reply: GlacialReply } | { readonly id: number; readonly error: string };

/** Buffers moved (not copied) with a reply: frame layers and recorded bytes. */
export function glacialReplyTransfers(reply: GlacialReply): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  const snap = reply.frame?.snapshot;
  if (snap)
    for (const layer of [
      snap.bedM,
      snap.iceThicknessM,
      snap.surfaceVelocityXMPerYear,
      snap.surfaceVelocityYMPerYear,
    ])
      buffers.add(layer.buffer as ArrayBuffer);
  for (const record of reply.records ?? []) buffers.add(record.bytes.buffer as ArrayBuffer);
  return [...buffers];
}
