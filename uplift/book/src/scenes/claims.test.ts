import { describe, it, expect } from "vitest";
import { validateReaderSpread } from "@hachure/runtime";
import { contourSpread, waterSpread, GEOMETRY_CATALOGUE } from "./content";
import {
  extractContours,
  sampleSurface,
  createProjection,
  terrainFrameFromHeightfield,
  projectToViewport,
  contourPath,
  wetSampleMarks,
} from "@hachure/ink";
import {
  createContourHill,
  DISPLAY,
  createWaterInitial,
  WATER_CONFIG,
  SOURCE,
  RESPONSE_STEPS,
} from "./geometry";
import { createTerrainState, createCpuSolver, type TerrainPreset } from "@hachure/terrain";
import { writeFileSync } from "node:fs";
function preset(slope: number): TerrainPreset {
  return {
    id: `prepared-${slope}`,
    create: () => {
      const initial = createWaterInitial(slope),
        s = createTerrainState(initial.gridSize, initial.metresPerCell, initial.outlet);
      s.layers.bedrockM.set(initial.bedrockM);
      s.layers.hardness.set(initial.hardness);
      return s;
    },
  };
}
describe("playable claims", () => {
  it("validates all lesson text and geometry probes", () => {
    for (const spread of [contourSpread, waterSpread])
      expect(validateReaderSpread(spread, GEOMETRY_CATALOGUE)).toMatchObject({ ok: true });
  });
  it("selected isoline stays on the triangulated surface in every view", () => {
    const field = createContourHill(),
      before = field.heightsM.slice(),
      lines = extractContours(field, DISPLAY.contourIntervalM);
    const line = lines.lines.find((l) => l.levelM === 4)!;
    expect(line).toBeDefined();
    const projection = createProjection(
      terrainFrameFromHeightfield(field),
      { azimuthDeg: 0, elevationDeg: 48, zoom: 1.05 },
      { widthPx: 480, heightPx: 420 },
      DISPLAY.reliefScale,
    );
    for (const lift of [0, 0.5, 1]) {
      for (let i = 0; i < line.pointsM.length; i += 2)
        expect(
          Math.abs(sampleSurface(field, line.pointsM[i], line.pointsM[i + 1]) - line.levelM),
        ).toBeLessThan(1e-5);
      const [x, y] = projectToViewport(projection, line.pointsM[0], line.pointsM[1], line.levelM, lift);
      expect(contourPath(line, projection, lift).startsWith(`M${x},${y}`)).toBe(true);
    }
    expect(field.heightsM).toEqual(before);
  });
  it("source-only intervention changes wet extent across the preregistered prepared slopes", async () => {
    const outcomes = [];
    for (const slope of [0.03, 0.04, 0.05]) {
      const paired = [];
      for (const xM of [17, 47]) {
        const solver = createCpuSolver(WATER_CONFIG, preset(slope));
        await solver.applyTool({ ...SOURCE, at: { xM, yM: 9 } });
        solver.step(RESPONSE_STEPS);
        const snapshot = await solver.snapshot(),
          depth = snapshot.layers.waterM!;
        const field = {
          gridSize: snapshot.gridSize,
          metresPerCell: snapshot.metresPerCell,
          heightsM: snapshot.layers.bedrockM!,
        };
        const projection = createProjection(
          terrainFrameFromHeightfield(field),
          { azimuthDeg: 0, elevationDeg: 48, zoom: 1.05 },
          { widthPx: 480, heightPx: 420 },
          DISPLAY.reliefScale,
        );
        const { path: _, ...stats } = wetSampleMarks(field, depth, DISPLAY.wetThresholdM, projection, 1);
        void _;
        const mask = Array.from(depth, (v, i) => (v >= DISPLAY.wetThresholdM ? i : -1)).filter((i) => i >= 0);
        const result = {
          slope,
          config: solver.config,
          xM,
          ...stats,
          mask,
          hash: await solver.hash(),
          diagnostics: solver.diagnostics(),
          waterM3: Array.from(depth).reduce((a, v) => a + v * 4, 0),
          step: snapshot.step,
        };
        paired.push(result);
        const sameBefore = await solver.hash();
        await solver.applyTool({ ...SOURCE, at: { xM: 47, yM: 9 } });
        const preserved = await solver.snapshot();
        expect(preserved.layers.waterM).toEqual(depth);
        if (xM === 17) {
          solver.step(RESPONSE_STEPS);
          const moved = await solver.snapshot();
          outcomes.push({
            kind: "relocation",
            slope,
            step: moved.step,
            mask: Array.from(moved.layers.waterM!, (v, i) => (v >= DISPLAY.wetThresholdM ? i : -1)).filter(
              (i) => i >= 0,
            ),
            hash: await solver.hash(),
            diagnostics: solver.diagnostics(),
          });
        }
        expect(sameBefore).toBeTruthy();
        solver.dispose();
      }
      outcomes.push({ kind: "pair", slope, paired });
    }
    // Write every outcome before checking prospective directions. Only this explicit run updates evidence.
    if (process.env.PLAYABLE_SCIENCE_RECORD === "1")
      writeFileSync(
        "docs/science/validation/playable-book/results.json",
        JSON.stringify(
          {
            protocol: "aa3acda",
            config: WATER_CONFIG,
            display: DISPLAY,
            responseSteps: RESPONSE_STEPS,
            outcomes,
          },
          null,
          2,
        ) + "\n",
      );
    for (const outcome of outcomes)
      if (outcome.kind === "pair" && "paired" in outcome) {
        const [left, right] = outcome.paired!;
        expect(left.leftCells).toBeGreaterThan(left.rightCells);
        expect(right.rightCells).toBeGreaterThan(right.leftCells);
        expect(left.mask).not.toEqual(right.mask);
      }
  });
});
