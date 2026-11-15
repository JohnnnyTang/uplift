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
  CanvasTexture,
  Color,
  ConeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  RepeatWrapping,
  SRGBColorSpace,
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
  buildCrustSection,
  buildIceSection,
  buildRibbon,
  buildWalls,
  clampCutRow,
  dashedProfile,
  patternedProfile,
  solidProfile,
} from "./block-geometry";
import { buildLakes, buildStreams } from "./water";
import {
  type CrustBandLook,
  type CrustLayer,
  type CrustLayerLook,
  CRUST_BAND_LOOK,
  paintCrustTile,
} from "./crust";
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
  /**
   * Replacement dressing rules (session 5K, `@hachure/ink/glacial`). Each reads the snapshot and returns
   * presentation only. Absent rules keep the 5H defaults.
   */
  readonly rules?: DressingRules;
  /** Look of the crust band and mantle on the front face (D-W7-7B). Default `CRUST_BAND_LOOK`. */
  readonly crustBand?: CrustBandLook;
  /**
   * Crust and mantle pattern tile size on the front face (unit: block-local metres, vertical scale applied,
   * so marks keep their shape). Default: a twelfth of the block's width.
   */
  readonly crustPatternTileM?: number;
}

/** Pluggable dressing rules: pure functions of a block grid, deterministic, never changing state. */
export interface DressingRules {
  /** River cells in order, from its source to where it leaves the block (block-grid cell indices). */
  readonly river?: (g: BlockGrid, cfg: DressingConfig) => number[];
  /** Flow-mark polylines on the ice in fractional cell coordinates (`a0, l0, a1, l1, …`). */
  readonly flowLines?: (g: BlockGrid, cfg: DressingConfig, lastRow: number) => number[][];
  /**
   * Additional streams (D-W7-7D): polylines in fractional cell coordinates (`a0, l0, …`), each drawn as a
   * water ribbon like the river. Absent: none.
   */
  readonly streams?: (g: BlockGrid, cfg: DressingConfig, lastRow: number) => readonly (readonly number[])[];
  /**
   * Standing water (D-W7-7D): a water level per block-grid cell (unit: metres), not finite where dry. Drawn
   * as a flat water surface. Absent: none.
   */
  readonly lakes?: (g: BlockGrid, cfg: DressingConfig, lastRow: number) => ArrayLike<number> | null;
  /**
   * Replacement slope hachures (D-W7-7D): segments `a0, l0, a1, l1` in fractional cell coordinates. Absent:
   * the default `slopeHachures`.
   */
  readonly hachures?: (g: BlockGrid, cfg: DressingConfig, lastRow: number) => number[];
  /**
   * Thins the trees (D-W7-7D): false drops the tree placed at fractional cell (a, l), for example to keep a
   * strip clear where small relief must read. Absent: every tree the dressing config places is drawn.
   */
  readonly keepTree?: (g: BlockGrid, a: number, l: number) => boolean;
  /**
   * Extra ink lines draped on the surface (D-W7-7D), for example fault traces or scarp crests: polylines in
   * fractional cell coordinates, at full ink strength. Absent: none.
   */
  readonly inkLines?: (
    g: BlockGrid,
    cfg: DressingConfig,
    lastRow: number,
  ) => readonly { readonly points: readonly number[]; readonly widthPx?: number }[];
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
  /** Whether a comparison profile (a kept run's bed) is drawn on the front face. */
  readonly ghostShown: boolean;
  /** Number of comparison profiles drawn on the front face (0–3). */
  readonly ghostCount: number;
  /** Whether the front face shows the crust band (the snapshot has a crust base). */
  readonly crustShown: boolean;
  /** Whether the rock layers on the walls follow a layer offset (the snapshot has `layerOffsetM`). */
  readonly layersOffset: boolean;
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

type StrokeKind =
  "edge" | "iceEdge" | "hachure" | "flow" | "dash" | "ghostHalo" | "ghost" | "crustBase" | "inkLine";

/** Most comparison profiles drawn at once. */
export const MAX_GHOSTS = 3;
/**
 * Dash patterns of comparison profiles after the first (in cells): dash-dot, dash-dot-dot. The first keeps
 * the dotted kept-run style, so lesson 1 draws exactly as before.
 */
const GHOST_PATTERNS: readonly (readonly number[])[] = [
  [0.7, 0.3, 0.1, 0.3],
  [0.7, 0.25, 0.1, 0.25, 0.1, 0.25],
];

/** A repeating canvas texture of a crust layer's pattern (browser only). */
function createCrustTexture(layer: CrustLayer, look: CrustLayerLook, sizePx = 128): Texture {
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(sizePx, sizePx)
      : Object.assign(document.createElement("canvas"), { width: sizePx, height: sizePx });
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error("2D canvas is not available for the crust texture");
  paintCrustTile(ctx, layer, look, sizePx);
  const t = new CanvasTexture(canvas as HTMLCanvasElement);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

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
  /** Extra streams and lakes from dressing rules (D-W7-7D); empty and hidden without those rules. */
  private readonly streams: Mesh;
  private readonly lakes: Mesh;
  private readonly trees: InstancedMesh;
  private readonly wallMaterial: ReturnType<typeof createWallMaterial>;
  private readonly strokes: Record<StrokeKind, Strokes>;
  private grid: BlockGrid | null = null;
  private reference: BlockGrid | null = null;
  private ghosts: BlockGrid[] = [];
  private readonly crustLook: CrustBandLook;
  private readonly crustTileOption: number | undefined;
  private readonly crustMesh: Mesh;
  private readonly mantleMesh: Mesh;
  private crustMaterials: {
    tileM: number;
    crust: ReturnType<typeof createWallMaterial>;
    mantle: ReturnType<typeof createWallMaterial>;
    textures: Texture[];
  } | null = null;
  private readonly rules: DressingRules;
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
    this.rules = options.rules ?? {};
    this.crustLook = options.crustBand ?? CRUST_BAND_LOOK;
    this.crustTileOption = options.crustPatternTileM;
    const u = this.uniforms;
    this.ground = new Mesh(new BufferGeometry(), createGroundMaterial(u));
    this.ice = new Mesh(new BufferGeometry(), createIceMaterial(u));
    this.iceSection = new Mesh(new BufferGeometry(), createIceSectionMaterial(u));
    this.wallMaterial = createWallMaterial(u, this.textureFor(this.lithologies[0]!), {
      tileM: options.patternTileM ?? 220,
    });
    this.walls = new Mesh(new BufferGeometry(), this.wallMaterial.material);
    this.river = new Mesh(new BufferGeometry(), createWaterMaterial(u));
    this.streams = new Mesh(new BufferGeometry(), createWaterMaterial(u));
    this.lakes = new Mesh(new BufferGeometry(), createWaterMaterial(u));
    this.streams.visible = false;
    this.lakes.visible = false;
    this.trees = new InstancedMesh(treeGeometry(), createTreeMaterial(u), 4096);
    // The crust band and mantle: built only for snapshots with a crust base (materials made on first use).
    this.crustMesh = new Mesh(new BufferGeometry());
    this.mantleMesh = new Mesh(new BufferGeometry());
    this.crustMesh.visible = false;
    this.mantleMesh.visible = false;
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
      // The comparison profile: a paper halo under a dotted ink line, so it reads on any lithology pattern.
      ghostHalo: new Strokes(this.ink, NATURAL_TOKENS.ghostHalo),
      ghost: new Strokes(this.ink, NATURAL_TOKENS.ghost),
      crustBase: new Strokes(this.ink, this.crustLook.baseLine),
      inkLine: new Strokes(this.ink),
    };
    this.strokes.ghost.layer.mesh.renderOrder = 3;
    this.body.add(this.ground, this.ice, this.iceSection, this.walls, this.river, this.trees);
    this.body.add(this.streams, this.lakes);
    this.body.add(this.crustMesh, this.mantleMesh);
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

