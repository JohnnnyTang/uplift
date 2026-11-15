import { describe, expect, it } from "vitest";
import {
  type BlockFrame,
  blockBaseM,
  blockX,
  blockY,
  blockZ,
  buildCrustSection,
  clampCutRow,
  dashedProfile,
  drawnCrustBaseM,
  patternedProfile,
  solidProfile,
} from "./block-geometry";
import { CRUST_BAND_LOOK, crustPatternMarks, crustPatternSvg, paintCrustTile } from "./crust";
import { type LandscapeSnapshot, elevationRange, toBlockGrid, validateSnapshot } from "./snapshot";

/** A small authored block: a ridge across the middle, crust 30 km thick, thickening under the ridge. */
function snapshot(withCrust: boolean): LandscapeSnapshot {
  const columns = 11;
  const rows = 8;
  const bedM = new Float32Array(columns * rows);
  const crustBaseM = new Float32Array(columns * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const ridge = Math.max(0, 1 - Math.abs(c - 5) / 3);
      const k = r * columns + c;
      bedM[k] = 300 + 2000 * ridge;
      crustBaseM[k] = bedM[k]! - 30_000 - 12_000 * ridge;
    }
  // One cell whose authored crust base lies above the bed: drawn at the bed.
  crustBaseM[7 * columns + 0] = 1e4;
  return {
    columns,
    rows,
    metresPerCell: 5000,
    bedM,
    rockId: 0,
    ...(withCrust ? { crustBaseM } : {}),
  };
}

const frameFor = (s: LandscapeSnapshot, cut = 99, reliefScale = 1): BlockFrame => {
  const g = toBlockGrid(s);
  const r = elevationRange(g);
  return {
    across: g.across,
    along: g.along,
    metresPerCell: g.metresPerCell,
    baseM: blockBaseM(r.minM, r.maxM),
    reliefScale,
    cutRow: clampCutRow(g, cut),
  };
};

describe("crust-base field on the snapshot seam", () => {
  it("is optional: without it the block grid and elevation range are exactly as before", () => {
    const g = toBlockGrid(snapshot(false));
    expect("crustBaseM" in g).toBe(false);
    expect(elevationRange(g)).toEqual({ minM: 300, maxM: 2300 });
    expect(buildCrustSection(g, frameFor(snapshot(false)))).toBeNull();
    expect(drawnCrustBaseM(g, frameFor(snapshot(false)), 0)).toBeNull();
  });

  it("is validated, resampled into block order like the bed, and widens the elevation range", () => {
    const s = snapshot(true);
    expect(() => validateSnapshot({ ...s, crustBaseM: new Float32Array(4) })).toThrow(/crustBaseM/);
    const g = toBlockGrid(s);
    expect(g.crustBaseM).toBeInstanceOf(Float32Array);
    expect(g.crustBaseM![3 * 11 + 5]).toBe(s.crustBaseM![3 * 11 + 5]);
    // Rotated orientation moves the crust with the bed.
    const h = toBlockGrid(s, { valleyAxis: "columns", downstream: "increasing" });
    for (let k = 0; k < h.bedM.length; k++)
      if (h.crustBaseM![k]! < 1e4) expect(h.bedM[k]! - h.crustBaseM![k]!).toBeGreaterThanOrEqual(30_000 - 1);
    expect(elevationRange(g).minM).toBe(300 + 2000 - 30_000 - 12_000);
    const f = frameFor(s);
    expect(f.baseM).toBeLessThan(elevationRange(g).minM);
  });
});

