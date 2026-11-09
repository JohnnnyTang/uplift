import { describe, expect, it } from "vitest";
import { createTerrainState, zeroBudget, hashSnapshot } from "../contract/index";
import type { StateSnapshot, TerrainState } from "../contract/index";
import {
  aggregateBudget,
  budgetResidual,
  detectKnickpoints,
  extractChannel,
  halfDepthWidth,
  knickpointPersistence,
  probe,
  sampleChannelProfile,
  sampleProfile,
} from "./index";

function fixture(n = 32, l = 10) {
  const state = createTerrainState(n, l, { x: Math.floor(n / 2), y: n - 1 });
  return { state, snapshot: (): StateSnapshot => ({ ...state, step: 0, simYears: 0, budget: zeroBudget() }) };
}
function ground(state: TerrainState, fn: (x: number, y: number) => number) {
  for (let y = 0; y < state.gridSize; y++)
    for (let x = 0; x < state.gridSize; x++)
      state.layers.bedrockM[y * state.gridSize + x] = fn(
        (x + 0.5) * state.metresPerCell,
        (y + 0.5) * state.metresPerCell,
      );
}
function stepped(drop = 2, at = 15) {
  const distanceM = Float64Array.from({ length: 32 }, (_, i) => i * 10);
  const groundM = Float64Array.from(distanceM, (d, i) => 100 - 0.01 * d - (i >= at ? drop : 0));
  return {
    kind: "long-profile" as const,
    distanceM,
    groundM,
    bedrockM: groundM.slice(),
    waterM: new Float64Array(32),
  };
}

describe("profile and point probes", () => {
  it("interpolates a cell-centred plane exactly along a bent polyline", () => {
    const { state, snapshot } = fixture();
    ground(state, (x, y) => 100 + 0.2 * x - 0.1 * y);
    const result = probe(snapshot(), {
      kind: "long-profile",
      path: [
        { xM: 15, yM: 15 },
        { xM: 55, yM: 15 },
        { xM: 55, yM: 55 },
      ],
      samples: 9,
    });
    expect([...result.distanceM]).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80]);
    expect([...result.groundM]).toEqual([101.5, 103.5, 105.5, 107.5, 109.5, 108.5, 107.5, 106.5, 105.5]);
  });
  it("supports section requests, duplicate vertices and clamped outer half-cells", () => {
    const { state, snapshot } = fixture();
    ground(state, (_, y) => 100 - 0.1 * y);
    const p = sampleProfile(snapshot(), {
      kind: "cross-section",
      from: { xM: 0, yM: 0 },
      to: { xM: 10, yM: 0 },
      samples: 2,
    });
    expect([...p.groundM]).toEqual([99.5, 99.5]);
    expect(
      sampleProfile(snapshot(), {
        kind: "long-profile",
        path: [
          { xM: 5, yM: 5 },
          { xM: 5, yM: 5 },
          { xM: 15, yM: 5 },
        ],
        samples: 2,
      }).distanceM[1],
    ).toBe(10);
  });
  it("returns prescribed outgoing water throughput and instantaneous solid-volume flux", () => {
    const { state, snapshot } = fixture();
    state.layers.waterM.fill(2);
    state.layers.suspendedSedimentM.fill(0.5);
    state.layers.velocityXMPerS.fill(3);
    state.layers.velocityYMPerS.fill(4);
    state.layers.fluxSouthM3PerS.fill(8);
    expect(probe(snapshot(), { kind: "point-flux", at: { xM: 15, yM: 15 } })).toEqual({
      kind: "point-flux",
      waterDepthM: 2,
      speedMPerS: 5,
      waterDischargeM3PerS: 8,
      sedimentFluxM3PerS: 2,
    });
    state.layers.waterM.fill(0);
    expect(probe(snapshot(), { kind: "point-flux", at: { xM: 15, yM: 15 } }).sedimentFluxM3PerS).toBe(0);
  });
  it("rejects missing layers and invalid requests instead of returning plausible zeroes", () => {
    const { snapshot } = fixture();
    expect(() => aggregateBudget({ ...snapshot(), layers: {} })).toThrow(/suspended/);
    expect(() => probe(snapshot(), { kind: "point-flux", at: { xM: NaN, yM: 0 } })).toThrow();
    expect(() =>
      sampleProfile(snapshot(), {
        kind: "long-profile",
        path: [
          { xM: 5, yM: 5 },
          { xM: 5, yM: 5 },
        ],
        samples: 2,
      }),
    ).toThrow();
    expect(() =>
      sampleProfile(snapshot(), {
        kind: "cross-section",
        from: { xM: 0, yM: 0 },
        to: { xM: 320, yM: 0 },
        samples: 2,
      }),
    ).toThrow();
  });
});