  /**
   * Draws another run's bed on the front face as a dotted comparison line (a kept run at the same model
   * time). Same grid as the snapshot. `null` removes it. View-only.
   */
  setGhost(snapshot: LandscapeSnapshot | null): void {
    this.setGhosts(snapshot ? [snapshot] : []);
  }

  /**
   * Draws up to `MAX_GHOSTS` comparison snapshots on the front face (D-W7-7B): the first dotted (as
   * `setGhost`), the next dash-dot and dash-dot-dot, each over a paper halo; their crust bases too when both
   * they and the shown snapshot have one. Same grid as the snapshot. An empty list removes them. View-only.
   */
  setGhosts(snapshots: readonly LandscapeSnapshot[]): void {
    if (snapshots.length > MAX_GHOSTS)
      throw new RangeError(`At most ${MAX_GHOSTS} comparison snapshots can be drawn`);
    const ghosts = snapshots.map((s) => toBlockGrid(s, this.orientation));
    const grid = this.grid;
    if (grid && ghosts.some((g) => g.across !== grid.across || g.along !== grid.along))
      throw new RangeError("Ghost snapshot must share the snapshot's grid");
    this.ghosts = ghosts;
    if (this.grid && this.frame) {
      this.packStrokes(this.grid, this.frame);
      this.applyVisibility();
    }
    this.onChange();
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
    this.strokes.ghost.fade.value = reveal.ink;
    this.strokes.ghostHalo.fade.value = reveal.ink;
    this.strokes.crustBase.fade.value = reveal.ink;
    this.strokes.inkLine.fade.value = reveal.ink;
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
      ghostShown: this.ghosts.length > 0,
      ghostCount: this.ghosts.length,
      crustShown: g.crustBaseM !== undefined,
      layersOffset: g.layerOffsetM !== undefined,
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
    this.rebuildCrust(g, f);

    const river = (this.rules.river ?? riverCells)(g, cfg);
    const riverSet = new Set(river);
    const path = smoothPolyline(
      river.flatMap((k) => [k % g.across, Math.floor(k / g.across)]),
      3,
    );
    const ribbon = buildRibbon(g, f, path, 1.1);
    this.river.geometry.dispose();
    this.river.geometry = ribbon ? toGeometry(ribbon) : new BufferGeometry();
    this.river.visible = ribbon !== null;

    this.rebuildWater(g, f, riverSet);

    const keep = this.rules.keepTree;
    const sites = treeSites(g, cfg, riverSet, f.cutRow).filter((t) => !keep || keep(g, t.a, t.l));
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
    const h = (this.rules.hachures ?? slopeHachures)(g, cfg, f.cutRow);
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
    for (const line of (this.rules.flowLines ?? iceFlowLines)(g, cfg, f.cutRow)) {
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

    // The starting crust base, dashed like the starting bed.
    if (this.reference?.crustBaseM && g.crustBaseM)
      dash.buffer.pushStrokes(dashedProfile(this.reference, f, 0.9, 0.7, this.reference.crustBaseM), 1.4);

    const { ghost, ghostHalo, crustBase } = this.strokes;
    ghost.buffer.reset();
    ghostHalo.buffer.reset();
    this.ghosts.forEach((gh, i) => {
      const fields = gh.crustBaseM && g.crustBaseM ? [gh.bedM, gh.crustBaseM] : [gh.bedM];
      for (const field of fields) {
        ghostHalo.buffer.pushPolyline(solidProfile(gh, f, 0.05, field), false, 3);
        const dots =
          i === 0
            ? dashedProfile(gh, f, 0.18, 0.34, field)
            : patternedProfile(gh, f, GHOST_PATTERNS[i - 1]!, field);
        ghost.buffer.pushStrokes(dots, 1.6);
      }
    });

    // The crust base: a solid ink line along the front face.
    crustBase.buffer.reset();
    const section = g.crustBaseM ? buildCrustSection(g, f) : null;
    if (section) crustBase.buffer.pushPolyline(section.basePolyline, false, INK_TOKENS.indexContourWidthPx);

    // Extra ink lines from the dressing rules (D-W7-7D), draped on the surface.
    const { inkLine } = this.strokes;
    inkLine.buffer.reset();
    for (const line of this.rules.inkLines?.(g, cfg, f.cutRow) ?? []) {
      const pts: number[] = [];
      for (let i = 0; i + 1 < line.points.length; i += 2) {
        const [a, l] = [line.points[i]!, line.points[i + 1]!];
        if (l > f.cutRow) break;
        pts.push(blockX(f, a), blockZ(f, l), blockY(f, sampleField(g.bedM, g, a, l) + lift));
      }
      if (pts.length >= 6)
        inkLine.buffer.pushPolyline(pts, false, line.widthPx ?? INK_TOKENS.indexContourWidthPx);
    }

    for (const s of Object.values(this.strokes)) s.upload();
  }

  /**
   * Streams and lakes from the dressing rules (D-W7-7D). Stream cells join `riverSet`, so trees keep off
   * them. Without the rules both meshes stay empty and hidden.
   */
  private rebuildWater(g: BlockGrid, f: BlockFrame, riverSet: Set<number>): void {
    const cfg = this.dressing;
    const paths = this.rules.streams?.(g, cfg, f.cutRow) ?? [];
    for (const p of paths)
      for (let i = 0; i + 1 < p.length; i += 2)
        riverSet.add(Math.round(p[i + 1]!) * g.across + Math.round(p[i]!));
    const streams = paths.length ? buildStreams(g, f, paths, 1.3) : null;
    this.streams.geometry.dispose();
    this.streams.geometry = streams ? toGeometry(streams) : new BufferGeometry();
    this.streams.visible = streams !== null;
    const levels = this.rules.lakes?.(g, cfg, f.cutRow) ?? null;
    const lakes = levels ? buildLakes(g, f, levels) : null;
    this.lakes.geometry.dispose();
    this.lakes.geometry = lakes ? toGeometry(lakes) : new BufferGeometry();
    this.lakes.visible = lakes !== null;
  }

  /** The crust band and mantle on the front face; hidden (and never built) without a crust base. */
  private rebuildCrust(g: BlockGrid, f: BlockFrame): void {
    const section = buildCrustSection(g, f);
    for (const mesh of [this.crustMesh, this.mantleMesh]) {
      mesh.geometry.dispose();
      mesh.geometry = new BufferGeometry();
      mesh.visible = false;
    }
    if (!section) return;
    const tileM = this.crustTileOption ?? Math.max(1, ((g.across - 1) * g.metresPerCell) / 12);
    if (!this.crustMaterials || this.crustMaterials.tileM !== tileM) {
      this.disposeCrustMaterials();
      const textures = [
        createCrustTexture("crust", this.crustLook.crust),
        createCrustTexture("mantle", this.crustLook.mantle),
      ];
      this.crustMaterials = {
        tileM,
        crust: createWallMaterial(this.uniforms, textures[0]!, { tileM }),
        mantle: createWallMaterial(this.uniforms, textures[1]!, { tileM }),
        textures,
      };
      this.crustMesh.material = this.crustMaterials.crust.material;
      this.mantleMesh.material = this.crustMaterials.mantle.material;
      this.crustMesh.castShadow = true;
      this.mantleMesh.castShadow = true;
    }
    this.crustMesh.geometry = toGeometry(section.crust);
    this.mantleMesh.geometry = toGeometry(section.mantle);
    this.crustMesh.visible = true;
    this.mantleMesh.visible = true;
  }

  private disposeCrustMaterials(): void {
    if (!this.crustMaterials) return;
    this.crustMaterials.crust.material.dispose();
    this.crustMaterials.mantle.material.dispose();
    for (const t of this.crustMaterials.textures) t.dispose();
    this.crustMaterials = null;
  }

  dispose(): void {
    for (const mesh of [
      this.ground,
      this.ice,
      this.iceSection,
      this.walls,
      this.river,
      this.streams,
      this.lakes,
      this.trees,
    ]) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
    }
    this.crustMesh.geometry.dispose();
    this.mantleMesh.geometry.dispose();
    this.disposeCrustMaterials();
    for (const s of Object.values(this.strokes)) s.dispose();
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
  }
}

/** Creates a diorama. Hand it to `createBookStage`, then call `setSnapshot`. */
export function createValleyDiorama(options: DioramaOptions = {}): ValleyDiorama {
  return new ValleyDiorama(options);
}
