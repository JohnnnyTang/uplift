import { createFakeSolver } from "@hachure/terrain/testing";
import { describe, expect, it } from "vitest";
import { heightRange, heightfieldFromSnapshot } from "./heightfield";

describe("heightfieldFromSnapshot", () => {
  it("is bedrock plus loose sediment, reusing the output buffer when it fits", async () => {
    const solver = createFakeSolver({ gridSize: 16 });
    solver.step(10);
    const snapshot = await solver.snapshot();
    const layers = { ...snapshot.layers, sedimentM: snapshot.layers.sedimentM!.map(() => 0.25) };
    const out = new Float32Array(16 * 16);
    const hf = heightfieldFromSnapshot({ ...snapshot, layers }, out);
    expect(hf.heightsM).toBe(out);
    expect(hf.heightsM[5]).toBeCloseTo(snapshot.layers.bedrockM![5]! + 0.25, 5);
    expect(hf.gridSize).toBe(16);
    const { minM, maxM } = heightRange(hf);
    expect(maxM).toBeGreaterThan(minM);
    solver.dispose();
  });

  it("refuses a snapshot without the height layers", async () => {
    const solver = createFakeSolver({ gridSize: 8 });
    const snapshot = await solver.snapshot({ layers: ["waterM"] });
    expect(() => heightfieldFromSnapshot(snapshot)).toThrow(/bedrockM/);
    solver.dispose();
  });
});
