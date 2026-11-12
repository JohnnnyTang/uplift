/**
 * Registered-horizon CPU/GPU comparison (session 5I), gated: GLACIER_GPU_FULL=1 pnpm --filter @hachure/glacier test:gpu
 *
 * Runs every compared protocol arm on the GPU to 300 model years and checks it against the CPU with the
 * tolerances declared beforehand in docs/review/glacial/gpu/tolerances.md (G1–G7). Seed-1 rock arms run a live
 * CPU in lockstep for full fields; the other arms use the committed 5G2 CPU records, which the live runs must
 * reproduce bitwise (finalHash). Writes results-local.json and the GPU arm records (runs/<arm>.json). Every
 * result is kept, including failures; a failed gate fails this suite.
 */
import { describe, expect, it } from "vitest";
import { createCpuGlacier } from "../../src/cpu/index";
import {
  type Check,
  type FieldDifference,
  GPU_GLACIER_TOLERANCES as TOL,
  borderlineVerdicts,
  checkRecord,
  createGpuGlacier,
  fieldDifference,
  fieldPass,
  speedField,
} from "../../src/gpu/index";
import { type ArmResult, type Verdict, evaluateProtocol } from "../../src/testing/evaluate";
import {
  PROTOCOL_ARMS,
  PROTOCOL_HORIZON_YEARS,
  PROTOCOL_MATCHED_YEARS,
  PROTOCOL_SECTIONS,
  PROTOCOL_SNAPSHOT_YEARS,
} from "../../src/testing/protocol";
import {
  CPU_RECORDS_DIR,
  adapterEvidence,
  advanceCpu,
  readJson,
  recordableCpu,
  recordableGpu,
  round,
  roundEntry,
  row,
  seriesEntry,
  writeEvidence,
} from "./harness";

/** Arms compared (tolerances.md "What is compared"): rock arms, the two controls and the half-step check. */
const COMPARED = PROTOCOL_ARMS.filter(
  (a) => a.kind === "rock" || a.id.startsWith("control-") || a.id === "check-half-step",
);
const MATCHED = new Set<number>([0, ...PROTOCOL_MATCHED_YEARS]);

interface CpuRecord extends ArmResult {
  readonly rows: Record<string, { initial: number[]; at: Record<string, { bed: number[]; ice: number[] }> }>;
}

const allPass = (r: Record<string, Check>) => Object.values(r).every((c) => c.pass);
const failures = (r: Record<string, Check>, prefix: string) =>
  Object.entries(r)
    .filter(([, c]) => !c.pass)
    .map(([k, c]) => `${prefix}${k}: gpu ${c.gpu} cpu ${c.cpu} |Δ| ${c.diff} > ${c.bound}`);

