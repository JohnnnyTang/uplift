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
    {
      const b0 = g.fields.bedM;
      let best = 0;
      let at = "";
      for (let j = 0; j < c.ny; j++)
        for (let i = 0; i < c.nx; i++) {
          const k = j * c.nx + i;
          for (const [d, o] of [
            [1, i + 1 < c.nx],
            [c.nx, j + 1 < c.ny],
          ] as const) {
            if (!o) continue;
            const sl = Math.abs(b0[k + d]! - b0[k]!);
            if (sl > best) {
              best = sl;
              at = `i${i} j${j} z${b0[k]!.toFixed(0)}`;
            }
          }
        }
      log("steepest start step at", at);
    }
    const years = Number(process.env.GLACIER_YEARS ?? 400);
    const every = Number(process.env.GLACIER_EVERY ?? 50);
    const secs = (process.env.GLACIER_SECTIONS ?? "30,60,90").split(",").map(Number);
    const png = (path: string) =>
      writeFileSync(
        path,
        planPng({
          nx: c.nx,
          ny: c.ny,
          metresPerCell: c.metresPerCell,
          bedM: g.fields.bedM,
          iceThicknessM: g.fields.iceThicknessM,
          initialBedM: g.fields.initialBedM,
        }),
      );
    if (process.env.GLACIER_PNG) png(process.env.GLACIER_PNG.replace(/.png$/, "-t0.png"));
    const t0 = performance.now();
    let pc = 0,
      pe = 0;
    const s0 = new Map(secs.map((i) => [i, g.section(i)]));
    for (let y = 0; y <= years; y += every) {
      if (y > 0) g.advanceYears(every);
      if (process.env.GLACIER_PNG && y > 0 && y % 100 === 0)
        png(process.env.GLACIER_PNG.replace(/.png$/, `-t${y}.png`));
      const p = g.probes();
      const d = g.diagnostics();
      const b = g.budget();
      const line = secs
        .map((i) => {
          const s = g.section(i);
          const f0 = s0.get(i)!;
          return `i${i}: H${s.maxIceThicknessM.toFixed(0)} d${s.depthM.toFixed(0)} fw${s.floorWidthM.toFixed(0)} hw${s.halfDepthWidthM.toFixed(0)} b${s.shapeExponent.toFixed(2)} ws${s.wallSlopeDeg.toFixed(0)}/${s.maxWallSlopeDeg.toFixed(0)} lo${(f0.floorElevationM - s.floorElevationM).toFixed(0)}`;
        })
        .join(" | ");
      log(
        `t=${p.modelYears.toFixed(0)} V=${(p.iceVolumeM3 / 1e9).toFixed(3)}km3 snout=${p.snoutXM} ub=${p.maxSlidingSpeedMPerYear.toFixed(0)} us=${p.maxSurfaceSpeedMPerYear.toFixed(0)} er=${(p.erodedVolumeM3 / 1e6).toFixed(1)}Mm3 cap=${(((d.cappedEdgeSteps - pc) / Math.max(1, d.iceEdgeSteps - pe)) * 100).toFixed(2)}% lim=${d.limitedCellSteps} out=${(b.edgeOutflowM3 / 1e9).toFixed(3)}km3 || ${line}`,
      );
      pc = d.cappedEdgeSteps;
      pe = d.iceEdgeSteps;
    }
    if (process.env.GLACIER_PNG) png(process.env.GLACIER_PNG);
    log("ms per model year", ((performance.now() - t0) / years).toFixed(1));
  },
  3_600_000,
);
