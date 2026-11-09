/**
 * `step()` allocates nothing: after warm-up, thousands of steps leave the JS heap where it was and trigger
 * no garbage collection. Uses V8's heap statistics through Node built-ins (test-only; the solver itself
 * imports nothing from Node).
 */
import { describe, expect, it } from "vitest";
import { createCpuSolver } from "./index";
import { catchmentFixture } from "./test-fixtures";

interface V8Like {
  setFlagsFromString(flags: string): void;
  getHeapStatistics(): { used_heap_size: number };
}
interface VmLike {
  runInNewContext(code: string): unknown;
}
interface PerfHooksLike {
  PerformanceObserver: new (cb: (list: { getEntries(): unknown[] }) => void) => {
    observe(options: { entryTypes: string[] }): void;
    disconnect(): void;
  };
}

// Non-literal specifiers keep the bundler and the DOM-only type environment out of the way.
const nodeModule = async <T>(name: string): Promise<T> =>
  (await import(/* @vite-ignore */ `node:${name}`)) as T;

describe("no allocation in step()", () => {
  it("runs 16 000 steps of a wet, eroding catchment after warm-up without growing the heap or collecting garbage", async () => {
    const v8 = await nodeModule<V8Like>("v8");
    const vm = await nodeModule<VmLike>("vm");
    const { PerformanceObserver } = await nodeModule<PerfHooksLike>("perf_hooks");
    v8.setFlagsFromString("--expose-gc");
    const gc = vm.runInNewContext("gc") as () => void;

    const solver = createCpuSolver({ gridSize: 16 }, catchmentFixture());
    const l = solver.config.metresPerCell;
    await solver.applyTool({ kind: "spring", id: "s", at: { xM: 8.5 * l, yM: 2.5 * l }, flowM3PerS: 0.5 });
    await solver.applyTool({
      kind: "rain-source",
      id: "r",
      at: { xM: 80, yM: 80 },
      radiusM: 30,
      rainMmPerHr: 50,
    });
    // Warm-up through both call patterns: lets V8 tier up and settle its inline caches. Before that the
    // interpreter and JIT tiers allocate (measured ~0.2 MB per 4000 steps).
    solver.step(10_000);
    for (let k = 0; k < 4000; k++) solver.step();

    let collections = 0;
    const observer = new PerformanceObserver((list) => {
      collections += list.getEntries().length;
    });
    observer.observe({ entryTypes: ["gc"] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    gc();
    await new Promise((resolve) => setTimeout(resolve, 0));
    collections = 0;

    const before = v8.getHeapStatistics().used_heap_size;
    for (let k = 0; k < 16_000; k++) solver.step();
    const after = v8.getHeapStatistics().used_heap_size;
    await new Promise((resolve) => setTimeout(resolve, 0));
    observer.disconnect();

    const grownBytes = after - before;
    // One 16-byte allocation per step would add 256 KB. Measured: a fixed ~20–30 KB of JIT bookkeeping that
    // does not grow with the step count (18 KB at 1000 steps, 28 KB at 4000, 29 KB at 16 000).
    expect(grownBytes).toBeLessThan(64 * 1024);
    expect(collections).toBe(0);
    expect((await solver.budget()).erodedM3).toBeGreaterThan(0);
  });
});
