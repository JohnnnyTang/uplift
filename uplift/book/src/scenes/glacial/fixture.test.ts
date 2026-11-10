import { describe, expect, it } from "vitest";
import { DEFAULT_DRESSING, toBlockGrid, validateSnapshot } from "@hachure/ink/stage";
import { GLACIAL_DRAWING_DESCRIPTION, glacialDrawingSvg } from "./drawing";
import { FIXTURE_DRESSING, FIXTURE_GRID, FIXTURE_LABEL, authoredValley, fixtureFrames } from "./fixture";
import { reviewRuns } from "./runs";

describe("authored glacial fixture", () => {
  it("is labelled as a fixture, not model output, and carries no model time", () => {
    expect(FIXTURE_LABEL).toMatch(/not a model run/);
    const run = reviewRuns()[0]!;
    expect(run.isFixture).toBe(true);
    expect(run.provenance).toBe(FIXTURE_LABEL);
    for (const frame of run.frames) expect(frame.snapshot.modelTimeYr).toBeUndefined();
  });

  it("has valid grids of the reference size and is deterministic", () => {
    const a = fixtureFrames();
    const b = fixtureFrames();
    for (const f of [a.start, a.glaciated]) {
      validateSnapshot(f.snapshot);
      expect(f.snapshot.columns).toBe(FIXTURE_GRID.columns);
      expect(f.snapshot.rows).toBe(FIXTURE_GRID.rows);
    }
    expect(Array.from(a.glaciated.snapshot.bedM)).toEqual(Array.from(b.glaciated.snapshot.bedM));
  });

  it("start has no ice; glaciated has ice only up-valley of the snout", () => {
    const { start, glaciated } = fixtureFrames();
    expect(Math.max(...Array.from(start.snapshot.iceThicknessM!))).toBe(0);
    const g = toBlockGrid(glaciated.snapshot);
    let lastIceRow = -1;
    for (let l = 0; l < g.along; l++)
      for (let a = 0; a < g.across; a++)
        if (g.iceM[l * g.across + a]! > DEFAULT_DRESSING.iceThresholdM) lastIceRow = l;
    expect(lastIceRow).toBeGreaterThan(g.along * 0.4);
    expect(lastIceRow).toBeLessThan(g.along * 0.75);
  });

  it("authors a trough wider than the start V under the ice, and the same V at the front", () => {
    const v = authoredValley("start");
    const u = authoredValley("glaciated");
    const at = 0.35;
    const c = v.centreM(at);
    expect(u.bedM(c + 600, at)).toBeLessThan(v.bedM(c + 600, at) - 50);
    expect(u.bedM(0, 1)).toBeCloseTo(v.bedM(0, 1), 6);
    expect(FIXTURE_DRESSING.snowlineM).toBeGreaterThan(FIXTURE_DRESSING.treelineM);
  });
});

describe("Fig. 1 drawing", () => {
  it("is deterministic, accessible and labelled", () => {
    const svg = glacialDrawingSvg({ idPrefix: "t" });
    expect(glacialDrawingSvg({ idPrefix: "t" })).toBe(svg);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-labelledby="t-title t-desc"');
    expect(svg).toContain(GLACIAL_DRAWING_DESCRIPTION);
    for (const label of [
      "cirque",
      "glacier",
      "snout",
      "meltwater river",
      "U-shaped valley",
      "V-shaped valley",
    ])
      expect(svg).toContain(`>${label}</text>`);
    expect(glacialDrawingSvg({ labels: false })).not.toContain("<text");
  });
});
