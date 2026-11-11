/**
 * The valley diorama: a landscape block built from one snapshot, in natural cel-shaded materials with ink
 * edges. It draws state; it never changes it. Everything the reader can change here (cut position, ice
 * visibility, the rock look preview, the reveal) is view-only.
 *
 * `group` is in block-local metres (see `block-geometry.ts`); the book stage scales and places it on the
 * page.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
} from "three";
import type { Material, Texture } from "three";
import { color, uniform } from "three/tsl";
import type { MeshBasicNodeMaterial, Node } from "three/webgpu";
import { type LithologyLook, PROVISIONAL_LITHOLOGIES, lithologyById } from "../materials/natural/lithology";
import {
  type NaturalUniforms,
  applyRockLook,
  createGroundMaterial,
  createIceMaterial,
  createIceSectionMaterial,
  createLithologyTexture,
  createNaturalUniforms,
  createTreeMaterial,
  createWallMaterial,
  createWaterMaterial,
} from "../materials/natural/materials";
import { NATURAL_TOKENS } from "../materials/natural/palette";
import { INK_TOKENS } from "../palette";
import { StrokeBuffer, StrokeLayer } from "../view/layers";
import { type InkUniforms, createInkUniforms, createStrokeMaterial } from "../view/materials";
import {
  type BlockFrame,
  type MeshArrays,
  blockBaseM,
  blockOutline,
  blockX,
  blockY,
  blockZ,
  buildGround,
  buildIce,
  buildIceSection,
  buildRibbon,
  buildWalls,
  clampCutRow,
  dashedProfile,
} from "./block-geometry";
import {
  type DressingConfig,
  DEFAULT_DRESSING,
  iceFlowLines,
  riverCells,
  sampleField,
  slopeHachures,
  smoothPolyline,
  surfaceCover,
  treeSites,
} from "./dressing";
import {
  type BlockGrid,
  type LandscapeSnapshot,
  type ValleyOrientation,
  DEFAULT_ORIENTATION,
  elevationRange,
  toBlockGrid,
} from "./snapshot";

export interface DioramaOptions {
  /** Looks for the model's rock ids. Default: the provisional review set. */
  readonly lithologies?: readonly LithologyLook[];
  readonly orientation?: ValleyOrientation;
  readonly dressing?: Partial<DressingConfig>;
  /** Vertical scale (unit: none; 1 = true scale). A page showing the scene binds this value. */
  readonly reliefScale?: number;
  /** Soil band thickness on the block sides under meadow (unit: metres). Illustrative. */
  readonly soilDepthM?: number;
  /** Lithology tile size on the block sides (unit: metres). */
  readonly patternTileM?: number;
}

/** View-only reveal values (from the transition). */
export interface DioramaReveal {
  readonly rise: number;
  readonly ink: number;
  readonly hachure: number;
  readonly colour: number;
}

/** A plain-language account of what the block currently shows, for text alternatives. */
export interface DioramaDescription {
  /** Whether the front face currently cuts through glacier ice. */
  readonly frontFaceCutsIce: boolean;
  /** Fraction of the valley length (head → front) that carries ice (unit: none). */
  readonly iceReachFraction: number;
  /** Cut position as a fraction of the valley length from the head (unit: none). */
  readonly cutFraction: number;
  /** Block row of the front face, counted from the valley head (unit: cells). */
  readonly cutAlongIndex: number;
  readonly rockName: string;
  readonly modelTimeYr: number | null;
  readonly iceShown: boolean;
}

export interface Footprint {
  /** Block size in block-local units: across, height (relief scaled) and along (unit: metres). */
  readonly widthM: number;
  readonly heightM: number;
  readonly depthM: number;
  /** Block-local z of the back face and of the current (cut) front face (unit: metres). */
  readonly backZ: number;
  readonly frontZ: number;
}

type StrokeKind = "edge" | "iceEdge" | "hachure" | "flow" | "dash";

