import { describe, expect, it, vi } from "vitest";
import { createFakeSolver } from "@hachure/terrain/testing";
import type { Control, Probe } from "../schema/index";
import { createLevelState } from "./level";

describe("view-only level", () => {
  it("changes visibility without calling any solver method or changing its state hash", async () => {
    const solver = createFakeSolver({ gridSize: 8 });
    solver.step(5);
    const hash = await solver.hash();
    const methods = [
      "step",
      "configure",
      "applyTool",
      "snapshot",
      "budget",
      "reset",
      "dispose",
      "hash",
    ] as const;
    const spies = methods.map((method) => vi.spyOn(solver, method));
    const levels = createLevelState();
    const controls: Control[] = [
      { kind: "action", id: "step", action: "step", label: { hs: "Step", uni: "Step" }, levels: ["uni"] },
    ];
    const probes: Probe[] = [
      {
        id: "out",
        shape: "scalar",
        request: { kind: "budget" },
        label: { hs: "Out", uni: "Out" },
        unit: "m³",
        significantFigures: 3,
      },
    ];
    const listener = vi.fn();
    const stop = levels.subscribe(listener);
    expect(levels.visibleControls(controls)).toEqual([]);
    levels.setLevel("uni");
    expect(levels.visibleControls(controls)).toEqual(controls);
    expect(levels.visibleProbes(probes)).toEqual(probes);
    levels.setLevel("hs");
    levels.setLevel("hs");
    expect(listener.mock.calls).toEqual([["uni"], ["hs"]]);
    stop();
    levels.setLevel("uni");
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(await solver.hash()).toBe(hash);
    solver.dispose();
  });
});
