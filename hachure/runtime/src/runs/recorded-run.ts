/**
 * A recorded run: the snapshot series of one glacier run, kept as view data in the frozen capture format
 * (`hachure-glacier-capture` v1, D-W5-5G item 6), so the same code that reads 5G's captured fixtures reads
 * live and kept runs. Snapshots are view data, never resumable checkpoints (wave plan §4): there is no way
 * to continue or branch a run from one.
 */
import {
  CAPTURE_FORMAT,
  CAPTURE_VERSION,
  type CapturedRun,
  type CapturedRunManifest,
  type CapturedSnapshotEntry,
  type GlacierConfig,
  type GlacierProbes,
  type GlacierSnapshot,
  type LayerQuantization,
  type RockId,
  decodeCapturedRun,
  defaultQuantization,
  encodeCapturedRun,
} from "@hachure/glacier";

/** Backend that computed a run. Mirrors `GlacierBackendId` of `@hachure/glacier/gpu` without loading GPU code. */
export type RunBackend = "webgpu" | "cpu";

/** Why a run stopped before its horizon. `reason` is the labelled GPU failure, or "solver-error". */
export interface RunFailure {
  readonly reason: string;
  readonly message: string;
  /** Last completed step before the failure (unit: steps). Nothing after it was recorded. */
  readonly atStep: number;
  readonly backend: RunBackend;
}

/** One recorded snapshot as it leaves the solver: quantized bytes plus the Float64 probes and state hash. */
export interface RunRecord {
  readonly index: number;
  readonly step: number;
  readonly modelYears: number;
  readonly probes: GlacierProbes;
  /** `hash()` of the Float64 state at this step (16 hex digits); equal runs give equal hashes. */
  readonly stateHash: string;
  readonly bytes: Uint8Array;
  /** Values outside the quantization range, clamped (0 expected). */
  readonly clampedValues: number;
}

/** Below the start's lowest bed, room for erosion before quantization clamps (unit: metres). */
export const BED_HEADROOM_M = 400;

/**
 * Quantization for a run, fixed at its start (snapshots are encoded one by one as they are recorded, so it
 * cannot depend on later beds). The capture defaults (bed 0.05 m, ice 0.01 m, velocity 0.05 m/yr) with the
 * bed offset 500 m below the start's lowest bed. Throws if the start does not fit.
 */
export function runQuantization(startBedM: ArrayLike<number>): LayerQuantization[] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let k = 0; k < startBedM.length; k++) {
    min = Math.min(min, startBedM[k]!);
    max = Math.max(max, startBedM[k]!);
  }
  const layers = defaultQuantization(min - BED_HEADROOM_M);
  const bed = layers[0]!;
  if (!(Number.isFinite(min) && max <= bed.offset + bed.scale * 65535))
    throw new RangeError(`start bed range [${min}, ${max}] m does not fit the snapshot quantization`);
  return layers;
}

export interface RunStartIdentity {
  readonly preset: string;
  readonly options: Readonly<Record<string, number>>;
}

/** Encodes one snapshot with the run's fixed quantization, through the frozen capture encoder. */
export function encodeRunRecord(input: {
  readonly index: number;
  readonly config: GlacierConfig;
  readonly start: RunStartIdentity;
  readonly layers: readonly LayerQuantization[];
  readonly snapshotIntervalYears: number;
  readonly snapshot: GlacierSnapshot;
  readonly probes: GlacierProbes;
  readonly stateHash: string;
}): RunRecord {
  const encoded = encodeCapturedRun({
    config: input.config,
    start: input.start,
    snapshots: [{ snapshot: input.snapshot, probes: input.probes }],
    snapshotIntervalYears: input.snapshotIntervalYears,
    binFile: "",
    finalStateHash: input.stateHash,
    quantization: input.layers,
  });
  return {
    index: input.index,
    step: input.snapshot.step,
    modelYears: input.snapshot.modelYears,
    probes: input.probes,
    stateHash: input.stateHash,
    bytes: encoded.bytes,
    clampedValues: encoded.clampedValues,
  };
}

export type RunStatus = "active" | "complete" | "halted";

export interface RecordedRunIdentity {
  readonly id: string;
  /** Reader-facing run number, 1 for the first run since the last reset (unit: none). */
  readonly ordinal: number;
  readonly rockId: RockId;
  readonly backend: RunBackend;
  /** Why this run is not on the requested backend (shown in the deeper level); null when it is. */
  readonly fallbackReason: string | null;
  readonly config: GlacierConfig;
  readonly start: RunStartIdentity;
  readonly layers: readonly LayerQuantization[];
  readonly snapshotIntervalYears: number;
  /** Most snapshots the run may hold (unit: snapshots); the memory budget is computed from it. */
  readonly maxSnapshots: number;
}

/**
 * A run's recorded snapshots plus its live position. Implements `CapturedRun`, so a consumer of 5G's
 * captured fixtures (for example the 5H/5K scene) can show a live or kept run unchanged.
 */
export class RecordedRun implements CapturedRun {
  readonly id: string;
  readonly ordinal: number;
  readonly rockId: RockId;
  readonly backend: RunBackend;
  readonly fallbackReason: string | null;
  readonly config: GlacierConfig;
  private readonly identity: RecordedRunIdentity;
  private readonly chunks: Uint8Array[] = [];
  private readonly entries: (CapturedSnapshotEntry & { readonly stateHash: string })[] = [];
  private readonly bytesPerSnapshot: number;
  private cachedManifest: CapturedRunManifest | undefined;
  private clamped = 0;
  private statusValue: RunStatus = "active";
  private failureValue: RunFailure | null = null;
  private stepValue = 0;
  private modelYearsValue = 0;

