import { it } from "vitest";
import { createCpuGlacier } from "../../cpu/index";
it.runIf(process.env.GLACIER_REVIEW === "1")(
  "dt convergence",
  () => {
    const over = JSON.parse(process.env.GLACIER_OVERRIDES ?? "{}");
    const g = createCpuGlacier(over);
    const t0 = performance.now();
    g.advanceYears(Number(process.env.GLACIER_YEARS ?? 100));
    const ms = performance.now() - t0;
    const d = g.diagnostics();
    const s = g.section(74);
    process.stderr.write(
      `dt=${g.config.dtYears} S=${g.config.erosionSpeedup}: cap ${((d.cappedEdgeSteps / d.iceEdgeSteps) * 100).toFixed(2)}% eroded ${(g.probes().erodedVolumeM3 / 1e6).toFixed(2)} Mm3 ice ${(g.probes().iceVolumeM3 / 1e6).toFixed(0)} Mm3 ub ${g.probes().maxSlidingSpeedMPerYear.toFixed(0)} | fw ${s.floorWidthM.toFixed(0)} b ${s.shapeExponent.toFixed(2)} wall ${s.maxWallSlopeDeg.toFixed(1)} floor ${s.floorElevationM.toFixed(1)} | ${(ms / Number(process.env.GLACIER_YEARS ?? 100)).toFixed(0)} ms/yr\n`,
    );
  },
  3_600_000,
);
