import { describe, expect, it } from "vitest";
import { validateCpuSolverConfig, pipeWaveCourant, createCpuSolver } from "@hachure/terrain";
import {
  SolverTransport,
  backendConfig,
  createFlatTerrainSample,
  createFlatTerrainTransport,
  forcedBackend,
  selectTerrainBackend,
  TERRAIN_BACKENDS,
  type BackendSelectionOptions,
} from "./index";
import type { HostCommand, HostReply, HostTransport } from "../protocol";
function transport(fail = false) {
  const calls: HostCommand[] = [],
    state = { disposed: false };
  return {
    calls,
    state,
    request: async (command: HostCommand): Promise<HostReply> => {
      calls.push(command);
      if (fail) throw new Error("fixture unavailable");
      return { processingMs: 0, sample: await createFlatTerrainSample() };
    },
    dispose() {
      state.disposed = true;
    },
  } satisfies HostTransport & { calls: HostCommand[]; state: { disposed: boolean } };
}
function options(): BackendSelectionOptions {
  return {
    canRenderWebGL2: () => true,
    createWorkerTransport: () => transport(),
    createGpuTransport: () => transport(),
    createCpu64Transport: () => transport(),
  };
}
describe("backend selection", () => {
  it("keeps all tiers on the same domain with admissible pipe/resistance scaling", () => {
    for (const tier of TERRAIN_BACKENDS) {
      const config = backendConfig(tier);
      expect(config.gridSize * config.metresPerCell).toBe(1280);
      expect(config.pipeAreaM2).toBe(0.2 * config.metresPerCell ** 2);
      expect(validateCpuSolverConfig(config)).toEqual([]);
      expect(pipeWaveCourant(config)).toBeLessThan(0.5);
    }
  });
  it("parses explicit tier flags without silently accepting misspellings", () => {
    expect(forcedBackend("?backend=auto")).toBeUndefined();
    for (const tier of TERRAIN_BACKENDS) expect(forcedBackend(`?backend=${tier}`)).toBe(tier);
    expect(() => forcedBackend("?backend=magic")).toThrow(/Unknown/);
  });
  for (const tier of TERRAIN_BACKENDS)
    it(`forces ${tier}`, async () => {
      const result = await selectTerrainBackend({ ...options(), search: `?backend=${tier}` });
      expect(result.backend).toBe(tier);
      expect(result.initialSample.snapshot.step).toBe(0);
      if (tier === "flat") expect(result.transport).toBeNull();
      result.transport?.dispose();
    });
  it("degrades GPU failure to Worker128 and disposes rejected GPU resources", async () => {
    const bad = transport(true),
      worker = transport();
    const selected = await selectTerrainBackend({
      ...options(),
      createGpuTransport: () => bad,
      createWorkerTransport: () => worker,
    });
    expect(selected.backend).toBe("cpu-worker");
    expect(selected.config.gridSize).toBe(128);
    expect(bad.state.disposed).toBe(true);
    expect(selected.failures).toHaveLength(1);
    await selected.transport!.request({ kind: "init", config: selected.config });
    expect(worker.calls.filter((c) => c.kind === "init")).toHaveLength(2);
    selected.transport?.dispose();
  });
  it("degrades Worker failure to CPU64, then flat on CPU64 failure", async () => {
    const failed = () => transport(true);
    const low = await selectTerrainBackend({
      ...options(),
      createGpuTransport: failed,
      createWorkerTransport: failed,
    });
    expect(low.backend).toBe("cpu-64");
    low.transport?.dispose();
    const flat = await selectTerrainBackend({
      ...options(),
      createGpuTransport: failed,
      createWorkerTransport: failed,
      createCpu64Transport: failed,
    });
    expect(flat.backend).toBe("flat");
    expect(flat.failures).toHaveLength(3);
    expect(flat.initialSample.snapshot.layers.bedrockM!.some((v) => v !== 0)).toBe(true);
  });
  it("goes flat when WebGL2 rendering is unavailable", async () => {
    const selected = await selectTerrainBackend({
      ...options(),
      createGpuTransport: () => transport(true),
      canRenderWebGL2: () => false,
    });
    expect(selected.backend).toBe("flat");
  });
  it("rejects slower measured tiers before mounting, without changing dt", async () => {
    const selected = await selectTerrainBackend({
      ...options(),
      admit: (tier, _transport, config) => {
        expect(config.dtSimSeconds).toBe(0.05);
        return tier === "cpu-64";
      },
    });
    expect(selected.backend).toBe("cpu-64");
    expect(selected.failures).toHaveLength(2);
    selected.transport?.dispose();
  });
  it("a failed forced tier falls flat and reports its failure", async () => {
    const selected = await selectTerrainBackend({
      ...options(),
      search: "?backend=webgpu",
      createGpuTransport: () => transport(true),
    });
    expect(selected.backend).toBe("flat");
    expect(selected.failures[0].backend).toBe("webgpu");
  });
});

it("does not reuse initial samples with different calibration or parameter input", async () => {
  const worker = transport();
  const calibration = { status: "failed", recordId: "test-science-status" } as const;
  const selected = await selectTerrainBackend({
    ...options(),
    search: "?backend=cpu-worker",
    calibration,
    createWorkerTransport: () => worker,
  });
  const same = await selected.transport!.request({ kind: "init", config: selected.config, calibration });
  expect(worker.calls).toHaveLength(1);
  expect(same.sample!.snapshot.step).toBe(0);
  await selected.transport!.request({
    kind: "init",
    config: { ...selected.config, rainMmPerHr: 20 },
    calibration: { status: "pending" },
  });
  expect(worker.calls).toHaveLength(2);
  const command = worker.calls[1];
  expect(command.kind).toBe("init");
  if (command.kind === "init") {
    expect(command.config.rainMmPerHr).toBe(20);
    expect(command.calibration?.status).toBe("pending");
  }
  selected.transport!.dispose();
});
it("resets after admission callbacks that mutate state", async () => {
  const selected = await selectTerrainBackend({
    ...options(),
    search: "?backend=cpu-64",
    createCpu64Transport: () => new SolverTransport(createCpuSolver),
    admit: async (_tier, transport) => {
      await transport.request({ kind: "advance", steps: 5, sample: true });
      return true;
    },
  });
  expect(selected.initialSample.snapshot.step).toBe(0);
  expect(selected.initialSample.snapshot.budget.erodedM3).toBe(0);
  const reply = await selected.transport!.request({ kind: "sample" });
  expect(reply.sample!.snapshot.step).toBe(0);
  selected.transport!.dispose();
});

it("keeps a genuine flat preset sample read-only through the host interface", async () => {
  const sample = await createFlatTerrainSample(),
    transport = createFlatTerrainTransport(sample);
  const first = await transport.request({ kind: "init", config: sample.config });
  expect(first.sample!.snapshot).toEqual(sample.snapshot);
  first.sample!.snapshot.layers.bedrockM!.fill(-999);
  const reset = await transport.request({ kind: "reset" });
  expect(reset.sample!.snapshot).toEqual(sample.snapshot);
  await expect(transport.request({ kind: "advance", steps: 1, sample: true })).rejects.toThrow(/read-only/);
  await expect(transport.request({ kind: "configure", patch: { rainMmPerHr: 20 } })).rejects.toThrow(
    /read-only/,
  );
  await expect(
    transport.request({ kind: "tool", op: { kind: "remove-source", id: "none" } }),
  ).rejects.toThrow(/read-only/);
  transport.dispose();
  transport.dispose();
  await expect(transport.request({ kind: "sample" })).rejects.toThrow(/disposed/);
});
