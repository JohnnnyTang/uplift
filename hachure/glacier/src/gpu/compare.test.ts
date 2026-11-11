/** Comparison measures, the borderline rule and the shader generator (session 5I; Node). */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_GLACIER_CONFIG, resolveGlacierConfig } from "../contract/config";
import type { ArmResult } from "../testing/evaluate";
import { GPU_GLACIER_TOLERANCES, borderlineVerdicts, check, fieldDifference, isBorderline } from "./compare";
import { KERNELS, ENTRY_POINTS, glacierConstants, glacierWgsl } from "./shaders";

const repo = new URL("../../../../", import.meta.url);

describe("comparison measures", () => {
  it("check uses max(abs, rel·|cpu|) and treats one-sided NaN as a failure", () => {
    expect(check(102, 100, { rel: 0.01, abs: 1 })).toMatchObject({ diff: 2, bound: 1, pass: false });
    expect(check(100.5, 100, { rel: 0.01, abs: 1 })).toMatchObject({ pass: true });
    expect(check(Number.NaN, Number.NaN, { abs: 1 }).pass).toBe(true);
    expect(check(Number.NaN, 1, { abs: 1 }).pass).toBe(false);
  });

  it("fieldDifference reports RMS, 99th percentile and the worst cell", () => {
    const cpu = new Float64Array(200);
    const gpu = new Float64Array(200);
    gpu[7] = 3;
    gpu[8] = 1;
    gpu[9] = 1;
    const d = fieldDifference(gpu, cpu);
    expect(d.max).toBe(3);
    expect(d.maxIndex).toBe(7);
    expect(d.p99).toBe(1); // 2 cells of 200 are ≥ the 99th percentile
    expect(d.rms).toBeCloseTo(Math.sqrt(11 / 200), 12);
  });

  it("isBorderline: a pass flips if any input is inside its band; a fail only if every failing input is", () => {
    expect(
      isBorderline([
        { margin: 5, band: 1 },
        { margin: 0.5, band: 1 },
      ]),
    ).toBe(true);
    expect(
      isBorderline([
        { margin: 5, band: 1 },
        { margin: 2, band: 1 },
      ]),
    ).toBe(false);
    expect(
      isBorderline([
        { margin: -0.5, band: 1 },
        { margin: 5, band: 1 },
      ]),
    ).toBe(true);
    expect(
      isBorderline([
        { margin: -0.5, band: 1 },
        { margin: -3, band: 1 },
      ]),
    ).toBe(false);
    expect(isBorderline([{ margin: -0.1, band: 0 }])).toBe(false);
  });

  it("declares the tolerances registered in tolerances.md", () => {
    const doc = readFileSync(fileURLToPath(new URL("docs/review/glacial/gpu/tolerances.md", repo)), "utf8");
    const T = GPU_GLACIER_TOLERANCES;
    expect(T.sections.floorWidthM.abs).toBe(2.5);
    expect(T.sections.maxWallSlopeDeg.abs).toBe(1);
    expect(T.sections.shapeExponent.abs).toBe(0.1);
    expect(T.fields.bedM).toEqual({ rms: 0.5, p99: 2.5 });
    expect(T.earlyFactor).toBe(0.1);
    for (const [name, bound] of [
      ["floorWidthM", "2.5 m"],
      ["shapeExponent", "0.1"],
      ["erodedVolumeM3", "rel 2.5 % (or 1e5 m³)"],
    ])
      expect(doc.replace(/ +/g, " ")).toContain(`| ${name} | ${bound} |`);
  });

  it("finds the registered CPU verdicts that sit within the declared bands of their thresholds", () => {
    const dir = new URL("docs/review/glacial/model/runs/", repo);
    const arms: Record<string, ArmResult> = {};
    for (const file of readdirSync(fileURLToPath(dir)).filter((f) => f.endsWith(".json"))) {
      const arm = JSON.parse(readFileSync(fileURLToPath(new URL(file, dir)), "utf8")) as ArmResult;
      arms[arm.arm.id] = arm;
    }
    const b = borderlineVerdicts(arms);
    // T1 sandstone seed 1 passes with b +0.21 against +0.2 (inside the 0.1 band): borderline.
    expect(b["T1-sandstone-s1"]).toBe(true);
    // Granite fails T1 only on lowering (18 m against 30 m, far outside 2.5 m): not borderline.
    expect(b["T1-granite-s1"]).toBe(false);
    // R1 passes by 4000 m² steps: not borderline.
    expect(b["R1-rate"]).toBe(false);
    expect(b["K1-no-ice"]).toBe(false);
  });
});

describe("shader generator", () => {
  const config = resolveGlacierConfig({ rockId: "granite" });

  it("bakes Float64-derived constants as float32 literals and declares every kernel", () => {
    const code = glacierWgsl(config, 1000);
    const c = glacierConstants(config, 1000);
    expect(code).toContain(`const NX: u32 = ${DEFAULT_GLACIER_CONFIG.nx}u;`);
    expect(code).toContain(`const C_DEF: f32 = ${c.cDef.toExponential(16)}f;`);
    expect(code).toContain(`const ELA_REL: f32 = ${(config.snowlineAltitudeM - 1000).toExponential(16)}f;`);
    for (const k of KERNELS) expect(code).toContain(`fn ${ENTRY_POINTS[k]}(`);
    expect(code).not.toContain("this is not WGSL");
    expect(glacierWgsl(config, 1000, { invalid: true })).toContain("this is not WGSL");
  });

  it("derives constants exactly as the CPU solver does", () => {
    const c = glacierConstants(config, 0);
    expect(c.erosionPerStep).toBe(120 * 0.01 * 0.4 * 0.0025);
    expect(c.failFraction).toBe(Math.min(0.2, 5 * 0.0025));
    expect(c.limitAxis).toBe(Math.tan((55 * Math.PI) / 180) * 40);
    expect(c.dCap).toBe((0.2 * 40 * 40) / 0.0025);
  });

  it("switches the mass balance and erosion code with the config", () => {
    expect(glacierWgsl(resolveGlacierConfig({ massBalanceAltitude: "ice-surface" }), 0)).toContain(
      "ELA_REL), ACC_MAX)",
    );
    expect(glacierWgsl(resolveGlacierConfig({ erosionEnabled: false }), 0)).not.toContain(
      "EROSION_PER_STEP *",
    );
    expect(glacierWgsl(resolveGlacierConfig({ slidingStressExponent: 2.5 }), 0)).toContain("pow(r, 2.5");
  });
});
