/**
 * Regenerates the captured-run fixtures (gated; run after any model or protocol change):
 *
 *   GLACIER_REVIEW=1 pnpm vitest run hachure/glacier/src/testing/review/capture.review.test.ts
 *
 * One capture per rock: the registered reference config, seed 1, snapshots every
 * PROTOCOL_SNAPSHOT_YEARS up to PROTOCOL_HORIZON_YEARS. Writes `<rock>.json` and `<rock>.bin` into
 * src/testing/captured-runs/.
 */
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { it } from "vitest";
import { encodeCapturedRun } from "../../contract/capture";
import { ROCK_IDS } from "../../contract/rocks";
import type { GlacierProbes } from "../../contract/probes";
import type { GlacierSnapshot } from "../../contract/state";
import { createCpuGlacier } from "../../cpu/index";
import { DEFAULT_V_VALLEY } from "../../presets/index";
import { PROTOCOL_HORIZON_YEARS, PROTOCOL_SNAPSHOT_YEARS } from "../protocol";
import { CAPTURE_SEED, START_PRESET_ID } from "../captures";

const RUN = process.env.GLACIER_REVIEW === "1";
const OUT = resolve("hachure/glacier/src/testing/captured-runs");

it.runIf(RUN)(
  "write captured runs",
  () => {
    const rocks = (process.env.GLACIER_ROCKS ?? ROCK_IDS.join(",")).split(",") as (typeof ROCK_IDS)[number][];
    for (const rockId of rocks) {
      const g = createCpuGlacier({ rockId, seed: CAPTURE_SEED });
      const snaps: { snapshot: GlacierSnapshot; probes: GlacierProbes }[] = [];
      for (let t = 0; t <= PROTOCOL_HORIZON_YEARS + 1e-9; t += PROTOCOL_SNAPSHOT_YEARS) {
        if (t > 0) g.advanceYears(PROTOCOL_SNAPSHOT_YEARS);
        snaps.push({ snapshot: g.snapshot(), probes: g.probes() });
      }
      const { manifest, bytes, clampedValues } = encodeCapturedRun({
        config: g.config,
        start: { preset: START_PRESET_ID, options: { ...DEFAULT_V_VALLEY } },
        snapshots: snaps,
        snapshotIntervalYears: PROTOCOL_SNAPSHOT_YEARS,
        binFile: `${rockId}.bin`,
        finalStateHash: g.hash(),
      });
      if (clampedValues > 0) throw new Error(`${rockId}: ${clampedValues} values clamped by quantization`);
      writeFileSync(join(OUT, `${rockId}.bin`), bytes);
      writeFileSync(join(OUT, `${rockId}.json`), JSON.stringify(manifest, null, 1) + "\n");
      process.stderr.write(
        `${rockId}: ${snaps.length} snapshots, ${(bytes.length / 1e6).toFixed(2)} MB, hash ${manifest.finalStateHash}\n`,
      );
    }
  },
  3_600_000,
);
