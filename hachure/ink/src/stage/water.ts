/**
 * Geometry for extra surface water drawn by dressing rules (session 7D, D-W7-7D): several stream ribbons in
 * one mesh, and standing water (lakes) at a per-cell level. Plain typed arrays, no three.js, testable in
 * Node. Presentation only: the levels and paths come from a dressing rule that reads the snapshot; nothing
 * here routes water or changes state.
 */
import { type BlockFrame, type MeshArrays, blockX, blockY, blockZ, buildRibbon } from "./block-geometry";
import type { BlockGrid } from "./snapshot";

/** Concatenates meshes into one (positions, normals, indices and shared attributes). Null when empty. */
export function mergeMeshArrays(parts: readonly (MeshArrays | null)[]): MeshArrays | null {
  const meshes = parts.filter((p): p is MeshArrays => p !== null && p.index.length > 0);
  if (!meshes.length) return null;
  const vertices = meshes.reduce((s, m) => s + m.position.length / 3, 0);
  const indices = meshes.reduce((s, m) => s + m.index.length, 0);
  const position = new Float32Array(vertices * 3);
  const normal = new Float32Array(vertices * 3);
  const index = new Uint32Array(indices);
  const names = Object.keys(meshes[0]!.attributes).filter((n) => meshes.every((m) => n in m.attributes));
  const attributes: Record<string, Float32Array> = Object.fromEntries(
    names.map((n) => [n, new Float32Array(vertices)]),
  );
  let v = 0;
  let i = 0;
  for (const m of meshes) {
    position.set(m.position, v * 3);
    normal.set(m.normal, v * 3);
    for (const n of names) attributes[n]!.set(m.attributes[n]!, v);
    for (let k = 0; k < m.index.length; k++) index[i + k] = m.index[k]! + v;
    v += m.position.length / 3;
    i += m.index.length;
  }
  return { position, normal, index, attributes };
}

/** Stream ribbons (paths in fractional cells, `a0, l0, …`), each `widthCells` wide, as one mesh. */
export function buildStreams(
  g: BlockGrid,
  f: BlockFrame,
  paths: readonly (readonly number[])[],
  widthCells: number,
): MeshArrays | null {
  return mergeMeshArrays(paths.map((p) => buildRibbon(g, f, p, widthCells)));
}

/**
 * Standing water: a surface at `levelM[k]` over every cell with a finite level up to the cut row. Dry
 * vertices of a wet cell dip below the bed, so the water meets its shore in a clean intersection line (as
 * the ice surface does). Null when nothing is wet before the cut.
 */
export function buildLakes(g: BlockGrid, f: BlockFrame, levelM: ArrayLike<number>): MeshArrays | null {
  const rows = f.cutRow + 1;
  const n = g.across * rows;
  const wet = (k: number) => Number.isFinite(levelM[k]!) && levelM[k]! > g.bedM[k]!;
  let any = false;
  for (let k = 0; k < n && !any; k++) any = wet(k);
  if (!any) return null;
  const dipM = g.metresPerCell * 0.6;
  const position = new Float32Array(n * 3);
  const normal = new Float32Array(n * 3);
  for (let l = 0; l < rows; l++)
    for (let a = 0; a < g.across; a++) {
      const k = l * g.across + a;
      // A dry vertex takes the highest neighbouring water level, dipped below its bed, so a shore slopes in.
      let h = wet(k) ? levelM[k]! : -Infinity;
      if (!wet(k)) {
        let near = -Infinity;
        for (let dl = -1; dl <= 1; dl++)
          for (let da = -1; da <= 1; da++) {
            const x = a + da;
            const y = l + dl;
            if (x < 0 || y < 0 || x >= g.across || y >= rows) continue;
            const j = y * g.across + x;
            if (wet(j)) near = Math.max(near, levelM[j]!);
          }
        h = Number.isFinite(near) ? Math.min(near, g.bedM[k]! - dipM) : g.bedM[k]! - dipM;
      }
      position[k * 3] = blockX(f, a);
      position[k * 3 + 1] = blockY(f, h);
      position[k * 3 + 2] = blockZ(f, l);
      normal[k * 3 + 1] = 1;
    }
  const index: number[] = [];
  for (let l = 0; l < rows - 1; l++)
    for (let a = 0; a < g.across - 1; a++) {
      const k00 = l * g.across + a;
      const ks = [k00, k00 + 1, k00 + g.across, k00 + g.across + 1];
      if (!ks.some(wet)) continue;
      index.push(ks[0]!, ks[2]!, ks[1]!, ks[1]!, ks[2]!, ks[3]!);
    }
  return { position, normal, index: Uint32Array.from(index), attributes: {} };
}
