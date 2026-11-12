/**
 * Grid-scale (2Δx) check along the valley (gated). Prints, per column, the floor elevation, floor width and
 * axis fields of one run, and the odd/even ("checkerboard") share of the along-valley floor profile.
 *
 *   GLACIER_REVIEW=1 GLACIER_OVERRIDES='{"rockId":"shale"}' GLACIER_TIMES=100,200 pnpm vitest run hachure/glacier/src/testing/review/ripple.review.test.ts
 */
import { it } from "vitest";
import { createCpuGlacier } from "../../cpu/index";
import { DEFAULT_V_VALLEY, createVValleyBed } from "../../presets/index";
import { resolveGlacierConfig } from "../../contract/index";
import { measureSection } from "../../contract/probes";
import { alongValleyGridScaleShare, gridScaleShare } from "../ripple";

const RUN = process.env.GLACIER_REVIEW === "1";
const log = (...a: unknown[]) => process.stderr.write(a.join(" ") + "\n");
it.runIf(RUN)(
  "ripple",
  () => {
    const over = JSON.parse(process.env.GLACIER_OVERRIDES ?? "{}");
    const preset = { ...DEFAULT_V_VALLEY, ...JSON.parse(process.env.GLACIER_PRESET ?? "{}") };
    const g = createCpuGlacier(over, { bedM: createVValleyBed(resolveGlacierConfig(over), preset) });
    const c = g.config;
    const grid = { nx: c.nx, ny: c.ny, metresPerCell: c.metresPerCell };
    const verbose = process.env.GLACIER_VERBOSE === "1";
    for (const y of (process.env.GLACIER_TIMES ?? "100,200").split(",").map(Number)) {
      g.advanceYears(y - g.modelYears);
      const { bedM, iceThicknessM, shapeFactor, slidingSpeedMPerYear } = g.fields;
      const fl: number[] = [];
      const fw: number[] = [];
      for (let i = 0; i < c.nx; i++) {
        const s = measureSection(bedM, iceThicknessM, grid, i);
        fl.push(s.floorElevationM);
        fw.push(s.floorWidthM);
        const k = Math.round((c.ny - 1) / 2) * c.nx + i;
        if (verbose && i >= 40)
          log(
            `t${y} i${i} floor ${s.floorElevationM.toFixed(1)} fw ${s.floorWidthM.toFixed(0)} H ${iceThicknessM[k]!.toFixed(0)} f ${shapeFactor[k]!.toFixed(3)} ub ${slidingSpeedMPerYear[k]!.toFixed(1)}`,
          );
      }
      log(
        `t=${y} odd/even share: floor elevation ${gridScaleShare(fl, 40, c.nx - 4).toFixed(3)}, floor width ${gridScaleShare(fw, 40, c.nx - 4).toFixed(3)}, bed lowering along the valley ${alongValleyGridScaleShare(
          Float64Array.from(bedM, (z, k) => g.fields.initialBedM[k]! - z),
          c.nx,
          3,
          c.ny - 3,
          40,
          c.nx - 4,
        ).toFixed(3)}`,
      );
    }
  },
  3_600_000,
);