describe("channel routing", () => {
  it("traces a plane from the spring to the declared outlet without mutating the snapshot", () => {
    const { state, snapshot } = fixture();
    ground(state, (_, y) => 100 - 0.1 * y);
    const before = hashSnapshot(snapshot());
    const channel = extractChannel(snapshot(), { source: { xM: 165, yM: 15 } });
    expect(channel.complete).toBe(true);
    expect(channel.path).toHaveLength(31);
    expect(channel.method).toBe("steepest-descent");
    const profile = sampleChannelProfile(snapshot(), channel);
    expect(profile.groundM[0]).toBe(98.5);
    expect(profile.groundM.at(-1)).toBe(68.5);
    expect(detectKnickpoints(profile, 10).candidates).toEqual([]);
    expect(hashSnapshot(snapshot())).toBe(before);
  });
  it("compares diagonal slopes by distance and uses row-major ties", () => {
    const { state, snapshot } = fixture(8, 1);
    state.layers.bedrockM.fill(20);
    state.layers.bedrockM[3 * 8 + 3] = 10;
    state.layers.bedrockM[4 * 8 + 3] = 8;
    state.layers.bedrockM[4 * 8 + 4] = 7.5;
    expect(extractChannel(snapshot(), { source: { xM: 3.5, yM: 3.5 } }).path[1]).toEqual({
      xM: 3.5,
      yM: 4.5,
    });
    state.layers.bedrockM[3 * 8 + 2] = 8;
    expect(extractChannel(snapshot(), { source: { xM: 3.5, yM: 3.5 } }).path[1]).toEqual({
      xM: 2.5,
      yM: 3.5,
    });
  });
  it("labels incomplete pits, boundaries and the explicit flat-routing accumulation fallback", () => {
    const { state, snapshot } = fixture(8, 1);
    state.layers.bedrockM.fill(10);
    const primary = extractChannel(snapshot(), { source: { xM: 3.5, yM: 3.5 } });
    expect(primary.stoppedAt).toBe("pit");
    expect(primary.complete).toBe(false);
    const fallback = extractChannel(snapshot(), {
      source: { xM: 3.5, yM: 3.5 },
      fallback: "d8-accumulation",
    });
    expect(fallback.method).toBe("d8-accumulation");
    expect(fallback.stoppedAt).toBe("boundary");
    expect(fallback.complete).toBe(false);
    expect(fallback.accumulation![0]).toBeGreaterThan(1);
    state.layers.bedrockM[3 * 8 + 3] = 0;
    expect(
      extractChannel(snapshot(), { source: { xM: 3.5, yM: 3.5 }, fallback: "d8-accumulation" }).stoppedAt,
    ).toBe("pit");
  });
  it("samples diagonal paths at one-cell arc spacing and drops the terminal remainder", () => {
    const { state, snapshot } = fixture(8, 1);
    ground(state, (_, y) => 100 - y);
    const p = sampleChannelProfile(snapshot(), {
      path: [
        { xM: 1.5, yM: 1.5 },
        { xM: 3.5, yM: 3.5 },
      ],
      complete: false,
      stoppedAt: "pit",
      method: "steepest-descent",
    });
    expect([...p.distanceM]).toEqual([0, 1, 2]);
    expect(p.groundM[2]).toBeCloseTo(98.5 - Math.SQRT2);
  });
});

describe("half-depth sections", () => {
  it("resolves the 10 m deep V with interpolated half-depth width 20 m", () => {
    const { state, snapshot } = fixture(81, 1);
    ground(state, (x) => Math.min(20, 10 + 0.5 * Math.abs(x - 40.5)));
    expect(halfDepthWidth(snapshot(), { row: 12 })).toMatchObject({
      resolved: true,
      widthM: 20,
      depthM: 10,
      minimumXM: 40.5,
    });
  });
  it("reports flat/shallow and missing crossing sections unresolved", () => {
    const { state, snapshot } = fixture(81, 1);
    expect(halfDepthWidth(snapshot(), { row: 12 })).toEqual({ resolved: false, reason: "shallow" });
    ground(state, (x) => Math.min(0.4, 0.01 * Math.abs(x - 40.5)));
    expect(halfDepthWidth(snapshot(), { row: 12 }).resolved).toBe(false);
    ground(state, (x) => (x < 40.5 ? 20 : 10));
    expect(halfDepthWidth(snapshot(), { row: 12 }).resolved).toBe(false);
  });
});

