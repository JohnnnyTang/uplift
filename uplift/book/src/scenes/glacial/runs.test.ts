import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type CapturedRunManifest, decodeCapturedRun } from "@hachure/glacier";
import { PROVISIONAL_LITHOLOGIES, toBlockGrid, validateSnapshot, valleyGridIndex } from "@hachure/ink/stage";
import { CAPTURE_ORIENTATION, combinedRange, reviewRunsFromCaptures } from "./runs";

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

  it("supports the page's rock sentence: soft rock is lowered deeper, hard rock keeps steeper walls", () => {
    // Under the ice, two thirds of the way up the valley, at the last recorded time.
    const byRock = Object.fromEntries(
      runs.map((run) => {
        const nx = run.frames[0]!.snapshot.columns;
        const last = run.frames.length - 1;
        const sections = [0.55, 0.7, 0.85].map((f) => run.section(last, Math.round(f * (nx - 1)))!);
        return [
          run.rockKey,
          {
            lowered: Math.max(...sections.map((s) => s.floorLoweredM)),
            wall: Math.max(...sections.map((s) => s.steepestWallDeg)),
          },
        ];
      }),
    );
    expect(byRock.shale!.lowered).toBeGreaterThan(byRock.sandstone!.lowered);
    expect(byRock.sandstone!.lowered).toBeGreaterThan(byRock.granite!.lowered);
    expect(byRock.granite!.wall).toBeGreaterThan(byRock.shale!.wall);
  });
});