  constructor(identity: RecordedRunIdentity) {
    this.identity = identity;
    this.id = identity.id;
    this.ordinal = identity.ordinal;
    this.rockId = identity.rockId;
    this.backend = identity.backend;
    this.fallbackReason = identity.fallbackReason;
    this.config = identity.config;
    if (identity.config.rockId !== identity.rockId) throw new Error("run rock and config rock differ");
    this.bytesPerSnapshot = identity.layers.length * identity.config.nx * identity.config.ny * 2;
  }

  /** Latest live step of the run (unit: steps); for a kept run, where it stopped. */
  get step(): number {
    return this.stepValue;
  }
  get modelYears(): number {
    return this.modelYearsValue;
  }
  get status(): RunStatus {
    return this.statusValue;
  }
  get failure(): RunFailure | null {
    return this.failureValue;
  }
  /** True once the run has advanced past its start; only then is it kept when another run starts. */
  get hasHistory(): boolean {
    return this.stepValue > 0;
  }
  get count(): number {
    return this.entries.length;
  }
  get times(): readonly number[] {
    return this.entries.map((e) => e.modelYears);
  }
  /** Recorded bytes held (unit: bytes). */
  get recordedBytes(): number {
    return this.chunks.length * this.bytesPerSnapshot;
  }
  get clampedValues(): number {
    return this.clamped;
  }

  /** Appends the next recorded snapshot. Records arrive in order, on the run's grid, within its limit. */
  append(record: RunRecord): void {
    if (this.statusValue !== "active")
      throw new Error(`run ${this.id} is ${this.statusValue}; it records no more`);
    if (record.index !== this.entries.length)
      throw new Error(`run ${this.id} expected snapshot ${this.entries.length}, got ${record.index}`);
    if (this.entries.length >= this.identity.maxSnapshots)
      throw new RangeError(`run ${this.id} already holds its ${this.identity.maxSnapshots} snapshots`);
    if (record.bytes.byteLength !== this.bytesPerSnapshot)
      throw new Error(`snapshot is ${record.bytes.byteLength} bytes, expected ${this.bytesPerSnapshot}`);
    const last = this.entries[this.entries.length - 1];
    if (last && record.step <= last.step) throw new Error("recorded steps must increase");
    this.chunks.push(record.bytes);
    this.entries.push({
      index: record.index,
      step: record.step,
      modelYears: record.modelYears,
      byteOffset: record.index * this.bytesPerSnapshot,
      probes: record.probes,
      stateHash: record.stateHash,
    });
    this.clamped += record.clampedValues;
    this.cachedManifest = undefined;
    this.advanceTo(record.step, record.modelYears);
  }

  /** Moves the live position forward (between recorded snapshots too). */
  advanceTo(step: number, modelYears: number): void {
    if (step < this.stepValue) throw new Error("a run never moves backwards");
    this.stepValue = step;
    this.modelYearsValue = modelYears;
  }
  complete(): void {
    if (this.statusValue === "active") this.statusValue = "complete";
  }
  halt(failure: RunFailure): void {
    this.statusValue = "halted";
    this.failureValue = failure;
  }

  probes(index: number): GlacierProbes {
    return this.entry(index).probes;
  }
  stateHash(index: number): string {
    return this.entry(index).stateHash;
  }
  recordedStep(index: number): number {
    return this.entry(index).step;
  }
  recordedModelYears(index: number): number {
    return this.entry(index).modelYears;
  }
  private entry(index: number) {
    const entry = this.entries[index];
    if (!entry)
      throw new RangeError(`snapshot ${index} outside [0, ${this.entries.length - 1}] of run ${this.id}`);
    return entry;
  }

  /** The frozen capture manifest of what is recorded so far (`binFile` is empty: the payload is in memory). */
  get manifest(): CapturedRunManifest {
    if (!this.cachedManifest) {
      const last = this.entries[this.entries.length - 1];
      this.cachedManifest = {
        format: CAPTURE_FORMAT,
        version: CAPTURE_VERSION,
        rockId: this.rockId,
        config: this.config,
        start: this.identity.start,
        grid: { nx: this.config.nx, ny: this.config.ny, metresPerCell: this.config.metresPerCell },
        layers: this.identity.layers,
        snapshotIntervalYears: this.identity.snapshotIntervalYears,
        bytesPerSnapshot: this.bytesPerSnapshot,
        binFile: "",
        finalStateHash: last?.stateHash ?? "",
        snapshots: this.entries.map(({ stateHash: _hash, ...entry }) => entry),
      };
    }
    return this.cachedManifest;
  }

  /** The recorded payload back to back, as a capture `.bin` (for export or `decodeCapturedRun`). */
  payload(): Uint8Array {
    const out = new Uint8Array(this.recordedBytes);
    this.chunks.forEach((chunk, k) => out.set(chunk, k * this.bytesPerSnapshot));
    return out;
  }

  /** Decodes one recorded snapshot through the frozen capture decoder. */
  snapshot(index: number): GlacierSnapshot {
    const entry = this.entry(index);
    const one: CapturedRunManifest = {
      ...this.manifest,
      snapshots: [{ ...this.manifest.snapshots[index]!, index: 0, byteOffset: 0 }],
    };
    const decoded = decodeCapturedRun(one, this.chunks[index]!).snapshot(0);
    if (decoded.step !== entry.step) throw new Error("decoded snapshot step mismatch");
    return decoded;
  }

  /** Index of the recorded snapshot nearest in model time (ties go to the earlier one); -1 when empty. */
  nearestIndex(modelYears: number): number {
    if (this.entries.length === 0) return -1;
    let best = 0;
    for (let k = 1; k < this.entries.length; k++)
      if (
        Math.abs(this.entries[k]!.modelYears - modelYears) <
        Math.abs(this.entries[best]!.modelYears - modelYears)
      )
        best = k;
    return best;
  }
}
