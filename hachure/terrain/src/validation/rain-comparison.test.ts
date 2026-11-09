import { describe, expect, it } from "vitest";
import { extractRainComparison, type RainRun } from "./rain-comparison";
import data from "./rain-comparison-data.json";
import manifest from "../../../../docs/science/validation/rain-comparison/manifest.json";

const raw = import.meta.glob<string>(
  "../../../../docs/science/validation/followup/revised/seed-*-rain-*.json",
  { eager: true, query: "?raw", import: "default" },
);
const runs: RainRun[] = Object.values(raw).map((s) => JSON.parse(s));
const changed = (change: (run: RainRun) => RainRun) => runs.map((r, i) => (i === 0 ? change(r) : r));

describe("recorded rain teaching comparison", () => {
  it("binds the entire recorded cohort exactly and preserves provenance", async () => {
    expect(extractRainComparison(runs)).toEqual(data);
    for (const source of manifest.sources) {
      const text = Object.entries(raw).find(([path]) => path.endsWith(source.path))?.[1];
      expect(text).toBeDefined();
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text!));
      expect(Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")).toBe(
        source.sha256,
      );
    }
    expect(data.pairs.map((p) => p.seed)).toEqual([1, 17, 101]);
    expect(data.expertApproved).toBe(false);
  });
  it("rejects missing, duplicated, changed-intervention and unhealthy arms", () => {
    expect(() => extractRainComparison(runs.slice(1))).toThrow();
    expect(() => extractRainComparison([runs[1]!, ...runs.slice(1)])).toThrow();
    expect(() => extractRainComparison(changed((r) => ({ ...r, presetHash: "different" })))).toThrow();
    expect(() =>
      extractRainComparison(changed((r) => ({ ...r, config: { ...r.config, thermalRatePerS: 0 } }))),
    ).toThrow();
    expect(() => extractRainComparison(changed((r) => ({ ...r, samples: r.samples.slice(1) })))).toThrow();
    expect(() => extractRainComparison(changed((r) => ({ ...r, halted: "guard" })))).toThrow();
    expect(() =>
      extractRainComparison(
        changed((r) => ({
          ...r,
          samples: r.samples.map((s, i) => (i === 1 ? { ...s, closure: { ...s.closure, solidM3: 1e9 } } : s)),
        })),
      ),
    ).toThrow();
  });
  it("will not score a reversed or unresolved relationship", () => {
    const reversed = runs.map((r) =>
      r.arm === "rain-high"
        ? {
            ...r,
            samples: r.samples.map((s) => ({ ...s, budget: { ...s.budget, erodedM3: 0 } })),
          }
        : r,
    );
    expect(() => extractRainComparison(reversed)).toThrow("teaching answer");
  });
});
