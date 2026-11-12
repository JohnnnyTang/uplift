/**
 * Captured runs: recorded snapshot series of one run, the fixture format for 5H/5K and the view-data
 * format for 5J's kept runs (frozen contract, session 5G; documented in
 * hachure/glacier/src/testing/captured-runs/README.md).
 *
 * A capture is two files:
 *   - `<name>.json`: a {@link CapturedRunManifest} (config, grid, layer quantization, snapshot times, probes);
 *   - `<name>.bin`: the snapshots back to back. Each snapshot is the {@link GLACIER_LAYERS} in order, each
 *     layer `nx * ny` little-endian uint16 values, row-major `j * nx + i`. A value decodes as
 *     `offset + scale * u16`; the maximum quantization error is `scale / 2`.
 *
 * Snapshots are view data, not resumable checkpoints (wave plan §4).
 */
import type { GlacierConfig } from "./config";
import type { GlacierProbes } from "./probes";
import type { RockId } from "./rocks";
import { GLACIER_LAYERS, type GlacierLayer, type GlacierSnapshot } from "./state";

export const CAPTURE_FORMAT = "hachure-glacier-capture";
export const CAPTURE_VERSION = 1;

export interface LayerQuantization {
  readonly layer: GlacierLayer;
  /** Value of u16 = 0 (unit: the layer's unit). */
  readonly offset: number;
  /** Step per u16 count (unit: the layer's unit). */
  readonly scale: number;
}

export interface CapturedSnapshotEntry {
  readonly index: number;
  readonly step: number;
  readonly modelYears: number;
  /** Byte offset of this snapshot in the `.bin` file. */
  readonly byteOffset: number;
  /** Whole-run probes at this moment, computed from the Float64 state before quantization. */
  readonly probes: GlacierProbes;
}

export interface CapturedRunManifest {
  readonly format: typeof CAPTURE_FORMAT;
  readonly version: typeof CAPTURE_VERSION;
  readonly rockId: RockId;
  /** The full run config; every capture of a protocol differs only in `rockId`. */
  readonly config: GlacierConfig;
  /** Identifier of the authored start and its options. */
  readonly start: { readonly preset: string; readonly options: Readonly<Record<string, number>> };
  readonly grid: { readonly nx: number; readonly ny: number; readonly metresPerCell: number };
  readonly layers: readonly LayerQuantization[];
  /** Model-time spacing of the snapshots (unit: model years). */
  readonly snapshotIntervalYears: number;
  readonly bytesPerSnapshot: number;
  /** File name of the binary payload, relative to the manifest. */
  readonly binFile: string;
  /** `hash()` of the Float64 state at the last snapshot, for determinism checks. */
  readonly finalStateHash: string;
  readonly snapshots: readonly CapturedSnapshotEntry[];
}

/** Default quantization: bed 0.05 m, ice 0.01 m, velocity 0.05 m/yr (±1638 m/yr). */
export function defaultQuantization(bedMinM: number): LayerQuantization[] {
  return [
    { layer: "bedM", offset: Math.floor(bedMinM) - 100, scale: 0.05 },
    { layer: "iceThicknessM", offset: 0, scale: 0.01 },
    { layer: "surfaceVelocityXMPerYear", offset: -1638.4, scale: 0.05 },
    { layer: "surfaceVelocityYMPerYear", offset: -1638.4, scale: 0.05 },
  ];
}

export interface EncodedCapture {
  readonly manifest: CapturedRunManifest;
  readonly bytes: Uint8Array;
  /** Values that fell outside the u16 range and were clamped (should be 0). */
  readonly clampedValues: number;
}

