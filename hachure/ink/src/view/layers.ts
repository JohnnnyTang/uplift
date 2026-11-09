/**
 * GPU-side geometry for the ink view: the terrain fill mesh and instanced stroke layers. Buffers are
 * reused across state updates and only reallocated when the grid size or stroke count outgrows them.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
} from "three";
import type { Material } from "three";
import { type ContourSet, DRAW_MIN_SPACING_CELLS, drawnPoints } from "../contours";
import type { Heightfield } from "../heightfield";
import { INK_TOKENS } from "../palette";
import { buildTriangleIndex, triangleIndexCount } from "../topology";

/** The terrain fill: one vertex per sample, triangulated by the shared diagonal rule. */
export class TerrainMesh {
  readonly mesh: Mesh;
  private gridSize = 0;

  constructor(material: Material) {
    this.mesh = new Mesh(new BufferGeometry(), material);
    this.mesh.frustumCulled = false; // positions are terrain coordinates, lifted in the shader
  }

  /** Uploads heights, overlays and the triangle index. `water` and `sediment` may be absent (zero). */
  update(
    heightfield: Heightfield,
    water: Float32Array | undefined,
    sediment: Float32Array | undefined,
  ): void {
    const { gridSize: n, metresPerCell: m } = heightfield;
    if (n !== this.gridSize) {
      const geometry = new BufferGeometry();
      const position = new Float32Array(n * n * 3);
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const i = (y * n + x) * 3;
          position[i] = (x + 0.5) * m;
          position[i + 1] = (y + 0.5) * m;
        }
      }
      geometry.setAttribute("position", new Float32BufferAttribute(position, 3));
      geometry.setAttribute("heightM", new Float32BufferAttribute(new Float32Array(n * n), 1));
      geometry.setAttribute("waterM", new Float32BufferAttribute(new Float32Array(n * n), 1));
      geometry.setAttribute("sedimentM", new Float32BufferAttribute(new Float32Array(n * n), 1));
      geometry.setIndex(new BufferAttribute(new Uint32Array(triangleIndexCount(n)), 1));
      this.mesh.geometry.dispose();
      this.mesh.geometry = geometry;
      this.gridSize = n;
    }
    const g = this.mesh.geometry;
    const write = (name: string, values: Float32Array | undefined) => {
      const attr = g.getAttribute(name) as Float32BufferAttribute;
      const array = attr.array as Float32Array;
      if (values && values.length === array.length) array.set(values);
      else array.fill(0);
      attr.needsUpdate = true;
    };
    write("heightM", heightfield.heightsM);
    write("waterM", water);
    write("sedimentM", sediment);
    const index = g.getIndex()!;
    buildTriangleIndex(heightfield, index.array as Uint32Array);
    index.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}

const STROKE_ATTRIBUTES = [
  ["segPrev", 3],
  ["segStart", 3],
  ["segEnd", 3],
  ["segNext", 3],
  ["segWidth", 1],
] as const;

type StrokeAttribute = (typeof STROKE_ATTRIBUTES)[number][0];

/**
 * Packed stroke segments, one entry per segment: the previous polyline point, start, end, next point
 * (terrain metres) and width (CSS pixels). The neighbours let the shader mitre joints.
 */
export class StrokeBuffer {
  readonly data: Record<StrokeAttribute, Float32Array> = {
    segPrev: new Float32Array(0),
    segStart: new Float32Array(0),
    segEnd: new Float32Array(0),
    segNext: new Float32Array(0),
    segWidth: new Float32Array(0),
  };
  count = 0;
  private capacity = 0;

  reset(): void {
    this.count = 0;
  }

  private reserve(extra: number): void {
    const need = this.count + extra;
    if (need <= this.capacity) return;
    let capacity = Math.max(1024, this.capacity);
    while (capacity < need) capacity *= 2;
    for (const [name, k] of STROKE_ATTRIBUTES) {
      const grown = new Float32Array(capacity * k);
      grown.set(this.data[name].subarray(0, this.count * k));
      this.data[name] = grown;
    }
    this.capacity = capacity;
  }

