import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { planPng } from "./figures";
import { createCpuGlacier } from "../../cpu/index";
import { DEFAULT_V_VALLEY, createVValleyBed, maxCellSlopeDeg } from "../../presets/index";
import { resolveGlacierConfig } from "../../contract/index";

const RUN = process.env.GLACIER_REVIEW === "1";
const log = (...a: unknown[]) => process.stderr.write(a.join(" ") + "\n");
it.runIf(RUN)(
  "explore",
  () => {
    const over = JSON.parse(process.env.GLACIER_OVERRIDES ?? "{}");
    const preset = { ...DEFAULT_V_VALLEY, ...JSON.parse(process.env.GLACIER_PRESET ?? "{}") };
    const g = createCpuGlacier(over, { bedM: createVValleyBed(resolveGlacierConfig(over), preset) });
    const c = g.config;
    log("start max slope", maxCellSlopeDeg(g.fields.bedM, c.nx, c.ny, c.metresPerCell).toFixed(1));
    const years = Number(process.env.GLACIER_YEARS ?? 400);
    const every = Number(process.env.GLACIER_EVERY ?? 50);
    const secs = (process.env.GLACIER_SECTIONS ?? "30,60,90").split(",").map(Number);
    const t0 = performance.now();
    let pc = 0,
      pe = 0;
    for (let y = 0; y <= years; y += every) {
      if (y > 0) g.advanceYears(every);
      const p = g.probes();
      const d = g.diagnostics();
      const b = g.budget();
      const line = secs
        .map((i) => {
          const s = g.section(i);
          return `i${i}: H${s.maxIceThicknessM.toFixed(0)} d${s.depthM.toFixed(0)} fw${s.floorWidthM.toFixed(0)} hw${s.halfDepthWidthM.toFixed(0)} b${s.shapeExponent.toFixed(2)} ws${s.wallSlopeDeg.toFixed(0)}`;
        })
        .join(" | ");
      log(
        `t=${p.modelYears.toFixed(0)} V=${(p.iceVolumeM3 / 1e9).toFixed(3)}km3 snout=${p.snoutXM} ub=${p.maxSlidingSpeedMPerYear.toFixed(0)} us=${p.maxSurfaceSpeedMPerYear.toFixed(0)} er=${(p.erodedVolumeM3 / 1e6).toFixed(1)}Mm3 cap=${(((d.cappedEdgeSteps - pc) / Math.max(1, d.iceEdgeSteps - pe)) * 100).toFixed(2)}% lim=${d.limitedCellSteps} res=${b.residualM3.toExponential(2)} || ${line}`,
      );
      pc = d.cappedEdgeSteps;
      pe = d.iceEdgeSteps;
    }
    if (process.env.GLACIER_PNG)
      writeFileSync(
        process.env.GLACIER_PNG,
        planPng({
          nx: c.nx,
          ny: c.ny,
          metresPerCell: c.metresPerCell,
          bedM: g.fields.bedM,
          iceThicknessM: g.fields.iceThicknessM,
          initialBedM: g.fields.initialBedM,
        }),
      );
    log("ms per model year", ((performance.now() - t0) / years).toFixed(1));
  },
  3_600_000,
);
