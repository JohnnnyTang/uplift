import { describe, expect, it } from "vitest";
import { convexHull, pointInPolygon, rowsForDrag } from "./gestures";

describe("gesture geometry", () => {
  it("hulls the projected block corners and hit-tests against them", () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 5, y: 5 },
    ]);
    expect(hull).toHaveLength(4);
    expect(pointInPolygon({ x: 5, y: 5 }, hull)).toBe(true);
    expect(pointInPolygon({ x: 11, y: 5 }, hull)).toBe(false);
  });

  it("turns pointer motion into rows along the face's screen direction of travel", () => {
    const perRow = { x: 0, y: 2 };
    expect(rowsForDrag({ x: 0, y: 10 }, perRow)).toBe(5);
    expect(rowsForDrag({ x: 0, y: -4 }, perRow)).toBe(-2);
    expect(rowsForDrag({ x: 7, y: 0 }, perRow)).toBe(0);
    expect(rowsForDrag({ x: 1, y: 1 }, { x: 0, y: 0 })).toBe(0);
  });
});