export function encodeCapturedRun(input: {
  readonly config: GlacierConfig;
  readonly start: CapturedRunManifest["start"];
  readonly snapshots: readonly { readonly snapshot: GlacierSnapshot; readonly probes: GlacierProbes }[];
  readonly snapshotIntervalYears: number;
  readonly binFile: string;
  readonly finalStateHash: string;
  readonly quantization?: readonly LayerQuantization[];
}): EncodedCapture {
  const first = input.snapshots[0];
  if (!first) throw new Error("a capture needs at least one snapshot");
  const { nx, ny, metresPerCell } = first.snapshot;
  const cells = nx * ny;
  let bedMin = Number.POSITIVE_INFINITY;
  for (const { snapshot } of input.snapshots) for (const z of snapshot.bedM) bedMin = Math.min(bedMin, z);
  const layers = input.quantization ?? defaultQuantization(bedMin);
  const bytesPerSnapshot = GLACIER_LAYERS.length * cells * 2;
  const bytes = new Uint8Array(bytesPerSnapshot * input.snapshots.length);
  const view = new DataView(bytes.buffer);
  let clamped = 0;
  const entries: CapturedSnapshotEntry[] = [];
  input.snapshots.forEach(({ snapshot, probes }, index) => {
    if (snapshot.nx !== nx || snapshot.ny !== ny) throw new Error("all snapshots must share a grid");
    const base = index * bytesPerSnapshot;
    GLACIER_LAYERS.forEach((layer, li) => {
      const q = layers[li]!;
      if (q.layer !== layer) throw new Error(`quantization order must follow GLACIER_LAYERS (${layer})`);
      const field = snapshot[layer];
      const o = base + li * cells * 2;
      for (let k = 0; k < cells; k++) {
        let u = Math.round((field[k]! - q.offset) / q.scale);
        if (u < 0 || u > 65535) {
          clamped++;
          u = Math.min(65535, Math.max(0, u));
        }
        view.setUint16(o + k * 2, u, true);
      }
    });
    entries.push({ index, step: snapshot.step, modelYears: snapshot.modelYears, byteOffset: base, probes });
  });
  const manifest: CapturedRunManifest = {
    format: CAPTURE_FORMAT,
    version: CAPTURE_VERSION,
    rockId: input.config.rockId,
    config: input.config,
    start: input.start,
    grid: { nx, ny, metresPerCell },
    layers,
    snapshotIntervalYears: input.snapshotIntervalYears,
    bytesPerSnapshot,
    binFile: input.binFile,
    finalStateHash: input.finalStateHash,
    snapshots: entries,
  };
  return { manifest, bytes, clampedValues: clamped };
}

/** A decoded capture. Snapshots decode lazily, so holding a run costs only its compressed bytes. */
export interface CapturedRun {
  readonly manifest: CapturedRunManifest;
  readonly count: number;
  /** Model time of every snapshot (unit: model years), ascending. */
  readonly times: readonly number[];
  snapshot(index: number): GlacierSnapshot;
  /** Index of the snapshot nearest in model time (ties go to the earlier one). */
  nearestIndex(modelYears: number): number;
}

export function decodeCapturedRun(
  manifest: CapturedRunManifest,
  payload: ArrayBuffer | Uint8Array,
): CapturedRun {
  if (manifest.format !== CAPTURE_FORMAT)
    throw new Error(`not a glacier capture (format ${String(manifest.format)})`);
  if (manifest.version !== CAPTURE_VERSION)
    throw new Error(`unsupported capture version ${manifest.version}`);
  const { nx, ny, metresPerCell } = manifest.grid;
  const cells = nx * ny;
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const expected = manifest.bytesPerSnapshot * manifest.snapshots.length;
  if (manifest.bytesPerSnapshot !== GLACIER_LAYERS.length * cells * 2)
    throw new Error("bytesPerSnapshot does not match the grid");
  if (bytes.byteLength !== expected)
    throw new Error(`payload is ${bytes.byteLength} bytes, expected ${expected}`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const times = manifest.snapshots.map((s) => s.modelYears);
  return {
    manifest,
    count: manifest.snapshots.length,
    times,
    snapshot(index: number): GlacierSnapshot {
      const entry = manifest.snapshots[index];
      if (!entry) throw new RangeError(`snapshot ${index} outside [0, ${manifest.snapshots.length - 1}]`);
      const out: Partial<Record<GlacierLayer, Float32Array>> = {};
      GLACIER_LAYERS.forEach((layer, li) => {
        const q = manifest.layers[li]!;
        const field = new Float32Array(cells);
        const o = entry.byteOffset + li * cells * 2;
        for (let k = 0; k < cells; k++) field[k] = q.offset + q.scale * view.getUint16(o + k * 2, true);
        out[layer] = field;
      });
      return {
        nx,
        ny,
        metresPerCell,
        rockId: manifest.rockId,
        step: entry.step,
        modelYears: entry.modelYears,
        bedM: out.bedM!,
        iceThicknessM: out.iceThicknessM!,
        surfaceVelocityXMPerYear: out.surfaceVelocityXMPerYear!,
        surfaceVelocityYMPerYear: out.surfaceVelocityYMPerYear!,
      };
    },
    nearestIndex(modelYears: number): number {
      let best = 0;
      for (let i = 1; i < times.length; i++) {
        if (Math.abs(times[i]! - modelYears) < Math.abs(times[best]! - modelYears)) best = i;
      }
      return best;
    },
  };
}
