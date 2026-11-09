import { describe, expect, it } from "vitest";
import { DEFAULT_TERRAIN_CONFIG } from "@hachure/terrain";
import {
  captureLearningConfig,
  createLearningLog,
  isLearningEvent,
  type LearningContext,
  type LearningEvent,
  type LearningExport,
} from "./log";
import { tryLearningExport } from "./panel";

function context(): LearningContext {
  return {
    level: "hs",
    live: {
      seed: 1,
      modelStep: 7,
      backend: "cpu-worker",
      config: captureLearningConfig(DEFAULT_TERRAIN_CONFIG),
    },
    recorded: {
      comparison: "rain-gross-erosion-v1",
      seed: 17,
      modelStep: 200,
      dtSimSeconds: 0.05,
      rainMmPerHr: [5, 20],
    },
  };
}
const packet = (log: ReturnType<typeof createLearningLog>) => JSON.parse(log.exportJson()) as LearningExport;

describe("anonymous local lesson observations", () => {
  it("records university changes and hidden-default restoration separately from terrain reset", () => {
    const log = createLearningLog(context);
    log.start();
    for (const control of ["capacityCoefficient", "erosionRatePerS", "depositionRatePerS"] as const)
      expect(log.record({ kind: "control", control, value: 0.01 })).toBe(true);
    expect(log.record({ kind: "restore-defaults" })).toBe(true);
    const last = packet(log).events.at(-1)!;
    expect(last.source).toBe("live");
    expect(last.action).toEqual({ kind: "restore-defaults" });
    expect(last.context.live!.modelStep).toBe(7);
    expect(isLearningEvent(last)).toBe(true);
  });

  it("starts off, opts in explicitly and stops without clearing retained observations", () => {
    const log = createLearningLog(context);
    expect(log.record({ kind: "prediction", choice: 1 })).toBe(false);
    expect(packet(log).events).toEqual([]);
    log.start();
    log.start();
    expect(log.enabled).toBe(true);
    log.record({ kind: "prediction", choice: 1 });
    log.stop();
    log.stop();
    expect(log.enabled).toBe(false);
    expect(log.record({ kind: "level", level: "uni" })).toBe(false);
    expect(packet(log).events.map((e) => e.action.kind)).toEqual(["collection", "prediction", "collection"]);
    expect(packet(log).events[0]!.context.live!.modelStep).toBe(7);
  });
  it("retains only the bounded tail, reports omissions and preserves deterministic sequence order", () => {
    const run = () => {
      const log = createLearningLog(context, 3);
      log.start();
      for (let i = 0; i < 5; i++) log.record({ kind: "control", control: "rain", value: i });
      return packet(log);
    };
    const p = run();
    expect(p.events.map((e) => e.sequence)).toEqual([3, 4, 5]);
    expect(p.droppedEvents).toBe(3);
    expect(run()).toEqual(p);
    for (const capacity of [0, -1, 0.5, 2001, Infinity])
      expect(() => createLearningLog(context, capacity)).toThrow();
  });
  it("clear deletes retained data and ordering counters but preserves the explicit collection choice", () => {
    const log = createLearningLog(context);
    log.start();
    log.clear();
    expect(log.enabled).toBe(true);
    expect(packet(log).events).toEqual([]);
    expect(log.droppedEvents).toBe(0);
    log.record({ kind: "challenge", status: "pending" });
    expect(packet(log).events[0]!.sequence).toBe(0);
    log.stop();
    log.clear();
    expect(log.enabled).toBe(false);
    expect(packet(log).events).toEqual([]);
  });
  it("clones config, arrays, actions and contexts before subsequent mutations", () => {
    const metadata = { ...DEFAULT_TERRAIN_CONFIG, name: "private", timestamp: 123 };
    expect(captureLearningConfig(metadata)).not.toHaveProperty("name");
    expect(captureLearningConfig(metadata)).not.toHaveProperty("timestamp");
    const c = structuredClone(context());
    const action = { kind: "control", control: "rain", value: 10 } as const;
    const log = createLearningLog(() => c);
    log.start();
    log.record(action);
    Object.assign(c.live!.config, { rainMmPerHr: 99 });
    Object.assign(c.recorded.rainMmPerHr, { 0: 99 });
    Object.assign(action, { value: 99 });
    const saved = packet(log).events[1]!;
    expect(saved.context.live!.config.rainMmPerHr).toBe(10);
    expect(saved.context.recorded.rainMmPerHr).toEqual([5, 20]);
    expect(saved.action).toEqual({ kind: "control", control: "rain", value: 10 });
  });
  it("never relabels the recorded context as a live outcome", () => {
    const log = createLearningLog(context);
    log.start();
    log.record({ kind: "comparison", action: "endpoint" });
    log.record({ kind: "reset" });
    const events = packet(log).events;
    expect(events[1]!.source).toBe("recorded");
    expect(events[1]!.context.recorded.seed).toBe(17);
    expect(events[1]!.context.live!.seed).toBe(1);
    expect(events[1]!.context.live!.backend).toBe("cpu-worker");
    expect(events[2]!.source).toBe("live");
    expect(events.every(isLearningEvent)).toBe(true);
  });
  it("rejects unknown fields, identities, free text, clocks, nonfinite data and invented success", () => {
    const log = createLearningLog(context);
    log.start();
    const good = packet(log).events[0]!;
    for (const backend of ["webgpu", "cpu-worker", "cpu-64", "flat"])
      expect(
        isLearningEvent({ ...good, context: { ...good.context, live: { ...good.context.live, backend } } }),
      ).toBe(true);
    const invalid: unknown[] = [
      { ...good, version: 2 },
      { ...good, timestamp: 123 },
      { ...good, userId: "name" },
      { ...good, source: "live" },
      { ...good, context: { ...good.context, live: { ...good.context.live, backend: "device-name" } } },
      { ...good, action: { kind: "challenge", status: "success" } },
      { ...good, action: { kind: "prediction", choice: -1 } },
      { ...good, action: { kind: "learning-check", phase: "pre", answer: 3 } },
      { ...good, action: { kind: "level", level: "uni", text: "identity" } },
      { ...good, context: { ...good.context, recorded: { ...good.context.recorded, name: "identity" } } },
      { ...good, context: { ...good.context, live: { ...good.context.live, seed: 99 } } },
      {
        ...good,
        context: {
          ...good.context,
          live: { ...good.context.live, config: { ...good.context.live!.config, rainMmPerHr: NaN } },
        },
      },
    ];
    for (const value of invalid) expect(isLearningEvent(value)).toBe(false);
    expect(log.record({ kind: "challenge", status: "success" } as unknown as LearningEvent["action"])).toBe(
      false,
    );
    expect(log.size).toBe(1);
  });
  it("contains context/observer/export failures and preserves data after failed downloads", () => {
    const broken = createLearningLog(() => {
      throw new Error("unavailable");
    });
    expect(() => broken.start()).not.toThrow();
    expect(broken.record({ kind: "reset" })).toBe(false);
    const log = createLearningLog(context);
    log.subscribe(() => {
      throw new Error("observer failed");
    });
    expect(() => log.start()).not.toThrow();
    const before = log.exportJson();
    expect(
      tryLearningExport(log, () => {
        throw new Error("download blocked");
      }),
    ).toBe(false);
    expect(log.exportJson()).toBe(before);
    let downloaded = "";
    expect(
      tryLearningExport(log, (json) => {
        downloaded = json;
      }),
    ).toBe(true);
    expect(downloaded).toBe(before);
    expect(log.enabled).toBe(true);
  });
  it("contains invalid context fields, null context and hostile getters", () => {
    const c = { ...context(), name: "private" };
    const log = createLearningLog(() => c);
    log.start();
    expect(log.size).toBe(0);
    const hostile = {
      get version() {
        throw new Error("getter");
      },
    };
    expect(isLearningEvent(hostile)).toBe(false);
    expect(isLearningEvent(null)).toBe(false);
  });
});
