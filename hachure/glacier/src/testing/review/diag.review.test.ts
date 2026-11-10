import { it } from "vitest";
import { createCpuGlacier } from "../../cpu/index";
import { DEFAULT_V_VALLEY, createVValleyBed } from "../../presets/index";
import { resolveGlacierConfig } from "../../contract/index";

const RUN = process.env.GLACIER_REVIEW === "1";
const log = (...a: unknown[]) => process.stderr.write(a.join(" ") + "\n");
it.runIf(RUN)(
  "diag",
  () => {
    const over = JSON.parse(process.env.GLACIER_OVERRIDES ?? "{}");
    const preset = { ...DEFAULT_V_VALLEY, ...JSON.parse(process.env.GLACIER_PRESET ?? "{}") };
    const g = createCpuGlacier(over, { bedM: createVValleyBed(resolveGlacierConfig(over), preset) });
    const c = g.config;
    const i = Number(process.env.GLACIER_I ?? 65);
    for (const y of (process.env.GLACIER_TIMES ?? "100,300").split(",").map(Number)) {
      g.advanceYears(y - g.modelYears);
      log(`--- t=${g.modelYears.toFixed(0)} section i=${i}`);
      const { bedM, iceThicknessM, shapeFactor, slidingSpeedMPerYear, initialBedM } = g.fields;
      for (let j = 30; j <= 66; j++) {
        const k = j * c.nx + i;
        if (iceThicknessM[k]! < 0.5 && Math.abs(j - 47.5) > 12) continue;
        log(
          `j${j} b=${bedM[k]!.toFixed(1)} dz=${(bedM[k]! - initialBedM[k]!).toFixed(1)} H=${iceThicknessM[k]!.toFixed(1)} f=${shapeFactor[k]!.toFixed(3)} ub=${slidingSpeedMPerYear[k]!.toFixed(1)}`,
        );
      }
    }
  },
  3_600_000,
);
