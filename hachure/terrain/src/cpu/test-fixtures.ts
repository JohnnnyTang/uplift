/**
 * TEST FIXTURES for the CPU solver's own tests. Not exported from the package.
 *
 * `catchmentFixture` is the validation-spec common-protocol tilted catchment
 * (`docs/science/validation-spec.md`, "Common protocol"), built here only because 2B's seeded RNG and
 * `tilted-plateau` preset are not on main yet. 3B must use 2B's typed preset instead of this file.
 * The flat and slab fixtures are numerical test geometries, not landscapes.
 */
import {
  type Cell,
  type TerrainPreset,
  type TerrainState,
  cellIndex,
  createTerrainState,
} from "../contract/index";

/** Deterministic integer hash of (seed, index) to [0, 1). Test-local; no `Math.random()`. */
export function unitHash(seed: number, index: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(index + 1, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 0x1_0000_0000;
}

export interface CatchmentOptions {
  /** Downslope angle (unit: degrees). validation-spec uses 5. */
  readonly slopeDeg?: number;
  /** Initial loose sediment thickness (unit: m). */
  readonly looseM?: number;
  /** Uniform initial hardness (unit: none). */
  readonly hardness?: number;
  /** Rows given `bandHardness` (inclusive range), for hard-band tests. */
  readonly band?: { readonly fromRow: number; readonly toRow: number; readonly hardness: number };
}

/**
 * `z = 150 + (L − y) tan(slope) + 0.0002 (x − L/2)²` at cell centres, loose layer on top, bedrock below,
 * seeded zero-mean bedrock perturbation bounded by 0.01 m, outlet at the centre of the south edge.
 */
export function catchmentFixture(options: CatchmentOptions = {}): TerrainPreset {
  const slopeDeg = options.slopeDeg ?? 5;
  const looseM = options.looseM ?? 1;
  const hardness = options.hardness ?? 0.2;
  return {
    id: "test-catchment",
    create({ gridSize: n, metresPerCell: l, seed }): TerrainState {
      const outlet: Cell = { x: Math.floor(n / 2), y: n - 1 };
      const state = createTerrainState(n, l, outlet);
      const L = n * l;
      const tanSlope = Math.tan((slopeDeg * Math.PI) / 180);
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const i = cellIndex(n, x, y);
          const xm = (x + 0.5) * l;
          const ym = (y + 0.5) * l;
          const z = 150 + (L - ym) * tanSlope + 0.0002 * (xm - L / 2) ** 2;
          const noise = (2 * unitHash(seed, i) - 1) * 0.01;
          state.layers.sedimentM[i] = looseM;
          state.layers.bedrockM[i] = z - looseM + noise;
          const inBand = options.band && y >= options.band.fromRow && y <= options.band.toRow;
          state.layers.hardness[i] = inBand ? options.band!.hardness : hardness;
        }
      }
      return state;
    },
  };
}

/** Builds a preset from a per-cell initialiser. */
export function customFixture(
  id: string,
  outlet: (n: number) => Cell,
  init: (state: TerrainState, x: number, y: number, i: number) => void,
): TerrainPreset {
  return {
    id,
    create({ gridSize: n, metresPerCell: l }) {
      const state = createTerrainState(n, l, outlet(n));
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) init(state, x, y, cellIndex(n, x, y));
      return state;
    },
  };
}

/** South-centre outlet. */
export const southCentre = (n: number): Cell => ({ x: Math.floor(n / 2), y: n - 1 });
