import { describe, expect, it } from "vitest";
import {
  DEFAULT_TERRAIN_CONFIG,
  SECONDS_PER_YEAR,
  TERRAIN_CONFIG_LIMITS,
  TERRAIN_LAYERS,
  TerrainConfigError,
  cellAt,
  cellIndex,
  cellX,
  cellY,
  cloneTerrainState,
  createTerrainState,
  hashSnapshot,
  isEdgeCell,
  layerVolumeM3,
  resolveTerrainConfig,
  simYearsPerStep,
  terrainWidthM,
  validateTerrainConfig,
} from "./index";

describe("TerrainConfig", () => {
  it("defaults are valid", () => {
    expect(validateTerrainConfig(DEFAULT_TERRAIN_CONFIG)).toEqual([]);
  });

  it("every numeric field has a limit", () => {
    const numeric = Object.keys(DEFAULT_TERRAIN_CONFIG).filter((k) => k !== "hardnessRange");
    expect(Object.keys(TERRAIN_CONFIG_LIMITS).sort()).toEqual(numeric.sort());
  });

  it("resolve fills defaults and freezes", () => {
    const config = resolveTerrainConfig({ gridSize: 64 });
    expect(config.gridSize).toBe(64);
    expect(config.rainMmPerHr).toBe(DEFAULT_TERRAIN_CONFIG.rainMmPerHr);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.hardnessRange)).toBe(true);
  });

  it("rejects out-of-range, non-finite and non-integer values", () => {
    expect(() => resolveTerrainConfig({ rainMmPerHr: -1 })).toThrow(TerrainConfigError);
    expect(() => resolveTerrainConfig({ dtSimSeconds: Number.NaN })).toThrow(TerrainConfigError);
    expect(() => resolveTerrainConfig({ gridSize: 100.5 })).toThrow(/integer/);
    expect(() => resolveTerrainConfig({ hardnessRange: [0.8, 0.2] })).toThrow(/hardnessRange/);
  });

  it("derives simulated years per step from the time step and the acceleration factor", () => {
    expect(simYearsPerStep({ dtSimSeconds: SECONDS_PER_YEAR, morphAccelerationFactor: 1 })).toBe(1);
    expect(simYearsPerStep({ dtSimSeconds: 1, morphAccelerationFactor: SECONDS_PER_YEAR * 1000 })).toBe(1000);
  });

  it("terrain width is cells × metres per cell", () => {
    expect(terrainWidthM({ gridSize: 128, metresPerCell: 10 })).toBe(1280);
  });
});

describe("TerrainState", () => {
  it("allocates one view per layer into one buffer", () => {
    const state = createTerrainState(8, 5, { x: 4, y: 7 });
    expect(Object.keys(state.layers)).toEqual([...TERRAIN_LAYERS]);
    for (const name of TERRAIN_LAYERS) {
      expect(state.layers[name].length).toBe(64);
      expect(state.layers[name].buffer).toBe(state.buffer);
    }
    expect(state.buffer.byteLength).toBe(64 * TERRAIN_LAYERS.length * 4);
  });

  it("layers do not overlap", () => {
    const state = createTerrainState(4, 1, { x: 0, y: 0 });
    state.layers.bedrockM.fill(1);
    expect(state.layers.sedimentM.every((v) => v === 0)).toBe(true);
  });

  it("requires the outlet on the grid edge", () => {
    expect(() => createTerrainState(8, 1, { x: 3, y: 3 })).toThrow(/edge/);
    expect(isEdgeCell(8, { x: 0, y: 3 })).toBe(true);
    expect(isEdgeCell(8, { x: 8, y: 3 })).toBe(false);
  });

  it("indexes row-major", () => {
    expect(cellIndex(8, 3, 2)).toBe(19);
    expect(cellX(8, 19)).toBe(3);
    expect(cellY(8, 19)).toBe(2);
  });

  it("maps metres to cells", () => {
    expect(cellAt(8, 10, { xM: 35, yM: 0 })).toEqual({ x: 3, y: 0 });
    expect(cellAt(8, 10, { xM: 80, yM: 0 })).toBeUndefined();
    expect(cellAt(8, 10, { xM: -0.1, yM: 0 })).toBeUndefined();
  });

  it("clones into a new buffer", () => {
    const a = createTerrainState(4, 2, { x: 0, y: 1 });
    a.layers.waterM[3] = 2;
    const b = cloneTerrainState(a);
    expect(b.buffer).not.toBe(a.buffer);
    expect(b.layers.waterM[3]).toBe(2);
    expect(layerVolumeM3(b, "waterM")).toBe(8);
  });
});

describe("hashSnapshot", () => {
  const state = createTerrainState(8, 1, { x: 0, y: 0 });
  const snap = (step = 0) => ({ step, gridSize: 8, layers: state.layers });

  it("is 16 hex characters and stable", () => {
    expect(hashSnapshot(snap())).toMatch(/^[0-9a-f]{16}$/);
    expect(hashSnapshot(snap())).toBe(hashSnapshot(snap()));
  });

  it("changes with any bit of any layer, and with the step count", () => {
    const h0 = hashSnapshot(snap());
    expect(hashSnapshot(snap(1))).not.toBe(h0);
    const last = state.layers.suspendedSedimentM;
    last[last.length - 1] = 1e-30;
    expect(hashSnapshot(snap())).not.toBe(h0);
    last[last.length - 1] = 0;
    expect(hashSnapshot(snap())).toBe(h0);
  });

  it("refuses a partial snapshot", () => {
    expect(() => hashSnapshot({ step: 0, gridSize: 8, layers: { bedrockM: state.layers.bedrockM } })).toThrow(
      /missing/,
    );
  });
});