describe.runIf(__GLACIER_GPU_FULL__)("registered horizon: CPU and GPU agree (G1–G7)", () => {
  it("every compared arm, 300 model years", async (ctx) => {
    const cap = await adapterEvidence();
    const evidence: Record<string, unknown> = {
      scope:
        "Session 5I registered-horizon CPU/GPU comparison. Engineering evidence on this development machine (headless Chrome); speed figures are diagnostic, not classroom hardware.",
      tolerances: "docs/review/glacial/gpu/tolerances.md",
      ...cap,
    };
    if (!cap.available) {
      await writeEvidence("results-local.json", evidence);
      ctx.skip();
    }
    const cpuSummary = await readJson<{ verdicts: Verdict[] }>(`${CPU_RECORDS_DIR}/summary.json`);
    const gpuArms: Record<string, ArmResult> = {};
    const cpuArms: Record<string, ArmResult> = {};
    const problems: string[] = [];
    const arms: Record<string, unknown> = {};
    const gates = { G1: true, G3: true, G4: true, G5: true, G6: true, G7: true };
    const speed: Record<
      string,
      { gpuMsPerModelYear: number; cpuBrowserMsPerModelYear?: number; cpuNodeRecordMsPerModelYear: number }
    > = {};

    for (const arm of COMPARED) {
      const record = await readJson<CpuRecord>(`${CPU_RECORDS_DIR}/runs/${arm.id}.json`);
      cpuArms[arm.id] = record;
      const gpu = await createGpuGlacier(arm.overrides);
      const live = arm.kind === "rock" && arm.id.endsWith("-s1") ? createCpuGlacier(arm.overrides) : null;
      const c = gpu.config;
      const stepsPerSnapshot = Math.round(PROTOCOL_SNAPSHOT_YEARS / c.dtYears);
      const series: ReturnType<typeof roundEntry>[] = [];
      const rows: Record<string, { initial: (number | null)[]; at: Record<string, unknown> }> = {};
      const perSnapshot: unknown[] = [];
      let gpuMs = 0;
      let cpuMs = 0;
      try {
        const f0 = await gpu.fields();
        for (const [name, i] of Object.entries(PROTOCOL_SECTIONS))
          rows[name] = { initial: row(f0.initialBedM, c, i).map((x) => round(x, 2)), at: {} };
        for (let t = 0; t <= PROTOCOL_HORIZON_YEARS; t += PROTOCOL_SNAPSHOT_YEARS) {
          if (t > 0) {
            const t0 = performance.now();
            await gpu.advance(stepsPerSnapshot);
            gpuMs += performance.now() - t0;
            if (live) cpuMs += await advanceCpu(live, stepsPerSnapshot);
          }
          const g = await seriesEntry(recordableGpu(gpu));
          series.push(roundEntry(g));
          const gf = await gpu.fields();
          if (t % 100 === 0)
            for (const [name, i] of Object.entries(PROTOCOL_SECTIONS))
              rows[name]!.at[String(t)] = {
                bed: row(gf.bedM, c, i).map((x) => round(x, 2)),
                ice: row(gf.iceThicknessM, c, i).map((x) => round(x, 2)),
              };
          const closure =
            Math.abs(g.budget.residualM3) <=
            TOL.closureRel * (Math.abs(g.budget.surfaceMassBalanceM3) + Math.abs(g.budget.edgeOutflowM3)) +
              TOL.closureAbsM3;
          if (!closure) {
            gates.G4 = false;
            problems.push(`${arm.id} t${t}: GPU budget closure ${g.budget.residualM3} m³`);
          }
          // Reference at this time: the live CPU (every snapshot) or the record (start and matched times).
          let ref: Awaited<ReturnType<typeof seriesEntry>> | ArmResult["series"][number] | null = null;
          let fields: Record<string, FieldDifference> | null = null;
          let profiles: Record<string, number> | null = null;
          if (live) {
            ref = await seriesEntry(recordableCpu(live));
            const cs = live.snapshot();
            const gs = await gpu.snapshot();
            fields = {
              bedM: fieldDifference(gf.bedM, live.fields.bedM),
              iceThicknessM: fieldDifference(gf.iceThicknessM, live.fields.iceThicknessM),
              surfaceSpeedMPerYear: fieldDifference(
                speedField(gs.surfaceVelocityXMPerYear, gs.surfaceVelocityYMPerYear),
                speedField(cs.surfaceVelocityXMPerYear, cs.surfaceVelocityYMPerYear),
              ),
              shapeFactor: fieldDifference(gf.shapeFactor, live.fields.shapeFactor),
              slidingSpeedMPerYear: fieldDifference(
                gf.slidingSpeedMPerYear,
                live.fields.slidingSpeedMPerYear,
              ),
            };
            const early = t === TOL.earlyYears;
            for (const k of ["bedM", "iceThicknessM", "surfaceSpeedMPerYear"] as const) {
              if (!fieldPass(fields[k]!, TOL.fields[k])) {
                gates.G5 = false;
                problems.push(`${arm.id} t${t}: field ${k} ${JSON.stringify(fields[k])}`);
              }
              if (early && !fieldPass(fields[k]!, TOL.fields[k], TOL.earlyFactor)) {
                gates.G7 = false;
                problems.push(`${arm.id} t${t}: early field ${k} ${JSON.stringify(fields[k])}`);
              }
            }
            if (t > 0 && MATCHED.has(t)) {
              profiles = {};
              for (const [name, i] of Object.entries(PROTOCOL_SECTIONS)) {
                const a = row(gf.bedM, c, i);
                const b = row(live.fields.bedM, c, i);
                profiles[name] = Math.max(...a.map((x, j) => Math.abs(x - b[j]!)));
                if (profiles[name]! > TOL.sectionProfileM) {
                  gates.G6 = false;
                  problems.push(`${arm.id} t${t}: profile ${name} max |Δ| ${profiles[name]} m`);
                }
              }
            }
          } else if (MATCHED.has(t)) {
            ref = record.series.find((s) => Math.abs(s.modelYears - t) < 1e-6) ?? null;
            if (!ref) problems.push(`${arm.id} t${t}: no CPU record entry`);
          }
          if (ref) {
            const probes = checkRecord({ ...g.probes }, { ...ref.probes }, TOL.probes);
            const budget = checkRecord({ ...g.budget }, { ...ref.budget }, TOL.budget);
            if (!allPass(probes)) {
              gates.G3 = false;
              problems.push(...failures(probes, `${arm.id} t${t}: probe `));
            }
            if (!allPass(budget)) {
              gates.G4 = false;
              problems.push(...failures(budget, `${arm.id} t${t}: budget `));
            }
            const sections: Record<string, Record<string, Check>> = {};
            for (const name of Object.keys(PROTOCOL_SECTIONS)) {
              sections[name] = checkRecord(
                { ...g.sections[name]! },
                { ...(ref.sections[name] as unknown as Record<string, number>) },
                TOL.sections,
              );
              if (MATCHED.has(t) && !allPass(sections[name]!)) {
                gates.G1 = false;
                problems.push(...failures(sections[name]!, `${arm.id} t${t}: ${name}.`));
              }
            }
            perSnapshot.push({
              t,
              reference: live ? "live CPU" : "CPU record",
              fields,
              profiles,
              probes,
              budget,
              sections,
            });
          }
        }
        const finalHash = await gpu.hash();
        const msPerModelYear = gpuMs / PROTOCOL_HORIZON_YEARS;
        speed[arm.id] = {
          gpuMsPerModelYear: msPerModelYear,
          ...(live ? { cpuBrowserMsPerModelYear: cpuMs / PROTOCOL_HORIZON_YEARS } : {}),
          cpuNodeRecordMsPerModelYear: record.msPerModelYear,
        };
        let liveHash: string | null = null;
        if (live) {
          liveHash = live.hash();
          if (liveHash !== record.finalHash)
            problems.push(
              `${arm.id}: live CPU hash ${liveHash} does not reproduce the record ${record.finalHash}`,
            );
        }
        const gpuRecord = {
          backend: "webgpu",
          arm,
          config: c,
          grid: { nx: c.nx, ny: c.ny, metresPerCell: c.metresPerCell },
          sections: PROTOCOL_SECTIONS,
          adapter: cap.adapter,
          msPerModelYear: round(msPerModelYear, 2),
          finalHash,
          series,
          rows,
        };
        gpuArms[arm.id] = gpuRecord as unknown as ArmResult;
        await writeEvidence(`runs/${arm.id}.json`, gpuRecord);
        arms[arm.id] = {
          finalHash,
          cpuRecordHash: record.finalHash,
          liveCpuHash: liveHash,
          liveCpuReproducesRecord: live ? liveHash === record.finalHash : null,
          perSnapshot,
        };
      } finally {
        await gpu.dispose();
      }
    }

    // G2: verdict parity, with the borderline rule evaluated on the CPU records.
    const gpuEval = evaluateProtocol(gpuArms);
    const borderline = borderlineVerdicts(cpuArms);
    const verdicts = cpuSummary.verdicts.map((cv) => {
      const gv = gpuEval.verdicts.find((v) => v.id === cv.id);
      const same = gv !== undefined && gv.pass === cv.pass;
      return {
        id: cv.id,
        cpu: cv.pass,
        gpu: gv?.pass ?? null,
        same,
        borderline: borderline[cv.id] ?? false,
        gpuDetail: gv?.detail ?? "missing",
        cpuDetail: cv.detail,
      };
    });
    const g2 = verdicts.every((v) => v.same || v.borderline);
    for (const v of verdicts.filter((x) => !x.same))
      problems.push(`verdict ${v.id}: CPU ${v.cpu}, GPU ${v.gpu}${v.borderline ? " (borderline)" : ""}`);

    const defaultDt = Object.entries(speed).filter(([id]) => id !== "check-half-step");
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    const gpuMedian = median(defaultDt.map(([, s]) => s.gpuMsPerModelYear));
    const cpuBrowser = defaultDt.flatMap(([, s]) =>
      s.cpuBrowserMsPerModelYear ? [s.cpuBrowserMsPerModelYear] : [],
    );
    const cpuMedian = median(cpuBrowser);
    const gateResults = { ...gates, G2: g2 };
    const allGates = Object.values(gateResults).every(Boolean);
    Object.assign(evidence, {
      gates: gateResults,
      allGatesPass: allGates,
      speed: {
        perArm: speed,
        gpuMedianMsPerModelYear: gpuMedian,
        cpuBrowserMedianMsPerModelYear: cpuMedian,
        speedup: cpuMedian / gpuMedian,
        note: "GPU time = dispatch + GPU completion + the batch's 16-byte status read, per 20-year batch, after pipeline warm-up at creation; CPU = reference solver stepping in the same headless Chrome. Diagnostic for this machine only.",
      },
      recommendedDefault: allGates && cpuMedian / gpuMedian >= 2 ? "webgpu" : "cpu",
      verdicts,
      problems,
      arms,
    });
    await writeEvidence("results-local.json", evidence);
    expect(problems, problems.join("\n")).toEqual([]);
    expect(allGates).toBe(true);
  });
});
