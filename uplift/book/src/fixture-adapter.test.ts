import { describe, expect, it } from "vitest";
import { createFixtureAdapter, fixtureLabels } from "./fixture-adapter";
import { findTypedNumbers } from "@hachure/runtime";
import { mockSpread } from "./mock-spread";
describe("book fixture adapter", () => {
  it("runs integer fixed steps and replays deterministically after reset", async () => {
    const adapter = createFixtureAdapter();
    const initial = await adapter.solver.hash();
    adapter.play();
    for (let n = 0; n < 20; n++) adapter.advance(0.05);
    expect(adapter.solver.stepCount).toBe(20);
    const hash = await adapter.solver.hash();
    expect(hash).not.toBe(initial);
    adapter.pause();
    adapter.advance(0.1);
    expect(await adapter.solver.hash()).toBe(hash);
    adapter.reset();
    expect(await adapter.solver.hash()).toBe(initial);
    adapter.play();
    for (let n = 0; n < 20; n++) adapter.advance(0.05);
    expect(await adapter.solver.hash()).toBe(hash);
    adapter.solver.dispose();
  });
  it("clamps controls and derives labels from current config and snapshot", async () => {
    const adapter = createFixtureAdapter();
    adapter.setRain(500);
    expect(adapter.solver.config.rainMmPerHr).toBe(50);
    adapter.setSpeed(10);
    expect(adapter.speed).toBe(4);
    const snapshot = await adapter.snapshot();
    expect(fixtureLabels(snapshot, adapter.speed, 20).time).toContain("80 fixed steps");
    expect(fixtureLabels({ ...snapshot, metresPerCell: 20 }, 1, 20).scale).toContain("160 m");
    expect(fixtureLabels(snapshot, 1, 20).time).toContain("Uncalibrated");
    adapter.solver.dispose();
  });
  it("has no independently typed numerical page text", () => {
    const texts = [
      mockSpread.title,
      mockSpread.page.body,
      mockSpread.page.predict.question,
      ...mockSpread.page.predict.options,
      mockSpread.page.flap,
      ...mockSpread.page.keyWords.flatMap((w) => [w.term, w.definition]),
    ];
    for (const text of texts)
      for (const value of Object.values(text)) expect(findTypedNumbers(value)).toEqual([]);
    for (const items of Object.values(mockSpread.page.ignores))
      for (const text of items) expect(findTypedNumbers(text)).toEqual([]);
  });
});
