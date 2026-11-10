/**
 * Captured-run fixtures: format round trip, reproducibility from the model, and the registered claim
 * evaluated on the recorded runs themselves.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  type CapturedRunManifest,
  DEFAULT_GLACIER_CONFIG,
  GLACIER_LAYERS,
  decodeCapturedRun,
  encodeCapturedRun,
  measureSection,
} from "../contract/index";
import { createCpuGlacier } from "../cpu/index";
import {
  CAPTURED_ROCKS,
  CAPTURE_SEED,
  PROTOCOL_CRITERIA,
  PROTOCOL_HORIZON_YEARS,
  PROTOCOL_SECTIONS,
  PROTOCOL_SNAPSHOT_YEARS,
  loadCapturedRun,
} from "./index";

const dir = new URL("./captured-runs/", import.meta.url);
const read = (rock: string) => {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL(`${rock}.json`, dir)), "utf8"),
  ) as CapturedRunManifest;
  const bytes = readFileSync(fileURLToPath(new URL(manifest.binFile, dir)));
  return decodeCapturedRun(manifest, new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
};

describe("capture codec", () => {
  it("round-trips a snapshot within the declared quantization error", () => {
    const g = createCpuGlacier({ nx: 24, ny: 16, metresPerCell: 160, dtYears: 0.05 });
    g.advanceYears(30);
    const snapshot = g.snapshot();
    const { manifest, bytes, clampedValues } = encodeCapturedRun({
      config: g.config,
      start: { preset: "test", options: {} },
      snapshots: [{ snapshot, probes: g.probes() }],
      snapshotIntervalYears: 30,
      binFile: "t.bin",
      finalStateHash: g.hash(),
    });
    expect(clampedValues).toBe(0);
    const run = decodeCapturedRun(manifest, bytes);
    const back = run.snapshot(0);
    GLACIER_LAYERS.forEach((layer, li) => {
      const tol = manifest.layers[li]!.scale / 2 + 1e-3;
      for (let k = 0; k < back[layer].length; k++)
        expect(Math.abs(back[layer][k]! - snapshot[layer][k]!)).toBeLessThanOrEqual(tol);
    });
    expect(() => decodeCapturedRun(manifest, bytes.subarray(1))).toThrow(/bytes/);
    expect(() => decodeCapturedRun({ ...manifest, version: 2 as 1 }, bytes)).toThrow(/version/);
  });
});

describe.each(CAPTURED_ROCKS)("captured run: %s", (rock) => {
  const run = read(rock);

  it("is the registered reference run for that rock", () => {
    const m = run.manifest;
    expect(m.rockId).toBe(rock);
    expect({ ...m.config, rockId: DEFAULT_GLACIER_CONFIG.rockId, seed: DEFAULT_GLACIER_CONFIG.seed }).toEqual(
      DEFAULT_GLACIER_CONFIG,
    );
    expect(m.config.seed).toBe(CAPTURE_SEED);
    expect(m.snapshotIntervalYears).toBe(PROTOCOL_SNAPSHOT_YEARS);
    expect(run.count).toBe(PROTOCOL_HORIZON_YEARS / PROTOCOL_SNAPSHOT_YEARS + 1);
    expect(run.times[run.count - 1]).toBeCloseTo(PROTOCOL_HORIZON_YEARS, 6);
    expect(run.nearestIndex(41)).toBe(2);
    expect(run.nearestIndex(50)).toBe(2);
  });

  it("starts from the shared authored V with no ice", () => {
    const s0 = run.snapshot(0);
    expect(Math.max(...s0.iceThicknessM)).toBe(0);
    const fresh = createCpuGlacier({ rockId: rock, seed: CAPTURE_SEED }).snapshot();
    for (let k = 0; k < s0.bedM.length; k += 97)
      expect(Math.abs(s0.bedM[k]! - fresh.bedM[k]!)).toBeLessThanOrEqual(0.026);
  });

  it("is reproducible: a fresh run matches the first recorded interval", () => {
    const g = createCpuGlacier({ rockId: rock, seed: CAPTURE_SEED });
    g.advanceYears(PROTOCOL_SNAPSHOT_YEARS);
    const live = g.snapshot();
    const recorded = run.snapshot(1);
    for (let k = 0; k < live.bedM.length; k++) {
      expect(Math.abs(live.bedM[k]! - recorded.bedM[k]!)).toBeLessThanOrEqual(0.026);
      expect(Math.abs(live.iceThicknessM[k]! - recorded.iceThicknessM[k]!)).toBeLessThanOrEqual(0.006);
    }
    expect(g.probes().iceVolumeM3).toBeCloseTo(run.manifest.snapshots[1]!.probes.iceVolumeM3, 0);
  }, 60_000);

  it("forms a trough under the ice and leaves the V below the snout", () => {
    const grid = run.manifest.grid;
    const first = run.snapshot(0);
    const last = run.snapshot(run.count - 1);
    const u0 = measureSection(first.bedM, first.iceThicknessM, grid, PROTOCOL_SECTIONS.underIce);
    const u1 = measureSection(last.bedM, last.iceThicknessM, grid, PROTOCOL_SECTIONS.underIce);
    // The direction of change every rock shows by the horizon (the registered T1 magnitudes are met only
    // by shale; see docs/science/glacial/feasibility.md): wider floor, lower floor, steeper walls.
    expect(u1.floorWidthM - u0.floorWidthM).toBeGreaterThan(10);
    expect(u0.floorElevationM - u1.floorElevationM).toBeGreaterThan(10);
    expect(u1.maxWallSlopeDeg - u0.maxWallSlopeDeg).toBeGreaterThanOrEqual(
      PROTOCOL_CRITERIA.troughMinWallSteepeningDeg,
    );
    const b0 = measureSection(first.bedM, undefined, grid, PROTOCOL_SECTIONS.belowSnout);
    const b1 = measureSection(last.bedM, undefined, grid, PROTOCOL_SECTIONS.belowSnout);
    expect(Math.abs(b1.floorWidthM - b0.floorWidthM)).toBeLessThan(1);
    expect(Math.abs(b1.floorElevationM - b0.floorElevationM)).toBeLessThan(0.1);
  });
});

describe("rock comparison on the captured runs", () => {
  it("at the horizon: shale eroded most and cut deepest, granite least; granite walls steeper than shale", () => {
    const at = CAPTURED_ROCKS.map((rock) => {
      const run = read(rock);
      const last = run.snapshot(run.count - 1);
      return {
        section: measureSection(last.bedM, last.iceThicknessM, run.manifest.grid, PROTOCOL_SECTIONS.underIce),
        eroded: run.manifest.snapshots[run.count - 1]!.probes.erodedVolumeM3,
      };
    });
    const [shale, sandstone, granite] = at as [(typeof at)[0], (typeof at)[0], (typeof at)[0]];
    expect(granite.section.maxWallSlopeDeg).toBeGreaterThan(shale.section.maxWallSlopeDeg + 3);
    expect(shale.section.floorElevationM).toBeLessThan(sandstone.section.floorElevationM);
    expect(sandstone.section.floorElevationM).toBeLessThan(granite.section.floorElevationM);
    expect(shale.eroded).toBeGreaterThan(sandstone.eroded);
    expect(sandstone.eroded).toBeGreaterThan(granite.eroded);
  });

  it("loadCapturedRun resolves the payload next to the manifest", async () => {
    const files: Record<string, Uint8Array> = {};
    const fetchImpl = async (url: string) => {
      const name = url.split("/").pop()!;
      const path = fileURLToPath(new URL(name, dir));
      const buf = readFileSync(path);
      files[name] = buf;
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(buf.toString("utf8")) as unknown,
        arrayBuffer: async () =>
          buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      };
    };
    const run = await loadCapturedRun("/assets/captures/granite.json", fetchImpl);
    expect(Object.keys(files)).toEqual(["granite.json", "granite.bin"]);
    expect(run.manifest.rockId).toBe("granite");
  });
});
