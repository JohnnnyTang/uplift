import { describe, expect, it } from "vitest";
import type { ReaderPresentation, ReaderSceneStatus } from "@hachure/runtime";
import { createSceneFixture } from "./scene";

const defaults: ReaderPresentation = {
  level: "hs",
  prediction: { kind: "unanswered" },
  explanationOpen: false,
  liftFraction: 0,
  selection: { kind: "none" },
};
// No DOM operation is used by these headless adapters. Browser fixtures pass a real element.
const container = {} as HTMLElement;
const fixture = () =>
  createSceneFixture({ scope: { kind: "live-process", time: "uncalibrated" }, presentation: defaults });

describe("reader scene wiring fixture (not simulation evidence)", () => {
  it("updates retained presentation while loading, detached and in fallback", async () => {
    const f = fixture();
    f.controller.present({ ...defaults, level: "uni", explanationOpen: true });
    await f.controller.mount(container);
    await f.controller.pauseAndSettle();
    f.controller.detach();
    f.controller.present({ ...defaults, level: "uni", explanationOpen: true });
    expect(f.controller.presentation().level).toBe("uni");
    f.fail("Context lost");
    f.controller.present({ ...defaults, explanationOpen: true });
    expect(f.controller.presentation().explanationOpen).toBe(true);
    await f.controller.mount(container);
    expect(() => f.controller.resume()).not.toThrow();
    expect(f.controller.status().activity).toBe("paused");
    await f.controller.dispose();
    expect(() => f.controller.present(defaults)).toThrow("disposed");
  });

  it("binds declared scalar geometry values and updates subscribed DOM text", () => {
    const f = createSceneFixture({
      scope: { kind: "static-geometry" },
      presentation: defaults,
      bindingDefinitions: {
        controls: [],
        probes: [
          {
            id: "selectedElevation",
            label: { hs: "Height", uni: "Height" },
            request: { kind: "geometry-elevation" },
            shape: "scalar",
            unit: "m",
            significantFigures: 3,
          },
        ],
      },
      initialBindings: { probe: { selectedElevation: 20 } },
    });
    const values: string[] = [];
    const unsubscribe = f.controller.bindings.subscribeText("Height {{probe.selectedElevation}}", (text) =>
      values.push(text),
    );
    f.publishBindings({ probe: { selectedElevation: 30 } });
    expect(values).toEqual(["Height 20 m", "Height 30 m"]);
    expect(() => f.publishBindings({ probe: { undeclared: 4 } })).toThrow("Unknown");
    unsubscribe();
  });

  it("settles failed accepted work and prevents reset from resurrecting a disposed scene", async () => {
    const f = fixture();
    await f.controller.mount(container);
    const mutation = f.mutate(async () => {
      throw new Error("Fixture work failed");
    });
    await expect(mutation).rejects.toThrow("work failed");
    const reset = f.controller.reset();
    const dispose = f.controller.dispose();
    await expect(reset).rejects.toThrow("disposed");
    await dispose;
    expect(f.controller.status()).toMatchObject({
      activity: "paused",
      readiness: { kind: "disposed" },
      attached: false,
    });
    expect(f.calls).not.toContain("reset");
  });
  it("permits play and reveal before answering and preserves the model on level/view changes", async () => {
    const f = fixture();
    await f.controller.mount(container);
    f.controller.present({ ...defaults, explanationOpen: true, level: "uni", liftFraction: 1 });
    f.setPlaying(true);
    await f.mutate(async () => {
      f.model.sourceId = "moved-source";
    });
    const model = f.model;
    await f.controller.pauseAndSettle();
    f.controller.detach();
    await f.controller.mount(container);
    f.controller.resume();
    expect(f.model).toBe(model);
    expect(f.model).toEqual({ mutations: 1, sourceId: "moved-source" });
    expect(f.controller.status().activity).toBe("playing");
    expect(f.controller.presentation()).toMatchObject({
      level: "uni",
      prediction: { kind: "unanswered" },
      explanationOpen: true,
    });
  });

  it("drains an accepted mutation before departure, refuses later mutations, then detaches", async () => {
    const f = fixture();
    await f.controller.mount(container);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mutation = f.mutate(() => gate);
    const settle = f.controller.pauseAndSettle();
    expect(f.controller.status().activity).toBe("settling");
    expect(() => f.controller.detach()).toThrow("Settle");
    expect(() => f.mutate(async () => {})).toThrow("departing");
    release();
    await Promise.all([mutation, settle]);
    f.controller.detach();
    expect(f.calls).toEqual(["mount", "settle-start", "mutation", "settled", "detach"]);
  });

  it("resets authored defaults while retaining level and closes explanation", async () => {
    const f = fixture();
    await f.controller.mount(container);
    f.controller.present({
      ...defaults,
      level: "uni",
      prediction: { kind: "answered", optionIndex: 0 },
      explanationOpen: true,
      liftFraction: 1,
      selection: { kind: "source", id: "moved", xM: 1, yM: 2 },
    });
    await f.mutate(async () => {
      f.model.sourceId = "moved";
    });
    f.setPlaying(true);
    await f.controller.reset();
    expect(f.controller.presentation()).toEqual({ ...defaults, level: "uni" });
    expect(f.model).toEqual({ mutations: 0, sourceId: "authored-source" });
    expect(f.controller.status().activity).toBe("paused");
  });

  it("publishes readiness, busy gesture and context fallback; disposal is idempotent", async () => {
    const f = fixture();
    const states: ReaderSceneStatus[] = [];
    const unsubscribe = f.controller.subscribe((state) => states.push(state));
    expect(states[0]!.readiness.kind).toBe("loading");
    await f.controller.mount(container);
    f.setGesture("source");
    expect(states.at(-1)!.gesture).toBe("source");
    f.fail("Context lost");
    expect(states.at(-1)).toMatchObject({
      readiness: { kind: "fallback", reason: "Context lost" },
      activity: "paused",
      gesture: "idle",
    });
    expect(() => f.setPlaying(true)).toThrow();
    await Promise.all([f.controller.dispose(), f.controller.dispose()]);
    expect(states.at(-1)!.readiness.kind).toBe("disposed");
    expect(f.calls.filter((call) => call === "dispose")).toHaveLength(1);
    unsubscribe();
    unsubscribe();
  });

  it("keeps a static fixture clock-free with absent reflection", async () => {
    const f = createSceneFixture({
      scope: { kind: "static-geometry" },
      presentation: { ...defaults, prediction: { kind: "absent" } },
    });
    await f.controller.mount(container);
    f.controller.resume();
    expect(() => f.setPlaying(true)).toThrow("Playback unavailable");
    expect(f.controller.status().activity).toBe("paused");
    expect(f.controller.presentation().prediction.kind).toBe("absent");
  });
});
