import { describe, expect, it } from "vitest";
import { ARROW_KEY_MOTION, blockAxesOnScreen, blockDirectionForMotion } from "./block-arrows";

// D-W7-7D: a drag (or an arrow key) on an on-block arrow is reported as a direction in block axes.

/** A three-quarter view: block +X goes right and a little down, block +Z (towards the reader) down-left. */
const axes = { across: { x: 0.92, y: 0.39 }, along: { x: -0.45, y: 0.89 } };

describe("block arrows", () => {
  it("classifies a drag by the block axis it follows on screen", () => {
    expect(blockDirectionForMotion({ x: 40, y: 15 }, axes, 18)).toEqual({ axis: "across", sign: 1 });
    expect(blockDirectionForMotion({ x: -40, y: -10 }, axes, 18)).toEqual({ axis: "across", sign: -1 });
    expect(blockDirectionForMotion({ x: -10, y: 40 }, axes, 18)).toEqual({ axis: "along", sign: 1 });
    expect(blockDirectionForMotion({ x: 15, y: -40 }, axes, 18)).toEqual({ axis: "along", sign: -1 });
  });

  it("ignores motions shorter than the threshold", () => {
    expect(blockDirectionForMotion({ x: 5, y: 3 }, axes, 18)).toBeNull();
    expect(blockDirectionForMotion({ x: 0, y: 0 }, axes)).toBeNull();
  });

  it("maps the arrow keys onto the nearest block direction", () => {
    const k = (key: string) => blockDirectionForMotion(ARROW_KEY_MOTION[key]!, axes);
    expect(k("ArrowRight")).toEqual({ axis: "across", sign: 1 });
    expect(k("ArrowLeft")).toEqual({ axis: "across", sign: -1 });
    expect(k("ArrowDown")).toEqual({ axis: "along", sign: 1 });
    expect(k("ArrowUp")).toEqual({ axis: "along", sign: -1 });
  });

  it("projects the block axes through the stage, or gives null before it can", () => {
    const stage = {
      projectBlockPoints: (pts: readonly (readonly [number, number, number])[]) =>
        pts.map(([x, , z]) => ({ x: 100 + x * 0.01 - z * 0.005, y: 50 + z * 0.01 })),
    };
    const a = blockAxesOnScreen(stage, [0, 0, 0], 1000)!;
    expect(a.origin).toEqual({ x: 100, y: 50 });
    expect(a.across.x).toBeCloseTo(1);
    expect(a.acrossPx).toBeCloseTo(10);
    expect(blockAxesOnScreen({ projectBlockPoints: (p) => p.map(() => null) }, [0, 0, 0], 1000)).toBeNull();
  });
});