class Strokes {
  readonly buffer = new StrokeBuffer();
  readonly layer: StrokeLayer;
  readonly fade = uniform(1);
  constructor(ink: InkUniforms, colourHex?: string) {
    const material = createStrokeMaterial(ink);
    if (colourHex) material.colorNode = color(new Color(colourHex));
    material.opacityNode = (material.opacityNode as Node<"float">).mul(this.fade);
    this.layer = new StrokeLayer(material);
    this.layer.mesh.renderOrder = 2;
  }
  upload() {
    this.layer.update(this.buffer);
    this.layer.mesh.visible = this.layer.count > 0;
  }
  dispose() {
    this.layer.dispose();
    (this.layer.mesh.material as Material).dispose();
  }
}

/** Builds a tree: two stacked cones, base at y = 0, height 1, radius 0.32 (unit: none; scaled per tree). */
function treeGeometry(): BufferGeometry {
  const parts = [
    new ConeGeometry(0.32, 0.62, 7, 1).translate(0, 0.4, 0),
    new ConeGeometry(0.24, 0.5, 7, 1).translate(0, 0.75, 0),
  ].map((g) => g.toNonIndexed());
  const count = parts.reduce((s, g) => s + g.getAttribute("position").count, 0);
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  let o = 0;
  for (const g of parts) {
    position.set(g.getAttribute("position").array as Float32Array, o);
    normal.set(g.getAttribute("normal").array as Float32Array, o);
    o += g.getAttribute("position").count * 3;
    g.dispose();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setAttribute("normal", new BufferAttribute(normal, 3));
  return geometry;
}

function toGeometry(arrays: MeshArrays, previous?: BufferGeometry): BufferGeometry {
  previous?.dispose();
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(arrays.position, 3));
  g.setAttribute("normal", new BufferAttribute(arrays.normal, 3));
  for (const [name, values] of Object.entries(arrays.attributes))
    g.setAttribute(name, new BufferAttribute(values, 1));
  g.setIndex(new BufferAttribute(arrays.index, 1));
  g.computeBoundingSphere();
  return g;
}

export class ValleyDiorama {
  /** Block-local metres; base at y = 0, centred on x and z. */
  readonly group = new Group();
  /** Inner group that the rise scales vertically. */
  private readonly body = new Group();
  readonly uniforms: NaturalUniforms = createNaturalUniforms();
  readonly ink: InkUniforms = createInkUniforms();
  private readonly lithologies: readonly LithologyLook[];
  private readonly orientation: ValleyOrientation;
  private readonly dressing: DressingConfig;
  private readonly reliefScale: number;
  private readonly soilDepthM: number;
  private readonly textures = new Map<number, Texture>();
  private readonly ground: Mesh;
  private readonly ice: Mesh;
  private readonly iceSection: Mesh;
  private readonly walls: Mesh;
  private readonly river: Mesh;
  private readonly trees: InstancedMesh;
  private readonly wallMaterial: ReturnType<typeof createWallMaterial>;
  private readonly strokes: Record<StrokeKind, Strokes>;
  private grid: BlockGrid | null = null;
  private reference: BlockGrid | null = null;
  private frame: BlockFrame | null = null;
  private cutFraction = 1;
  private iceShown = true;
  private rockOverride: number | null = null;
  private reveal: DioramaReveal = { rise: 1, ink: 1, hachure: 0.22, colour: 1 };
  private range: { minM: number; maxM: number } | null = null;
  private fixedRange: { minM: number; maxM: number } | null = null;
  /** Called after any change that needs a new frame. */
  onChange: () => void = () => undefined;