describe("knickpoint proxy and persistence", () => {
  it("groups adjacent candidates, selecting largest ratio and upstream tie", () => {
    const result = detectKnickpoints(stepped(), 10);
    expect(result.resolved).toBe(true);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.index).toBe(14);
    expect(result.candidates[0]!.slopeRatio).toBeCloseTo(11);
    expect(detectKnickpoints(stepped(0), 10).candidates).toEqual([]);
    expect(detectKnickpoints(stepped(2, 31), 10).candidates).toEqual([]);
    const flat = stepped(0);
    flat.groundM.fill(10);
    expect(detectKnickpoints(flat, 10).resolved).toBe(false);
  });
  it("rejects uneven sample spacing", () => {
    const p = stepped();
    p.distanceM[5] += 1;
    expect(() => detectKnickpoints(p, 10)).toThrow(/spacing/);
  });
  it("requires calibrated, continuous observations and 100 years within the initial reach", () => {
    const candidates = detectKnickpoints(stepped(), 10).candidates;
    const observations = Array.from({ length: 11 }, (_, i) => ({
      step: i * 200,
      completePath: true,
      candidates,
    }));
    const request = {
      observations,
      calibrated: true,
      simYearsPerStep: 0.05,
      observationIntervalSteps: 200,
      metresPerCell: 10,
    };
    expect(knickpointPersistence({ ...request, observations: observations.slice(0, 10) }).passed).toBe(false);
    expect(knickpointPersistence(request)).toMatchObject({ passed: true, elapsedYears: 100 });
    expect(knickpointPersistence({ ...request, calibrated: false }).passed).toBe(false);
    expect(knickpointPersistence({ ...request, simYearsPerStep: 0.1 }).passed).toBe(false);
    expect(
      knickpointPersistence({ ...request, observations: observations.filter((_, i) => i !== 5) })
        .elapsedYears,
    ).toBe(40);
    const missing = observations.map((o, i) => (i === 5 ? { ...o, candidates: [] } : o));
    expect(knickpointPersistence({ ...request, observations: missing }).elapsedYears).toBe(40);
    const incomplete = observations.map((o, i) => ({ ...o, completePath: i !== 5 }));
    expect(knickpointPersistence({ ...request, observations: incomplete }).elapsedYears).toBe(40);
    const moved = observations.map((o, i) => ({
      ...o,
      candidates: candidates.map((c) => ({ ...c, distanceM: c.distanceM + (i >= 5 ? 21 : 0) })),
    }));
    expect(knickpointPersistence({ ...request, observations: moved }).elapsedYears).toBe(50);
  });
});

describe("budget aggregation and residuals", () => {
  it("tracks exchanges separately from stocks with initial suspension and exports", () => {
    const { state, snapshot } = fixture(8, 1);
    state.layers.bedrockM.fill(100);
    state.layers.suspendedSedimentM[0] = 2;
    state.layers.waterM[0] = 8;
    const initial = structuredClone(snapshot());
    state.layers.bedrockM[0] = 96;
    state.layers.suspendedSedimentM[0] = 3;
    state.layers.sedimentM[0] = 1;
    state.layers.waterM[0] = 6;
    const current = {
      ...snapshot(),
      budget: {
        ...zeroBudget(),
        erodedM3: 4,
        depositedM3: 1,
        exportedSedimentM3: 2,
        outflowedWaterM3: 2,
        suspendedM3: 999,
      },
    };
    expect(probe(current, { kind: "budget" })).toMatchObject({
      suspendedM3: 3,
      erodedM3: 4,
      depositedM3: 1,
      exportedSedimentM3: 2,
    });
    expect(budgetResidual(current, initial)).toMatchObject({
      solidResidualM3: 0,
      waterResidualM3: 0,
      solidReferenceM3: 4,
      waterReferenceM3: 8,
      solidPassed: true,
      waterPassed: true,
    });
    expect(
      budgetResidual({ ...current, budget: { ...current.budget, exportedSedimentM3: 3 } }, initial)
        .solidPassed,
    ).toBe(false);
  });
  it("uses absolute bounds for zero throughput, tool ledger and differences from a nonzero baseline", () => {
    const { state, snapshot } = fixture(8, 1);
    const initial = structuredClone(snapshot());
    expect(budgetResidual(snapshot(), initial)).toMatchObject({
      solidRelativeResidual: null,
      waterRelativeResidual: null,
      solidPassed: true,
      waterPassed: true,
    });
    state.layers.bedrockM[0] = 2;
    const current = { ...snapshot(), budget: { ...zeroBudget(), toolNetM3: 2 } };
    expect(budgetResidual(current, initial).solidPassed).toBe(true);
    expect(budgetResidual(current, structuredClone(current)).solidResidualM3).toBe(0);
  });
});
