import { describe, expect, it, vi } from "vitest";
import { createSpreadLifecycle } from "./lifecycle";

describe("guided lifecycle", () => {
  it("requires commitment and a completed lift before unlocking the key control", () => {
    const loop = createSpreadLifecycle({ keyControlId: "rain", predictOptionCount: 3 });
    const states: string[] = [];
    const stop = loop.subscribe(({ state }) => states.push(state));
    expect(loop.isControlEnabled("rain")).toBe(false);
    expect(loop.isControlEnabled("reset")).toBe(true);
    expect(() => loop.completeLift()).toThrow();
    loop.beginPrediction();
    expect(() => loop.commitPrediction(3)).toThrow();
    expect(loop.prediction).toBeNull();
    loop.commitPrediction(1);
    expect(loop.prediction).toBe(1);
    expect(loop.isControlEnabled("rain")).toBe(false);
    expect(() => loop.commitPrediction(0)).toThrow();
    loop.completeLift();
    expect(loop.isControlEnabled("rain")).toBe(true);
    loop.explain();
    loop.challenge();
    expect(states).toEqual(["predicting", "lifting", "interactive", "explained", "challenged"]);
    stop();
    loop.reset();
    expect(loop.snapshot).toEqual({ state: "flat", prediction: null });
    expect(loop.isControlEnabled("rain")).toBe(false);
    expect(states).toHaveLength(5);
  });
  it("rejects skipped stages without publishing changes", () => {
    const loop = createSpreadLifecycle({ keyControlId: "rain", predictOptionCount: 2 });
    const listener = vi.fn();
    loop.subscribe(listener);
    expect(() => loop.explain()).toThrow();
    expect(() => loop.challenge()).toThrow();
    expect(() => loop.commitPrediction(0)).toThrow();
    expect(listener).not.toHaveBeenCalled();
    expect(loop.state).toBe("flat");
  });
  it.each([1, 5, 2.5, NaN])("rejects invalid option count %s", (predictOptionCount) => {
    expect(() => createSpreadLifecycle({ keyControlId: "rain", predictOptionCount })).toThrow();
  });
});