  constructor(options: DioramaOptions = {}) {
    this.lithologies = options.lithologies?.length ? options.lithologies : PROVISIONAL_LITHOLOGIES;
    this.orientation = options.orientation ?? DEFAULT_ORIENTATION;
    this.dressing = { ...DEFAULT_DRESSING, ...options.dressing };
    this.reliefScale = options.reliefScale ?? 1;
    this.soilDepthM = options.soilDepthM ?? 40;
    const u = this.uniforms;
    this.ground = new Mesh(new BufferGeometry(), createGroundMaterial(u));
    this.ice = new Mesh(new BufferGeometry(), createIceMaterial(u));
    this.iceSection = new Mesh(new BufferGeometry(), createIceSectionMaterial(u));
    this.wallMaterial = createWallMaterial(u, this.textureFor(this.lithologies[0]!), {
      tileM: options.patternTileM ?? 220,
    });
    this.walls = new Mesh(new BufferGeometry(), this.wallMaterial.material);
    this.river = new Mesh(new BufferGeometry(), createWaterMaterial(u));
    this.trees = new InstancedMesh(treeGeometry(), createTreeMaterial(u), 4096);
    this.trees.count = 0;
    for (const mesh of [this.ground, this.ice, this.iceSection, this.walls, this.trees])
      mesh.castShadow = true;
    this.ink.halfWidthM.value = 0;
    this.ink.datumM.value = 0;
    this.ink.reliefScale.value = 1;
    this.ink.exaggeration.value = 1;
    this.ink.strokeDepthBias.value = 0.0006;
    this.strokes = {
      edge: new Strokes(this.ink),
      iceEdge: new Strokes(this.ink),
      hachure: new Strokes(this.ink),
      flow: new Strokes(this.ink, NATURAL_TOKENS.iceFlow),
      dash: new Strokes(this.ink),
    };
    this.body.add(this.ground, this.ice, this.iceSection, this.walls, this.river, this.trees);
    for (const s of Object.values(this.strokes)) this.body.add(s.layer.mesh);
    this.group.add(this.body);
    this.group.visible = false;
  }

  private textureFor(look: LithologyLook): Texture {
    let t = this.textures.get(look.id);
    if (!t) {
      t = createLithologyTexture(look);
      this.textures.set(look.id, t);
    }
    return t;
  }

  /**
   * Draws a snapshot. `reference` is the starting state whose bed is drawn as a dashed line on the cut
   * face (same grid). Pass `null` to keep no reference.
   */
  setSnapshot(snapshot: LandscapeSnapshot, reference?: LandscapeSnapshot | null): void {
    const grid = toBlockGrid(snapshot, this.orientation);
    if (reference !== undefined) this.reference = reference ? toBlockGrid(reference, this.orientation) : null;
    if (this.reference && (this.reference.across !== grid.across || this.reference.along !== grid.along))
      throw new RangeError("Reference snapshot must share the snapshot's grid");
    // The frame (base and vertical extent) is fixed by the first snapshot plus the reference, so the block
    // does not jump as the valley deepens over a run.
    if (!this.range || !this.grid || this.grid.across !== grid.across || this.grid.along !== grid.along) {
      const r = elevationRange(grid);
      for (const extra of [this.reference && elevationRange(this.reference), this.fixedRange]) {
        if (!extra) continue;
        r.minM = Math.min(r.minM, extra.minM);
        r.maxM = Math.max(r.maxM, extra.maxM);
      }
      this.range = r;
    }
    this.grid = grid;
    this.rebuild();
  }

  /**
   * Fixes the block's vertical frame to cover `range` (unit: metres): for example every snapshot of every
   * run a reader can switch between, so the block keeps its size and base when the run or time changes.
   * Applies from the next `setSnapshot`. `null` frames each new grid by its first snapshot again.
   */
  setElevationRange(range: { readonly minM: number; readonly maxM: number } | null): void {
    this.fixedRange = range ? { minM: range.minM, maxM: range.maxM } : null;
    this.range = null;
  }

  /** Moves the front face. `fraction` of the valley length from the head (unit: none, 0–1). View-only. */
  setCut(fraction: number): void {
    this.cutFraction = Math.min(1, Math.max(0, fraction));
    if (this.grid) this.rebuild();
  }

  /** Shows or hides the glacier surface ("see under the ice"). View-only; the ice still exists. */
  setIceVisible(shown: boolean): void {
    this.iceShown = shown;
    this.applyVisibility();
    this.onChange();
  }

  /**
   * Previews another rock's look on the block (view-only). In the lesson a rock choice starts a new run;
   * this override is for reviewing the look on a fixture. `null` uses the snapshot's rock id.
   */
  setRockLook(id: number | null): void {
    this.rockOverride = id;
    this.applyRock();
    this.onChange();
  }

