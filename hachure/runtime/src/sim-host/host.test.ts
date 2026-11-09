import { createCpuSolver, tiltedPlateauPreset, measureFixedSectionIncision } from "@hachure/terrain";
import { describe, expect, it } from "vitest";
import { FixedStepClock } from "./clock";
import { SimHost } from "./host";
import type { HostCommand, HostReply, HostSample, HostTransport } from "./protocol";
import { TerrainWorkerEngine, snapshotTransfers } from "./worker-engine";

class Transport implements HostTransport {
  commands: HostCommand[] = [];
  pending: ((reply: HostReply) => void)[] = [];
  request(command: HostCommand): Promise<HostReply> {
    this.commands.push(command);
    return new Promise((resolve) => this.pending.push(resolve));
  }
  reply(reply: HostReply = { processingMs: 0 }) {
    this.pending.shift()!(reply);
  }
  dispose() {}
}
const settled = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
describe("fixed-step scheduling", () => {
  it("keeps fractional steps and changes rate without changing numerical dt", () => {
    const clock = new FixedStepClock(30);
    for (let i = 0; i < 59; i++) {
      clock.add(1 / 60, 1);
      expect(clock.take()).toBe(i % 2);
    }
    clock.add(1 / 60, 1);
    expect(clock.take()).toBe(1);
    clock.add(1 / 30, 2);
    expect(clock.take()).toBe(2);
  });
  it("bounds catch-up after suspension", () => {
    const clock = new FixedStepClock(30, 8);
    clock.add(60, 1);
    expect(clock.take()).toBe(8);
    expect(clock.take()).toBe(8);
    expect(clock.take()).toBe(0);
    expect(clock.droppedRealSeconds).toBeGreaterThan(59);
  });
  it("keeps one automatic request in flight, pauses, and samples at a bounded cadence", async () => {
    const transport = new Transport();
    const host = new SimHost(transport, 30);
    host.advance(1);
    expect(transport.commands).toHaveLength(0);
    host.play();
    host.advance(0.1);
    host.advance(0.1);
    expect(transport.commands).toHaveLength(1);
    expect(transport.commands[0]).toEqual({ kind: "advance", steps: 3, sample: false });
    transport.reply();
    await settled();
    host.advance(0.3);
    expect(transport.commands[1]).toEqual({ kind: "advance", steps: 8, sample: false });
    transport.reply();
    await settled();
    host.advance(0.1);
    expect(transport.commands[2]).toMatchObject({ sample: true });
    host.pause();
    transport.reply();
    await settled();
    host.advance(1);
    expect(transport.commands).toHaveLength(3);
  });
  it("drops a stale pre-reset readback and publishes the reset generation", async () => {
    const transport = new Transport();
    const host = new SimHost(transport, 30);
    const samples: HostSample[] = [];
    host.subscribe((sample) => samples.push(sample));
    host.play();
    host.advance(0.25);
    const resetting = host.reset();
    const stale = { snapshot: { step: 10 } } as HostSample;
    const fresh = { snapshot: { step: 0 } } as HostSample;
    transport.reply({ processingMs: 0, sample: stale });
    await settled();
    expect(samples).toEqual([]);
    transport.reply({ processingMs: 0, sample: fresh });
    await resetting;
    expect(samples).toEqual([fresh]);
    expect(host.playing).toBe(false);
  });
});
describe("real Worker engine", () => {
  it("publishes the scientific float64 metric without drawing-layer rounding", async () => {
    const engine = new TerrainWorkerEngine();
    const first = (
      await engine.execute({
        kind: "init",
        config: { gridSize: 32, metresPerCell: 10, pipeAreaM2: 20, rainMmPerHr: 50 },
      })
    ).sample!;
    const reference = createCpuSolver(first.config, tiltedPlateauPreset);
    await reference.applyTool(tiltedPlateauPreset.layout(reference.config).source);
    const surface = () => ({ ...reference.config, ...reference.referenceLayers() });
    const baseline = surface();
    reference.step(200);
    const current = (await engine.execute({ kind: "advance", steps: 200, sample: true })).sample!;
    const expected = measureFixedSectionIncision(baseline, surface()).medianIncisionM;
    expect(current.probes.incisionDepth).toBe(expected);
    const drawingSurface = (sample: HostSample) => ({
      ...sample.config,
      bedrockM: sample.snapshot.layers.bedrockM!,
      sedimentM: sample.snapshot.layers.sedimentM!,
    });
    expect(expected).not.toBe(
      measureFixedSectionIncision(drawingSurface(first), drawingSurface(current)).medianIncisionM,
    );
    reference.dispose();
    engine.dispose();
  });
  it("uses the real preset, re-applies its source after reset and preserves baseline independently", async () => {
    const engine = new TerrainWorkerEngine();
    const first = await engine.execute({
      kind: "init",
      config: { gridSize: 32, metresPerCell: 10, pipeAreaM2: 20, rainMmPerHr: 0 },
    });
    expect(first.sample!.snapshot.step).toBe(0);
    const before = first.sample!.snapshot.layers.bedrockM!.slice();
    const stepped = await engine.execute({ kind: "advance", steps: 2, sample: true });
    expect(stepped.sample!.snapshot.budget.sourcedWaterM3).toBeGreaterThan(0);
    expect(stepped.sample!.paths.baseline).not.toBe(stepped.sample!.paths.current);
    expect(stepped.sample!.calibration.status).toBe("pending");
    const reference = createCpuSolver(first.sample!.config, tiltedPlateauPreset);
    await reference.applyTool(tiltedPlateauPreset.layout(reference.config).source);
    const surface = () => ({ ...reference.config, ...reference.referenceLayers() });
    const baseline = surface();
    reference.step(2);
    expect(stepped.sample!.probes.incisionDepth).toBe(
      measureFixedSectionIncision(baseline, surface()).medianIncisionM,
    );
    reference.dispose();
    expect(stepped.sample!.observationBaseline).toEqual({ kind: "reset", step: 0 });
    const reset = await engine.execute({ kind: "reset" });
    expect(reset.sample!.snapshot.layers.bedrockM).toEqual(before);
    const again = await engine.execute({ kind: "advance", steps: 2, sample: true });
    expect(again.sample!.snapshot.budget.sourcedWaterM3).toBe(stepped.sample!.snapshot.budget.sourcedWaterM3);
    const transfers = snapshotTransfers(again);
    expect(transfers).toHaveLength(Object.keys(again.sample!.snapshot.layers).length);
    const clone = structuredClone(again, { transfer: transfers });
    expect(clone.sample!.snapshot.layers.bedrockM!.length).toBe(32 * 32);
    expect((await engine.execute({ kind: "sample" })).sample!.snapshot.layers.bedrockM!.length).toBe(32 * 32);
    engine.dispose();
  });
});
