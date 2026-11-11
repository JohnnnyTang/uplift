/**
 * Capability failures and backend selection, in Node with stubbed WebGPU entry points (session 5I).
 * These test the labelled fallback logic only; real-device behaviour is in test/browser/quick.browser.ts.
 */
import { describe, expect, it, vi } from "vitest";
import { createCpuGlacier } from "../cpu/index";
import { asyncCpuGlacier } from "./async";
import { GlacierGpuError } from "./errors";
import { GLACIER_GPU_PARITY } from "./parity";
import { restartOnCpu, selectGlacierBackend } from "./select";
import { createGpuGlacier } from "./solver";

const small = { nx: 24, ny: 16, metresPerCell: 160, dtYears: 0.05 } as const;
const passed = { ...GLACIER_GPU_PARITY, status: "passed" as const, autoSelectsGpu: true };
const gpuWith = (requestAdapter: () => Promise<unknown>) => ({ requestAdapter }) as unknown as GPU;
const adapterWith = (requestDevice: () => Promise<unknown>, maxStorageBuffersPerShaderStage = 8) => ({
  limits: { maxStorageBuffersPerShaderStage },
  info: {},
  requestDevice,
});

describe("GPU creation rejects with a labelled reason before any work", () => {
  it("no WebGPU", async () => {
    await expect(createGpuGlacier(small, {}, { gpu: undefined })).rejects.toMatchObject({
      reason: "webgpu-unavailable",
    });
  });
  it("adapter request returns null or throws", async () => {
    await expect(createGpuGlacier(small, {}, { gpu: gpuWith(async () => null) })).rejects.toMatchObject({
      reason: "adapter-unavailable",
    });
    await expect(
      createGpuGlacier(
        small,
        {},
        {
          gpu: gpuWith(async () => {
            throw new Error("blocked");
          }),
        },
      ),
    ).rejects.toMatchObject({ reason: "adapter-unavailable" });
  });
  it("too few storage buffers per stage", async () => {
    const requestDevice = vi.fn();
    await expect(
      createGpuGlacier(small, {}, { gpu: gpuWith(async () => adapterWith(requestDevice, 4)) }),
    ).rejects.toMatchObject({ reason: "limits-insufficient" });
    expect(requestDevice).not.toHaveBeenCalled();
  });
  it("device request fails", async () => {
    const gpu = gpuWith(async () =>
      adapterWith(async () => {
        throw new Error("device unavailable");
      }),
    );
    const error = await createGpuGlacier(small, {}, { gpu }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GlacierGpuError);
    expect((error as GlacierGpuError).reason).toBe("device-request-failed");
    expect((error as Error).message).toMatch(/device unavailable/);
  });
  it("invalid config is rejected by the shared resolver", async () => {
    await expect(createGpuGlacier({ dtYears: 0 }, {}, { gpu: undefined })).rejects.toThrow(
      /Invalid GlacierConfig/,
    );
  });
});

describe("backend selection", () => {
  it('"cpu" runs the reference with no fallback reason', async () => {
    const s = await selectGlacierBackend(small, {}, { prefer: "cpu" });
    expect(s).toMatchObject({ backend: "cpu", requested: "cpu", fallbackReason: null, failure: null });
    expect(s.solver.backend).toBe("cpu");
  });

  it('"auto" does not touch WebGPU unless the recorded parity passed', async () => {
    const requestAdapter = vi.fn(async () => null);
    const s = await selectGlacierBackend(
      small,
      {},
      {
        prefer: "auto",
        parity: { ...passed, status: "failed", autoSelectsGpu: false },
        gpu: { gpu: gpuWith(requestAdapter) },
      },
    );
    expect(s.backend).toBe("cpu");
    expect(s.fallbackReason).toMatch(/GPU not used automatically/);
    expect(requestAdapter).not.toHaveBeenCalled();
  });

  it('"auto" falls back to the CPU with the GPU failure attached', async () => {
    const s = await selectGlacierBackend(
      small,
      {},
      { prefer: "auto", parity: passed, gpu: { gpu: gpuWith(async () => null) } },
    );
    expect(s.backend).toBe("cpu");
    expect(s.failure?.reason).toBe("adapter-unavailable");
    expect(s.fallbackReason).toMatch(/^WebGPU not used, running on CPU: \[adapter-unavailable\]/);
  });

  it('an explicit "webgpu" request is never served by the CPU', async () => {
    await expect(
      selectGlacierBackend(small, {}, { prefer: "webgpu", gpu: { gpu: undefined } }),
    ).rejects.toMatchObject({ reason: "webgpu-unavailable" });
  });

  it("a CPU restart after a GPU failure is a new run from the start, labelled", () => {
    const failure = new GlacierGpuError("device-lost", "gone");
    const s = restartOnCpu(createCpuGlacier(small).config, {}, failure, 1234);
    expect(s.backend).toBe("cpu");
    expect(s.solver.step).toBe(0);
    expect(s.failure).toBe(failure);
    expect(s.fallbackReason).toBe(
      "WebGPU run halted at step 1234 (device-lost); new CPU run from the authored start",
    );
  });
});

describe("asynchronous CPU adapter", () => {
  it("matches the synchronous CPU reference exactly", async () => {
    const a = createCpuGlacier(small);
    const b = asyncCpuGlacier(createCpuGlacier(small));
    a.advance(60);
    await b.advance(60);
    expect(await b.hash()).toBe(a.hash());
    expect(b.step).toBe(60);
    expect(b.modelYears).toBe(a.modelYears);
    expect(await b.probes()).toEqual(a.probes());
    expect(await b.budget()).toEqual(a.budget());
    expect(await b.section(12)).toEqual(a.section(12));
    await expect(b.advance(-1)).rejects.toThrow(RangeError);
  });
});
