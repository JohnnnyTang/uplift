import { describe, expect, it } from "vitest";
import { type WoodContext, paintWood, seededRandom } from "./wood";

/** Records the painter's calls, with the stroke style and every path point. */
function recorder() {
  const log: string[] = [];
  const paths: [number, number][][] = [];
  let path: [number, number][] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    fillRect: (x: number, y: number, w: number, h: number) => log.push(`fill ${x} ${y} ${w} ${h}`),
    beginPath: () => {
      path = [];
    },
    moveTo: (x: number, y: number) => path.push([x, y]),
    lineTo: (x: number, y: number) => path.push([x, y]),
    stroke: () => {
      paths.push(path);
      log.push(`stroke ${path.length} ${ctx.strokeStyle}`);
    },
    save: () => log.push("save"),
    restore: () => log.push("restore"),
    rect: () => undefined,
    clip: () => undefined,
  };
  return { ctx: ctx as unknown as WoodContext, log, paths };
}

describe("procedural desk wood (6G)", () => {
  it("is seeded: the same seed paints the same boards, another seed different ones", () => {
    const a = recorder();
    const b = recorder();
    const c = recorder();
    paintWood(a.ctx, 1280, 800, 7);
    paintWood(b.ctx, 1280, 800, 7);
    paintWood(c.ctx, 1280, 800, 8);
    expect(a.log).toEqual(b.log);
    expect(a.log).not.toEqual(c.log);
  });

  it("tiles without a seam: every grain line ends at the height it starts", () => {
    const r = recorder();
    paintWood(r.ctx, 1280, 800, 7);
    const lines = r.paths.filter((p) => p.length > 2);
    expect(lines.length).toBeGreaterThan(300);
    for (const line of lines) {
      expect(line[0]![0]).toBe(0);
      expect(line.at(-1)![0]).toBeCloseTo(1280, 6);
      expect(line.at(-1)![1]).toBeCloseTo(line[0]![1], 6);
    }
  });

  it("uses a seeded generator in [0, 1)", () => {
    const random = seededRandom(1);
    const values = Array.from({ length: 1000 }, random);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(seededRandom(1)()).toBe(values[0]);
  });
});
