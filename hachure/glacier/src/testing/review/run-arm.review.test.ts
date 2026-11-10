/**
 * Feasibility / acceptance arm runner (gated; not part of `pnpm test`).
 *
 *   GLACIER_REVIEW=1 GLACIER_ARMS=shale-s1,granite-s1 pnpm vitest run hachure/glacier/src/testing/review/run-arm.review.test.ts
 *
 * For each arm it writes docs/review/glacial/model/runs/<arm>.json (probes, budgets, diagnostics and
 * section measures every snapshot interval, plus section rows) and plan-view PNGs at the matched times.
 * Optional: GLACIER_OUT (output directory), GLACIER_YEARS (horizon override for exploration only).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { it } from "vitest";
import { createCpuGlacier } from "../../cpu/index";
import {
  PROTOCOL_ARMS,
  PROTOCOL_HORIZON_YEARS,
  PROTOCOL_MATCHED_YEARS,
  PROTOCOL_SECTIONS,
  PROTOCOL_SNAPSHOT_YEARS,
  findArm,
} from "../protocol";
import { planPng } from "./figures";

const RUN = process.env.GLACIER_REVIEW === "1";
const OUT = resolve(process.env.GLACIER_OUT ?? "docs/review/glacial/model/runs");
const log = (...a: unknown[]) => process.stderr.write(a.join(" ") + "\n");

const round = (x: number, d = 3) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null);
const roundObj = (o: object) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "number" ? round(v) : v]));

it.runIf(RUN)(
  "run protocol arms",
  () => {
    const ids = (process.env.GLACIER_ARMS ?? "").split(",").filter(Boolean);
    const arms = ids.length ? ids.map(findArm) : PROTOCOL_ARMS;
    const horizon = Number(process.env.GLACIER_YEARS ?? PROTOCOL_HORIZON_YEARS);
    mkdirSync(OUT, { recursive: true });
    for (const arm of arms) {
      const g = createCpuGlacier(arm.overrides);
      const c = g.config;
      const grid = { nx: c.nx, ny: c.ny, metresPerCell: c.metresPerCell };
      const row = (field: ArrayLike<number>, i: number) =>
        Array.from({ length: c.ny }, (_, j) => round(field[j * c.nx + i]!, 2));
      const series: unknown[] = [];
      const rows: Record<string, { initial: unknown; at: Record<string, unknown> }> = {};
      for (const [name, i] of Object.entries(PROTOCOL_SECTIONS))
        rows[name] = { initial: row(g.fields.initialBedM, i), at: {} };
      let ms = 0;
      for (let t = 0; t <= horizon + 1e-9; t += PROTOCOL_SNAPSHOT_YEARS) {
        if (t > 0) {
          const t0 = performance.now();
          g.advanceYears(PROTOCOL_SNAPSHOT_YEARS);
          ms += performance.now() - t0;
        }
        const erodedAreaM2 = (i: number) => {
          let a = 0;
          for (let j = 0; j < c.ny; j++)
            a += g.fields.initialBedM[j * c.nx + i]! - g.fields.bedM[j * c.nx + i]!;
          return a * c.metresPerCell;
        };
        const sections = Object.fromEntries(
          Object.entries(PROTOCOL_SECTIONS).map(([name, i]) => [
            name,
            roundObj({ ...g.section(i), erodedAreaM2: erodedAreaM2(i) }),
          ]),
        );
        series.push({
          modelYears: round(g.modelYears),
          probes: roundObj(g.probes()),
          budget: roundObj(g.budget()),
          diagnostics: g.diagnostics(),
          sections,
        });
        const tYears = Math.round(g.modelYears);
        if (
          (PROTOCOL_MATCHED_YEARS as readonly number[]).includes(tYears) ||
          tYears === 0 ||
          tYears % 100 === 0
        ) {
          for (const [name, i] of Object.entries(PROTOCOL_SECTIONS)) {
            rows[name]!.at[String(tYears)] = {
              bed: row(g.fields.bedM, i),
              ice: row(g.fields.iceThicknessM, i),
            };
          }
        }
        if (tYears === 0 || (PROTOCOL_MATCHED_YEARS as readonly number[]).includes(tYears)) {
          const s = g.snapshot();
          writeFileSync(
            join(OUT, `${arm.id}-t${String(tYears).padStart(3, "0")}.png`),
            planPng({
              ...grid,
              bedM: s.bedM,
              iceThicknessM: s.iceThicknessM,
              initialBedM: g.fields.initialBedM,
            }),
          );
        }
      }
      const msPerYear = ms / horizon;
      writeFileSync(
        join(OUT, `${arm.id}.json`),
        JSON.stringify({
          arm,
          config: c,
          grid,
          sections: PROTOCOL_SECTIONS,
          msPerModelYear: round(msPerYear, 1),
          finalHash: g.hash(),
          series,
          rows,
        }) + "\n",
      );
      const last = series[series.length - 1] as { sections: Record<string, Record<string, number>> };
      const u = last.sections.underIce!;
      log(
        `${arm.id}: ${msPerYear.toFixed(1)} ms/yr | underIce depth ${u.depthM} floorW ${u.floorWidthM} b ${u.shapeExponent} wall ${u.wallSlopeDeg} | belowSnout floorW ${last.sections.belowSnout!.floorWidthM}`,
      );
    }
  },
  24 * 3_600_000,
);
