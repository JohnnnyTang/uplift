import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type CapturedRunManifest, decodeCapturedRun } from "@hachure/glacier";
import { PROTOCOL_SECTIONS } from "@hachure/glacier/testing";
import { PROVISIONAL_LITHOLOGIES, toBlockGrid, validateSnapshot, valleyGridIndex } from "@hachure/ink/stage";
import { CAPTURE_ORIENTATION, acrossRow, combinedRange, reviewRunsFromCaptures } from "./runs";
import { SHAPE_MIDPOINT, overdeepeningNote } from "./notes";
import { REVIEW_DEFAULT_CUT_COLUMN } from "./review";

const dir = new URL("../../../../../hachure/glacier/src/testing/captured-runs/", import.meta.url);
const ROCKS = ["shale", "sandstone", "granite"] as const;

function load(rock: string) {
  const manifest = JSON.parse(readFileSync(new URL(`${rock}.json`, dir), "utf8")) as CapturedRunManifest;
  const bin = readFileSync(new URL(manifest.binFile, dir));
  return decodeCapturedRun(manifest, bin);
}
const lookIdFor = (key: string) => PROVISIONAL_LITHOLOGIES.find((l) => l.key === key)!.id;
const captures = ROCKS.map(load);
const runs = reviewRunsFromCaptures(captures, lookIdFor);

describe("review runs from 5G's captured runs", () => {
  it("reads grid, cell size, snapshot count, rock, snowline and time from each manifest", () => {
    runs.forEach((run, r) => {
      const m = captures[r]!.manifest;
      expect(run.isFixture).toBe(false);
      expect(run.provenance).not.toMatch(/fixture/i);
      expect(run.rockKey).toBe(m.rockId);
      expect(run.frames).toHaveLength(m.snapshots.length);
      expect(run.dressing.snowlineM).toBe(m.config.snowlineAltitudeM);
      expect(run.erosionSpeedup).toBe(m.config.erosionSpeedup);
      run.frames.forEach((f, k) => {
        validateSnapshot(f.snapshot);
        expect(f.snapshot.columns).toBe(m.grid.nx);
        expect(f.snapshot.rows).toBe(m.grid.ny);
        expect(f.snapshot.metresPerCell).toBe(m.grid.metresPerCell);
        expect(f.modelYears).toBe(m.snapshots[k]!.modelYears);
        expect(f.label).toContain(String(m.snapshots[k]!.modelYears));
      });
    });
  });

  it("starts ice-free and puts the glacier at the valley head, at the back of the block", () => {
    for (const run of runs) {
      expect(Math.max(...Array.from(run.start.iceThicknessM!))).toBe(0);
      const g = toBlockGrid(run.frames.at(-1)!.snapshot, run.orientation);
      const rowIce = (l: number) => {
        let ice = 0;
        for (let a = 0; a < g.across; a++) ice = Math.max(ice, g.iceM[l * g.across + a]!);
        return ice;
      };
      // Head (back, l small) carries ice; the mouth (front row) does not.
      expect(rowIce(Math.round(g.along * 0.2))).toBeGreaterThan(20);
      expect(rowIce(g.along - 1)).toBe(0);
    }
  });

  it("frames all runs in one vertical range", () => {
    const r = combinedRange(runs);
    for (const run of runs) {
      expect(run.elevationRangeM.minM).toBeGreaterThanOrEqual(r.minM);
      expect(run.elevationRangeM.maxM).toBeLessThanOrEqual(r.maxM);
    }
  });

  it("measures the front face with the model's probe, consistently with the block orientation", () => {
    const run = runs[0]!;
    const nx = run.frames[0]!.snapshot.columns;
    // The front face at the block's last row is the grid's mouth column, i = 0.
    expect(valleyGridIndex(CAPTURE_ORIENTATION, nx, nx - 1)).toBe(0);
    const s0 = run.section(0, 10)!;
    expect(s0.floorLoweredM).toBe(0);
    expect(s0.iceThicknessM).toBe(0);
    expect(run.section(0, nx)).toBeNull();
  });

  // The registered under-ice section and the review build's U front face (docs/review/glacial/stage/
  // capture.mjs, U_COLUMN). Grid columns, not fractions of the grid, so a regenerated grid cannot silently
  // move the test into the overdeepened head basin.
  it.each([
    ["registered under-ice section", PROTOCOL_SECTIONS.underIce],
    ["review U front face", 51],
  ])(
    "supports the page's rock sentence at the %s: soft rock is lowered deeper, hard rock keeps steeper walls",
    (_name, column) => {
      const byRock = Object.fromEntries(
        runs.map((run) => [run.rockKey, run.section(run.frames.length - 1, column)!]),
      );
      expect(byRock.shale!.floorLoweredM).toBeGreaterThan(byRock.sandstone!.floorLoweredM);
      expect(byRock.sandstone!.floorLoweredM).toBeGreaterThan(byRock.granite!.floorLoweredM);
      expect(byRock.granite!.steepestWallDeg).toBeGreaterThan(byRock.sandstone!.steepestWallDeg);
      expect(byRock.sandstone!.steepestWallDeg).toBeGreaterThan(byRock.shale!.steepestWallDeg);
      for (const s of Object.values(byRock)) expect(s.iceThicknessM).toBeGreaterThan(0);
    },
  );

  it("reads the front-face profile in the block's left-to-right order (the same rotation as toBlockGrid)", () => {
    const run = runs[1]!;
    const k = run.frames.length - 1;
    const snap = run.frames[k]!.snapshot;
    const g = toBlockGrid(snap, run.orientation);
    const column = 51;
    const row = valleyGridIndex(run.orientation, g.along, column);
    const p = run.profile(k, column)!;
    for (let a = 0; a < g.across; a++) {
      expect(p.bedM[a]).toBeCloseTo(g.bedM[row * g.across + a]!, 3);
      expect(p.iceM[a]).toBeCloseTo(g.iceM[row * g.across + a]!, 3);
      expect(acrossRow(run.orientation, snap.rows, a) * snap.columns + column).toBeGreaterThanOrEqual(0);
    }
    expect(Array.from(p.startBedM)).toEqual(Array.from(run.profile(0, column)!.bedM));
  });

  it("averages the margin-note section over three columns (120 m on the 40 m grid)", () => {
    const run = runs[0]!;
    const s = run.section(run.frames.length - 1, 51)!;
    expect(s.spanM).toBe(3 * run.frames[0]!.snapshot.metresPerCell);
  });

  it("shows every rock closer to a U than a V at the default front face, last snapshot (D-W5-R1 item 4)", () => {
    for (const run of runs)
      expect(run.section(run.frames.length - 1, REVIEW_DEFAULT_CUT_COLUMN)!.shapeExponent).toBeGreaterThan(
        SHAPE_MIDPOINT,
      );
  });

  it("shows the overdeepening note only where the model's floor is worn below the floor further down", () => {
    const nx = runs[0]!.frames[0]!.snapshot.columns;
    const noted = (run: (typeof runs)[number]) =>
      Array.from({ length: nx }, (_, i) => i).filter((i) =>
        overdeepeningNote(run.overdeepening(run.frames.length - 1, i)),
      );
    const byRock = Object.fromEntries(runs.map((r) => [r.rockKey, noted(r)]));
    expect(byRock.shale!.length).toBeGreaterThan(0);
    expect(byRock.shale).not.toContain(REVIEW_DEFAULT_CUT_COLUMN);
    expect(byRock.granite).toEqual([]);
  });
});
