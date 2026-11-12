/**
 * The parity record that drives "auto" selection must agree with the committed comparison evidence
 * (docs/review/glacial/gpu/results-local.json), so the GPU cannot be enabled without a passing record.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GLACIER_GPU_PARITY } from "./parity";

const results = fileURLToPath(
  new URL("../../../../docs/review/glacial/gpu/results-local.json", import.meta.url),
);

describe("recorded GPU parity", () => {
  it("auto may select the GPU only with a passing, committed comparison", () => {
    if (GLACIER_GPU_PARITY.autoSelectsGpu || GLACIER_GPU_PARITY.recommendedDefault === "webgpu") {
      expect(GLACIER_GPU_PARITY.status).toBe("passed");
    }
    if (GLACIER_GPU_PARITY.status === "pending") return;
    expect(existsSync(results)).toBe(true);
    const evidence = JSON.parse(readFileSync(results, "utf8")) as {
      allGatesPass: boolean;
      recommendedDefault: string;
      capability: string;
    };
    expect(evidence.capability).toBe("available");
    expect(evidence.allGatesPass).toBe(GLACIER_GPU_PARITY.status === "passed");
    expect(evidence.recommendedDefault).toBe(GLACIER_GPU_PARITY.recommendedDefault);
  });
});
