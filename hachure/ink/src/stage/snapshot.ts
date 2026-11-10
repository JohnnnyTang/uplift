/**
 * The data seam between a landscape model and the book stage: a gridded snapshot of bed elevation, ice
 * thickness and rock id at one model time. The stage only draws these fields; it never evolves them.
 *
 * The seam is deliberately narrow so that a model's captured run (a series of snapshots) can be swapped in
 * for a fixture without touching the renderer. Grids are row-major: `index = row * columns + column`.
 */

type Field = ArrayLike<number>;

export interface LandscapeSnapshot {
  readonly columns: number;
  readonly rows: number;
  /** Horizontal cell size (unit: metres). */
  readonly metresPerCell: number;
  /** Bed (rock surface) elevation per cell (unit: metres). */
  readonly bedM: Field;
  /** Ice thickness per cell (unit: metres). Absent means no ice. */
  readonly iceThicknessM?: Field;
  /** Rock id for the whole grid, or per cell. Absent means id 0. */
  readonly rockId?: number | Field;
  /** Ice surface velocity per cell, along columns (x) and rows (y) (unit: metres per year). Optional. */
  readonly iceVelocityMPerYr?: { readonly x: Field; readonly y: Field };
  /** Model time of this snapshot (unit: years). Absent for an authored, timeless state. */
  readonly modelTimeYr?: number;
}

/** How the model grid maps onto the block: which grid axis runs along the valley, and which way is down. */
export interface ValleyOrientation {
  /** "rows": the valley runs along increasing/decreasing row index; "columns": along column index. */
  readonly valleyAxis: "rows" | "columns";
  /** Direction of ice and river flow along that axis. */
  readonly downstream: "increasing" | "decreasing";
}

export const DEFAULT_ORIENTATION: ValleyOrientation = Object.freeze({
  valleyAxis: "rows",
  downstream: "increasing",
});

/**
 * A snapshot resampled into block order: `across` columns (left to right as seen from the front of the
 * block) and `along` rows from the valley head (row 0, at the back) to the downstream end (towards the
 * reader). All fields are dense Float32Arrays in that order.
 */
export interface BlockGrid {
  readonly across: number;
  readonly along: number;
  readonly metresPerCell: number;
  readonly bedM: Float32Array;
  readonly iceM: Float32Array;
  readonly rockId: Uint8Array;
  /** Ice velocity in block axes (across, along), or null when the snapshot has none. */
  readonly velocity: { readonly across: Float32Array; readonly along: Float32Array } | null;
  readonly modelTimeYr: number | null;
}

/** Throws a `RangeError` naming the first problem with a snapshot. */
export function validateSnapshot(s: LandscapeSnapshot): void {
  const n = s.columns * s.rows;
  if (!Number.isInteger(s.columns) || !Number.isInteger(s.rows) || s.columns < 3 || s.rows < 3)
    throw new RangeError("Snapshot grid must be at least 3 × 3 whole cells");
  if (!(s.metresPerCell > 0)) throw new RangeError("metresPerCell must be positive");
  const check = (name: string, f: Field | undefined) => {
    if (f && f.length !== n) throw new RangeError(`${name} has ${f.length} values; expected ${n}`);
  };
  check("bedM", s.bedM);
  check("iceThicknessM", s.iceThicknessM);
  if (typeof s.rockId !== "number") check("rockId", s.rockId);
  check("iceVelocityMPerYr.x", s.iceVelocityMPerYr?.x);
  check("iceVelocityMPerYr.y", s.iceVelocityMPerYr?.y);
}

/** Resamples a snapshot into block order. Pure; copies every field. */
export function toBlockGrid(
  s: LandscapeSnapshot,
  orientation: ValleyOrientation = DEFAULT_ORIENTATION,
): BlockGrid {
  validateSnapshot(s);
  const alongRows = orientation.valleyAxis === "rows";
  const across = alongRows ? s.columns : s.rows;
  const along = alongRows ? s.rows : s.columns;
  const flip = orientation.downstream === "decreasing";
  // The grid is read in image convention (row 0 at the top of a map). The block is that map seen from
  // above with the downstream end towards the reader, so every orientation is a rotation, never a mirror:
  // a glacier that bends left in the model bends left on the page.
  const source = (a: number, l: number) => {
    const ll = flip ? along - 1 - l : l;
    if (alongRows) {
      const col = flip ? s.columns - 1 - a : a;
      return ll * s.columns + col;
    }
    const row = flip ? a : s.rows - 1 - a;
    return row * s.columns + ll;
  };
  const n = across * along;
  const bedM = new Float32Array(n);
  const iceM = new Float32Array(n);
  const rockId = new Uint8Array(n);
  const vel = s.iceVelocityMPerYr ? { across: new Float32Array(n), along: new Float32Array(n) } : null;
  const sign = flip ? -1 : 1;
  for (let l = 0; l < along; l++) {
    for (let a = 0; a < across; a++) {
      const k = l * across + a;
      const src = source(a, l);
      bedM[k] = s.bedM[src]!;
      iceM[k] = Math.max(0, s.iceThicknessM?.[src] ?? 0);
      rockId[k] = typeof s.rockId === "number" ? s.rockId : (s.rockId?.[src] ?? 0);
      if (vel && s.iceVelocityMPerYr) {
        const vx = s.iceVelocityMPerYr.x[src]!;
        const vy = s.iceVelocityMPerYr.y[src]!;
        if (alongRows) {
          vel.along[k] = vy * sign;
          vel.across[k] = vx * sign;
        } else {
          vel.along[k] = vx * sign;
          vel.across[k] = -vy * sign;
        }
      }
    }
  }
  return {
    across,
    along,
    metresPerCell: s.metresPerCell,
    bedM,
    iceM,
    rockId,
    velocity: vel,
    modelTimeYr: s.modelTimeYr ?? null,
  };
}

/** Lowest and highest of bed and ice surface (unit: metres). */
export function elevationRange(g: BlockGrid): { minM: number; maxM: number } {
  let minM = Infinity;
  let maxM = -Infinity;
  for (let k = 0; k < g.bedM.length; k++) {
    minM = Math.min(minM, g.bedM[k]!);
    maxM = Math.max(maxM, g.bedM[k]! + g.iceM[k]!);
  }
  return { minM, maxM };
}