describe("crust band geometry on the front face", () => {
  const s = snapshot(true);
  const g = toBlockGrid(s);

  it("spans the bed down to the crust base, with the mantle from there to the block's base", () => {
    const f = frameFor(s, 4, 2);
    const section = buildCrustSection(g, f)!;
    expect(section).not.toBeNull();
    const { crust, mantle } = section;
    expect(crust.position.length / 3).toBe(g.across * 2);
    expect(crust.index.length).toBe((g.across - 1) * 6);
    const z = blockZ(f, 4) + g.metresPerCell * 0.01;
    for (let a = 0; a < g.across; a++) {
      const k = 4 * g.across + a;
      const o = a * 6;
      expect(crust.position[o]).toBeCloseTo(blockX(f, a), 6);
      expect(crust.position[o + 2]).toBeCloseTo(z, 6);
      expect(crust.position[o + 1]).toBeCloseTo(blockY(f, g.bedM[k]!), 1);
      expect(crust.position[o + 4]).toBeCloseTo(blockY(f, g.crustBaseM![k]!), 1);
      // The mantle starts where the crust ends and reaches the base (y = 0).
      expect(mantle.position[o + 1]).toBeCloseTo(crust.position[o + 4]!, 6);
      expect(mantle.position[o + 4]).toBe(0);
      expect(mantle.normal[o + 2]).toBe(1);
    }
    // Wall-material attributes: block-local metres, no soil band.
    expect(crust.attributes.wallV![0]).toBeCloseTo(crust.position[1]!, 6);
    expect(crust.attributes.wallU![2]).toBeCloseTo(g.metresPerCell, 6);
    expect(crust.attributes.soilM!.every((v) => v === 0)).toBe(true);
    expect(crust.attributes.depthM!.every((v) => v > 1e8)).toBe(true);
    // The crust is thickest under the ridge: the root.
    const thickness = (a: number) => crust.position[a * 6 + 1]! - crust.position[a * 6 + 4]!;
    expect(thickness(5)).toBeGreaterThan(thickness(0));
    // The crust-base polyline follows the lower edge of the band.
    expect(section.basePolyline.length).toBe(g.across * 3);
    expect(section.basePolyline[5 * 3 + 2]).toBeCloseTo(crust.position[5 * 6 + 4]!, 6);
  });

  it("draws a crust base above the bed at the bed and never below the block's base", () => {
    const f = frameFor(s, 7);
    const k = 7 * g.across + 0;
    expect(drawnCrustBaseM(g, f, k)).toBe(g.bedM[k]);
    const low = { ...f, baseM: -20_000 };
    expect(drawnCrustBaseM(g, low, 3 * g.across + 5)).toBe(-20_000);
    const section = buildCrustSection(g, low)!;
    for (let i = 1; i < section.mantle.position.length; i += 3)
      expect(section.mantle.position[i]).toBeGreaterThanOrEqual(0);
  });

  it("follows the cut: moving the front face moves the band with it", () => {
    const near = buildCrustSection(g, frameFor(s, 3))!;
    const far = buildCrustSection(g, frameFor(s, 6))!;
    expect(far.crust.position[2]! - near.crust.position[2]!).toBeCloseTo(3 * g.metresPerCell, 3);
  });

  it("starting and comparison crust profiles follow the crust base; bed profiles are unchanged", () => {
    const f = frameFor(s, 4);
    const bedDashes = dashedProfile(g, f);
    expect(dashedProfile(g, f, 0.9, 0.7, g.bedM)).toEqual(bedDashes);
    const crustDashes = dashedProfile(g, f, 0.9, 0.7, g.crustBaseM);
    expect(crustDashes.length).toBe(bedDashes.length);
    expect(crustDashes[2]).toBeCloseTo(blockY(f, g.crustBaseM![4 * g.across]!), 3);
    const halo = solidProfile(g, f, 0.05, g.crustBaseM);
    expect(halo[2]).toBeCloseTo(blockY(f, g.crustBaseM![4 * g.across]!), 3);
    expect(solidProfile(g, f, 0.05, g.bedM)).toEqual(solidProfile(g, f, 0.05));
  });

  it("draws further comparison profiles in their own dash patterns", () => {
    const f = frameFor(s, 4);
    const dashDot = patternedProfile(g, f, [0.7, 0.3, 0.1, 0.3]);
    const dashDotDot = patternedProfile(g, f, [0.7, 0.25, 0.1, 0.25, 0.1, 0.25]);
    expect(dashDot.length % 6).toBe(0);
    expect(dashDot.length).not.toBe(dashDotDot.length);
    const z = blockZ(f, 4) + g.metresPerCell * 0.04;
    for (let i = 0; i < dashDot.length; i += 6) expect(dashDot[i + 1]).toBeCloseTo(z, 6);
    expect(() => patternedProfile(g, f, [0.5])).toThrow(RangeError);
    expect(() => patternedProfile(g, f, [0.5, 0])).toThrow(RangeError);
  });
});

describe("crust band look", () => {
  it("gives crust and mantle distinct, fixed patterns (the non-colour cue) and an identical SVG every time", () => {
    const crust = crustPatternMarks("crust");
    const mantle = crustPatternMarks("mantle");
    expect(crust.every((m) => m.kind === "line")).toBe(true);
    expect(mantle.every((m) => m.kind === "ring")).toBe(true);
    expect(crustPatternMarks("crust")).toEqual(crust);
    const svg = crustPatternSvg("crust", CRUST_BAND_LOOK.crust, "c1");
    expect(svg).toMatch(/^<pattern id="c1"/);
    expect(svg).toContain("<polyline");
    expect(crustPatternSvg("mantle", CRUST_BAND_LOOK.mantle, "m1")).toContain("<circle");
    expect(crustPatternSvg("crust", CRUST_BAND_LOOK.crust, "c1")).toBe(svg);
  });

  it("keeps a clear lightness step between crust and mantle", () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    };
    expect(ratio(CRUST_BAND_LOOK.crust.colour, CRUST_BAND_LOOK.mantle.colour)).toBeGreaterThan(1.4);
    // Marks read on their own fill.
    expect(ratio(CRUST_BAND_LOOK.crust.colour, CRUST_BAND_LOOK.crust.markColour)).toBeGreaterThan(3);
    expect(ratio(CRUST_BAND_LOOK.mantle.colour, CRUST_BAND_LOOK.mantle.markColour)).toBeGreaterThan(3);
  });

  it("paints a tile through a 2D-context surface", () => {
    const calls: string[] = [];
    const ctx = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      lineCap: "butt" as CanvasLineCap,
      lineJoin: "miter" as CanvasLineJoin,
      fillRect: () => calls.push("fillRect"),
      beginPath: () => calls.push("beginPath"),
      moveTo: () => calls.push("moveTo"),
      lineTo: () => calls.push("lineTo"),
      arc: () => calls.push("arc"),
      stroke: () => calls.push("stroke"),
    };
    paintCrustTile(ctx, "mantle", CRUST_BAND_LOOK.mantle, 64);
    expect(calls.filter((c) => c === "arc").length).toBe(crustPatternMarks("mantle").length);
    expect(ctx.fillStyle).toBe(CRUST_BAND_LOOK.mantle.colour);
  });
});