  setReveal(reveal: DioramaReveal): void {
    this.reveal = reveal;
    this.body.scale.y = Math.max(0.002, reveal.rise);
    this.uniforms.colour.value = reveal.colour;
    this.strokes.edge.fade.value = reveal.ink;
    this.strokes.iceEdge.fade.value = reveal.ink;
    this.strokes.dash.fade.value = reveal.ink;
    this.strokes.hachure.fade.value = reveal.hachure;
    this.strokes.flow.fade.value = reveal.colour;
    this.applyVisibility();
    this.onChange();
  }

  /** Device pixels per CSS pixel and drawing buffer size, for the screen-space ink strokes. */
  setViewport(pixelRatio: number, widthPx: number, heightPx: number): void {
    this.ink.pixelRatio.value = pixelRatio;
    this.ink.resolutionPx.value.set(Math.max(1, widthPx), Math.max(1, heightPx));
  }

  footprint(): Footprint | null {
    if (!this.grid || !this.range || !this.frame) return null;
    const m = this.grid.metresPerCell;
    return {
      widthM: (this.grid.across - 1) * m,
      heightM: blockY(this.frame, this.range.maxM),
      depthM: (this.grid.along - 1) * m,
      backZ: blockZ(this.frame, 0),
      frontZ: blockZ(this.frame, this.frame.cutRow),
    };
  }

  get look(): LithologyLook {
    const id = this.rockOverride ?? this.grid?.rockId[0] ?? this.lithologies[0]!.id;
    return lithologyById(this.lithologies, id);
  }

  describe(): DioramaDescription | null {
    const g = this.grid;
    const f = this.frame;
    if (!g || !f) return null;
    let iceRows = 0;
    let cutsIce = false;
    for (let l = 0; l < g.along; l++) {
      let rowIce = false;
      for (let a = 0; a < g.across; a++)
        if (g.iceM[l * g.across + a]! > this.dressing.iceThresholdM) rowIce = true;
      if (rowIce) iceRows = l + 1;
      if (l === f.cutRow) cutsIce = rowIce;
    }
    return {
      frontFaceCutsIce: cutsIce,
      iceReachFraction: iceRows / g.along,
      cutFraction: f.cutRow / (g.along - 1),
      cutAlongIndex: f.cutRow,
      rockName: this.look.name,
      modelTimeYr: g.modelTimeYr,
      iceShown: this.iceShown,
    };
  }

  private applyRock(): void {
    const look = this.look;
    applyRockLook(this.uniforms, look);
    this.wallMaterial.setTexture(this.textureFor(look));
  }

  private applyVisibility(): void {
    this.ice.visible = this.iceShown && this.ice.geometry.index !== null;
    this.iceSection.visible = this.iceShown && this.iceSection.geometry.index !== null;
    this.strokes.flow.layer.mesh.visible = this.iceShown && this.strokes.flow.layer.count > 0;
    this.strokes.iceEdge.layer.mesh.visible = this.iceShown && this.strokes.iceEdge.layer.count > 0;
    this.strokes.hachure.layer.mesh.visible =
      this.reveal.hachure > 0.01 && this.strokes.hachure.layer.count > 0;
  }

