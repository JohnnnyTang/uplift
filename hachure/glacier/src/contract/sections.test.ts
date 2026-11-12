import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  type CapturedRunManifest,
  OVERDEEPENING_MIN_RISE_M,
  decodeCapturedRun,
  measureOverdeepening,
  measureSection,
  measureSectionAveraged,
} from "./index";

/** A V valley along i, floor rising up-valley at `gradient`, with an optional floor offset per column. */
function vValley(nx: number, ny: number, dx: number, floorOffset: (i: number) => number = () => 0) {
  const bed = new Float32Array(nx * ny);
  const mid = (ny - 1) / 2;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++)
      bed[j * nx + i] = 1000 + i * 4 + floorOffset(i) + Math.abs(j - mid) * dx * 0.5;
  return { bed, grid: { nx, ny, metresPerCell: dx } };
}

describe("measureSectionAveraged", () => {
  it("averages measureSection over the column and its neighbours (three columns, 120 m on 40 m cells)", () => {
    const { bed, grid } = vValley(20, 15, 40, (i) => (i === 10 ? -30 : 0));
    const a = measureSectionAveraged(bed, undefined, grid, 10);
    expect(a.columns).toEqual([9, 10, 11]);
    expect(a.spanM).toBe(120);
    const s = [9, 10, 11].map((c) => measureSection(bed, undefined, grid, c));
    expect(a.floorElevationM).toBeCloseTo(
      (s[0]!.floorElevationM + s[1]!.floorElevationM + s[2]!.floorElevationM) / 3,
      4,
    );
    expect(a.depthM).toBeCloseTo((s[0]!.depthM + s[1]!.depthM + s[2]!.depthM) / 3, 4);
    expect(a.floorWidthM).toBeCloseTo((s[0]!.floorWidthM + s[1]!.floorWidthM + s[2]!.floorWidthM) / 3, 4);
  });

  it("clamps at the grid edge and reduces to measureSection with no neighbours", () => {
    const { bed, grid } = vValley(20, 15, 40);
    expect(measureSectionAveraged(bed, undefined, grid, 0).columns).toEqual([0, 1]);
    const one = measureSectionAveraged(bed, undefined, grid, 7, { halfWidthColumns: 0 });
    const s = measureSection(bed, undefined, grid, 7);
    expect(one.floorWidthM).toBe(s.floorWidthM);
    expect(one.maxWallSlopeDeg).toBe(s.maxWallSlopeDeg);
    expect(() => measureSectionAveraged(bed, undefined, grid, 20)).toThrow(RangeError);
  });
});

describe("measureOverdeepening", () => {
  it("is false on a floor that falls all the way to the mouth", () => {
    const { bed, grid } = vValley(30, 15, 40);
    for (let i = 0; i < 30; i++) {
      const o = measureOverdeepening(bed, grid, i);
      expect(o.adverseRiseDownValleyM).toBe(0);
      expect(o.overdeepened).toBe(false);
    }
  });

  it("finds a basin by its adverse slope, wherever it is, and names its lip", () => {
    // A basin 60 m deep centred on column 17: the floor there lies below the floor down-valley.
    const basin = (i: number) => -Math.max(0, 60 - Math.abs(i - 17) * 15);
    const { bed, grid } = vValley(30, 15, 40, basin);
    const start = vValley(30, 15, 40).bed;
    const o = measureOverdeepening(bed, grid, 17, { initialBed: start });
    expect(o.overdeepened).toBe(true);
    expect(o.adverseRiseDownValleyM).toBeGreaterThan(OVERDEEPENING_MIN_RISE_M);
    expect(o.lipColumn).toBeLessThan(17);
    expect(o.carvedRiseM).toBe(o.adverseRiseDownValleyM);
    // Down-valley of the lip, and well up-valley of the basin, the bed drains to the mouth.
    expect(measureOverdeepening(bed, grid, 5, { initialBed: start }).overdeepened).toBe(false);
    expect(measureOverdeepening(bed, grid, 28, { initialBed: start }).overdeepened).toBe(false);
  });

  it("does not count relief that was already on the starting bed", () => {
    const basin = (i: number) => (i > 25 ? -(i - 25) * 20 : 0);
    const { bed, grid } = vValley(30, 15, 40, basin);
    const o = measureOverdeepening(bed, grid, 29, { initialBed: bed });
    expect(o.adverseRiseDownValleyM).toBeGreaterThan(OVERDEEPENING_MIN_RISE_M);
    expect(o.carvedRiseM).toBe(0);
    expect(o.overdeepened).toBe(false);
  });

  it("finds the carved basin in shale's lower trough only, never in granite or at the valley head", () => {
    // A fact for the page (D-W5-R1 item 5, 5L's note): the head reach is lowered by 100–230 m, but its floor
    // still falls towards the mouth; shale's lower trough is worn below the floor further down.
    const dir = new URL("../testing/captured-runs/", import.meta.url);
    const basins: Record<string, number[]> = {};
    for (const rock of ["shale", "sandstone", "granite"]) {
      const manifest = JSON.parse(
        readFileSync(fileURLToPath(new URL(`${rock}.json`, dir)), "utf8"),
      ) as CapturedRunManifest;
      const bytes = readFileSync(fileURLToPath(new URL(manifest.binFile, dir)));
      const run = decodeCapturedRun(
        manifest,
        new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      );
      const start = run.snapshot(0).bedM;
      const last = run.snapshot(run.count - 1).bedM;
      basins[rock] = [];
      for (let i = 0; i < manifest.grid.nx; i++)
        if (measureOverdeepening(last, manifest.grid, i, { initialBed: start }).overdeepened)
          basins[rock]!.push(i);
    }
    expect(basins.shale!.length).toBeGreaterThan(5);
    expect(Math.min(...basins.shale!)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...basins.shale!)).toBeLessThanOrEqual(50);
    expect(basins.granite).toEqual([]);
  });
});
