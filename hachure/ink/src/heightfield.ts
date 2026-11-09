/**
 * Heightfield: the one surface every ink layer is drawn from (mesh, contours, hachures, flat SVG).
 *
 * Samples sit at cell centres, following the terrain grid convention (`@hachure/terrain`, `state.ts`):
 * sample `(x, y)` is at `((x + ½)·m, (y + ½)·m)` metres from the north-west corner, `x` east, `y` south.
 * Between samples the surface is the piecewise-linear triangulation defined in `topology.ts`.
 */
import type { StateSnapshot } from "@hachure/terrain";

export interface Heightfield {
  /** Samples per side (unit: cells). */
  readonly gridSize: number;
  /** Spacing between samples (unit: metres). */
  readonly metresPerCell: number;
  /** Ground surface elevation per sample, row-major (unit: metres). */
  readonly heightsM: Float32Array;
}

/** The snapshot layers the ink view reads. Hosts can pass these to `snapshot({ layers })`. */
export const INK_HEIGHT_LAYERS = ["bedrockM", "sedimentM"] as const;

/**
 * Ground surface (bedrock + loose sediment) from a solver snapshot. Writes into `out` when it is given and
 * the right length, so a host can reuse one buffer across frames.
 */
export function heightfieldFromSnapshot(
  snapshot: Pick<StateSnapshot, "gridSize" | "metresPerCell" | "layers">,
  out?: Float32Array,
): Heightfield {
  const { gridSize, metresPerCell, layers } = snapshot;
  const bedrock = layers.bedrockM;
  const sediment = layers.sedimentM;
  if (!bedrock || !sediment) {
    throw new Error("heightfieldFromSnapshot needs the bedrockM and sedimentM layers");
  }
  const cells = gridSize * gridSize;
  if (bedrock.length !== cells || sediment.length !== cells) {
    throw new RangeError(`layer length does not match gridSize ${gridSize}`);
  }
  const heightsM = out && out.length === cells ? out : new Float32Array(cells);
  for (let i = 0; i < cells; i++) heightsM[i] = bedrock[i]! + sediment[i]!;
  return { gridSize, metresPerCell, heightsM };
}

/** Builds a heightfield by evaluating `heightAt(xM, yM)` at every sample. Handy for tests and fixtures. */
export function heightfieldFromFunction(
  gridSize: number,
  metresPerCell: number,
  heightAt: (xM: number, yM: number) => number,
): Heightfield {
  const heightsM = new Float32Array(gridSize * gridSize);
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      heightsM[y * gridSize + x] = heightAt((x + 0.5) * metresPerCell, (y + 0.5) * metresPerCell);
    }
  }
  return { gridSize, metresPerCell, heightsM };
}

/** Minimum and maximum height (unit: metres). */
export function heightRange(heightfield: Heightfield): { minM: number; maxM: number } {
  let minM = Infinity;
  let maxM = -Infinity;
  for (const h of heightfield.heightsM) {
    if (h < minM) minM = h;
    if (h > maxM) maxM = h;
  }
  return { minM, maxM };
}