  private rebuild(): void {
    const g = this.grid!;
    const range = this.range!;
    const cfg = this.dressing;
    const f: BlockFrame = {
      across: g.across,
      along: g.along,
      metresPerCell: g.metresPerCell,
      baseM: blockBaseM(range.minM, range.maxM),
      reliefScale: this.reliefScale,
      cutRow: clampCutRow(g, this.cutFraction * (g.along - 1)),
    };
    this.frame = f;
    const cover = surfaceCover(g, cfg);
    this.ground.geometry = toGeometry(buildGround(g, f, cover), this.ground.geometry);
    const ice = buildIce(g, f, cfg.iceThresholdM);
    this.ice.geometry.dispose();
    this.ice.geometry = ice ? toGeometry(ice) : new BufferGeometry();
    const section = buildIceSection(g, f, cfg.iceThresholdM);
    this.iceSection.geometry.dispose();
    this.iceSection.geometry = section ? toGeometry(section) : new BufferGeometry();
    const soil = (k: number) => (cover.meadow[k]! > 0.5 ? this.soilDepthM : 0);
    this.walls.geometry = toGeometry(buildWalls(g, f, soil), this.walls.geometry);

    const river = riverCells(g, cfg);
    const riverSet = new Set(river);
    const path = smoothPolyline(
      river.flatMap((k) => [k % g.across, Math.floor(k / g.across)]),
      3,
    );
    const ribbon = buildRibbon(g, f, path, 1.1);
    this.river.geometry.dispose();
    this.river.geometry = ribbon ? toGeometry(ribbon) : new BufferGeometry();
    this.river.visible = ribbon !== null;

    const sites = treeSites(g, cfg, riverSet, f.cutRow);
    const m = g.metresPerCell;
    const matrix = new Matrix4();
    const count = Math.min(sites.length, this.trees.instanceMatrix.count);
    for (let i = 0; i < count; i++) {
      const s = sites[i]!;
      // Illustrative size: trees are drawn about two cells tall so they read at page scale.
      const h = m * 2.6 * s.size;
      matrix.makeScale(h, h, h).setPosition(blockX(f, s.a), blockY(f, s.groundM) - m * 0.05, blockZ(f, s.l));
      this.trees.setMatrixAt(i, matrix);
    }
    this.trees.count = count;
    this.trees.instanceMatrix.needsUpdate = true;
    this.trees.computeBoundingSphere();

    this.packStrokes(g, f);
    this.applyRock();
    this.applyVisibility();
    this.group.visible = true;
    this.onChange();
  }

  private packStrokes(g: BlockGrid, f: BlockFrame): void {
    const cfg = this.dressing;
    const lift = g.metresPerCell * 0.03;
    const { edge, iceEdge, hachure, flow, dash } = this.strokes;
    edge.buffer.reset();
    iceEdge.buffer.reset();
    for (const line of blockOutline(g, f, cfg.iceThresholdM))
      (line.ice ? iceEdge : edge).buffer.pushPolyline(
        line.points,
        line.closed,
        INK_TOKENS.indexContourWidthPx,
      );

    hachure.buffer.reset();
    const h = slopeHachures(g, cfg, f.cutRow);
    const hs = new Float64Array((h.length / 4) * 6);
    for (let i = 0, o = 0; i < h.length; i += 4, o += 6) {
      const [a0, l0, a1, l1] = [h[i]!, h[i + 1]!, h[i + 2]!, h[i + 3]!];
      hs.set(
        [
          blockX(f, a0),
          blockZ(f, l0),
          blockY(f, sampleField(g.bedM, g, a0, l0) + lift),
          blockX(f, a1),
          blockZ(f, l1),
          blockY(f, sampleField(g.bedM, g, a1, l1) + lift),
        ],
        o,
      );
    }
    hachure.buffer.pushStrokes(hs, INK_TOKENS.hachureWidthPx);

    flow.buffer.reset();
    const surface = new Float32Array(g.bedM.length);
    for (let k = 0; k < surface.length; k++) surface[k] = g.bedM[k]! + g.iceM[k]!;
    for (const line of iceFlowLines(g, cfg, f.cutRow)) {
      const pts: number[] = [];
      for (let i = 0; i < line.length; i += 2)
        pts.push(
          blockX(f, line[i]!),
          blockZ(f, line[i + 1]!),
          blockY(f, sampleField(surface, g, line[i]!, line[i + 1]!) + lift),
        );
      flow.buffer.pushPolyline(pts, false, 1);
    }

    dash.buffer.reset();
    if (this.reference) dash.buffer.pushStrokes(dashedProfile(this.reference, f), 1.4);

    for (const s of Object.values(this.strokes)) s.upload();
  }

  dispose(): void {
    for (const mesh of [this.ground, this.ice, this.iceSection, this.walls, this.river, this.trees]) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
    }
    for (const s of Object.values(this.strokes)) s.dispose();
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
  }
}

/** Creates a diorama. Hand it to `createBookStage`, then call `setSnapshot`. */
export function createValleyDiorama(options: DioramaOptions = {}): ValleyDiorama {
  return new ValleyDiorama(options);
}