  /**
   * Adds a polyline. `point(i, out)` writes vertex `i` as terrain metres `[x, y, h]`. Open lines use their
   * own end points as the outer neighbours, which gives square (butt) ends.
   */
  private pushPath(count: number, closed: boolean, widthPx: number, point: (i: number) => number[]): void {
    if (count < 2) return;
    const segments = closed ? count : count - 1;
    this.reserve(segments);
    const vertex = (i: number) => point(closed ? (i + count) % count : Math.min(count - 1, Math.max(0, i)));
    const { segPrev, segStart, segEnd, segNext, segWidth } = this.data;
    for (let s = 0; s < segments; s++) {
      const o = this.count * 3;
      const write = (target: Float32Array, v: number[]) => {
        target[o] = v[0]!;
        target[o + 1] = v[1]!;
        target[o + 2] = v[2]!;
      };
      write(segPrev, vertex(s - 1));
      write(segStart, vertex(s));
      write(segEnd, vertex(s + 1));
      write(segNext, vertex(s + 2));
      segWidth[this.count] = widthPx;
      this.count++;
    }
  }

  /** Adds contour lines at their level, with index contours heavier. */
  pushContours(contours: ContourSet): void {
    const minSpacingM = DRAW_MIN_SPACING_CELLS * contours.metresPerCell;
    for (const line of contours.lines) {
      const p = drawnPoints(line, minSpacingM);
      const w = line.index ? INK_TOKENS.indexContourWidthPx : INK_TOKENS.contourWidthPx;
      this.pushPath(p.length / 2, line.closed, w, (i) => [p[i * 2]!, p[i * 2 + 1]!, line.levelM]);
    }
  }

  /** Adds a polyline of terrain points `x, y, h, …`, optionally closed. */
  pushPolyline(points: Float64Array | number[], closed: boolean, widthPx: number): void {
    this.pushPath(points.length / 3, closed, widthPx, (i) => [
      points[i * 3]!,
      points[i * 3 + 1]!,
      points[i * 3 + 2]!,
    ]);
  }

  /** Adds single-segment strokes (six numbers each: start then end), such as hachures. */
  pushStrokes(strokesM: Float64Array, widthPx: number): void {
    const count = strokesM.length / 6;
    for (let k = 0; k < count; k++) {
      const o = k * 6;
      this.pushPath(2, false, widthPx, (i) => [
        strokesM[o + i * 3]!,
        strokesM[o + i * 3 + 1]!,
        strokesM[o + i * 3 + 2]!,
      ]);
    }
  }
}

/** One instanced layer of strokes drawn with the stroke material. */
export class StrokeLayer {
  readonly mesh: Mesh;
  private capacity = 0;

  constructor(material: Material) {
    this.mesh = new Mesh(StrokeLayer.makeGeometry(0), material);
    this.mesh.frustumCulled = false;
  }

  private static makeGeometry(capacity: number): InstancedBufferGeometry {
    const g = new InstancedBufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const cap = Math.max(1, capacity);
    for (const [name, k] of STROKE_ATTRIBUTES) {
      g.setAttribute(name, new InstancedBufferAttribute(new Float32Array(cap * k), k));
    }
    g.instanceCount = 0;
    return g;
  }

  /** Uploads strokes. A larger stroke count swaps in a bigger geometry; a smaller one reuses buffers. */
  update(strokes: StrokeBuffer): void {
    if (strokes.count > this.capacity) {
      let capacity = Math.max(1024, this.capacity);
      while (capacity < strokes.count) capacity *= 2;
      this.mesh.geometry.dispose();
      this.mesh.geometry = StrokeLayer.makeGeometry(capacity);
      this.capacity = capacity;
    }
    const g = this.mesh.geometry as InstancedBufferGeometry;
    for (const [name, k] of STROKE_ATTRIBUTES) {
      const attr = g.getAttribute(name) as InstancedBufferAttribute;
      (attr.array as Float32Array).set(strokes.data[name].subarray(0, strokes.count * k));
      attr.needsUpdate = true;
    }
    g.instanceCount = strokes.count;
  }

  get count(): number {
    return (this.mesh.geometry as InstancedBufferGeometry).instanceCount;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}
