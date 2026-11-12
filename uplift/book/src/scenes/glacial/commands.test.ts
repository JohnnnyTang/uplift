import { describe, expect, it } from "vitest";
import { MAX_KEPT_RUNS, createLocalRockCommand } from "./commands";
import { describeProfile, overdeepeningNote, OVERDEEPENING_NOTE, shapeWords } from "./notes";
import type { ReviewRun, ReviewSection } from "./runs";

const run = (rockKey: string) => ({ rockKey }) as unknown as ReviewRun;
const shale = run("shale");
const sandstone = run("sandstone");
const granite = run("granite");
const runs = [shale, sandstone, granite];

describe("the one rock command (local stand-in)", () => {
  it("keeps the run shown before as a kept run, newest first, and never edits a run", () => {
    const command = createLocalRockCommand(runs, sandstone);
    expect(command.state).toEqual({ live: sandstone, kept: [], dropped: null });
    expect(command.chooseRock("sandstone")).toBeNull();
    expect(command.chooseRock("shale")).toEqual({ live: shale, kept: [sandstone], dropped: null });
    expect(command.chooseRock("granite")).toEqual({ live: granite, kept: [shale, sandstone], dropped: null });
    // Back to a kept rock: it becomes live and leaves the kept list (one recorded run per rock).
    expect(command.chooseRock("sandstone")).toEqual({
      live: sandstone,
      kept: [granite, shale],
      dropped: null,
    });
    expect(command.state.kept.length).toBeLessThanOrEqual(MAX_KEPT_RUNS);
    expect(command.chooseRock("basalt")).toBeNull();
    expect(command.reset(shale)).toEqual({ live: shale, kept: [], dropped: null });
  });

  it("names a dropped kept run when more than the limit would be kept", () => {
    const fourth = run("schist");
    const command = createLocalRockCommand([...runs, fourth], shale, [sandstone, granite]);
    expect(command.chooseRock("schist")).toEqual({
      live: fourth,
      kept: [shale, sandstone],
      dropped: granite,
    });
  });
});

const section = (over: Partial<ReviewSection> = {}): ReviewSection => ({
  spanM: 120,
  shapeExponent: 1.73,
  floorWidthM: 214,
  depthM: 272,
  floorLoweredM: 57,
  steepestWallDeg: 35.2,
  iceThicknessM: 200,
  ...over,
});

describe("bound words", () => {
  it("reads the shape exponent against the protocol's V ≈ 1 / U ≈ 2 anchors", () => {
    expect(shapeWords(1.73)).toBe("closer to a U than a V");
    expect(shapeWords(1.1)).toBe("closer to a V than a U");
    expect(shapeWords(Number.NaN)).toBeNull();
  });

  it("shows the overdeepening note only when the model says the section is overdeepened", () => {
    expect(overdeepeningNote(null)).toBeNull();
    expect(overdeepeningNote({ overdeepened: false, carvedRiseM: 16 })).toBeNull();
    expect(overdeepeningNote({ overdeepened: true, carvedRiseM: 40 })).toBe(OVERDEEPENING_NOTE);
  });

  it("describes the current profile with the model's rounded numbers, the kept run and the note", () => {
    const text = describeProfile({
      where: "4.3 km down the valley",
      throughIce: true,
      iceShown: false,
      rockName: "Shale",
      when: "300 model years",
      section: section(),
      kept: {
        rockName: "Granite",
        when: "300 model years",
        section: section({ floorLoweredM: 18, steepestWallDeg: 45 }),
      },
      overdeepening: OVERDEEPENING_NOTE,
    });
    expect(text).toContain("cut through the glacier; the ice is hidden");
    expect(text).toContain("closer to a U than a V (shape 1.7");
    expect(text).toContain("210 m wide and 270 m deep, lowered 60 m");
    expect(text).toContain("steepest wall is 35 degrees");
    expect(text).toContain(
      "kept granite run at 300 model years: floor lowered 20 m, steepest wall 45 degrees",
    );
    expect(text).toContain(OVERDEEPENING_NOTE);
  });
});
