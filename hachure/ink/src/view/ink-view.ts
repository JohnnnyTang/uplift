/**
 * InkView: the 3D ink terrain. One canvas, three.js `WebGPURenderer` with TSL materials, and automatic
 * WebGL2 fallback (the same node graph compiles to GLSL).
 *
 * Usage:
 *
 * ```ts
 * const view = createInkView({ contourIntervalM: 5 });
 * await view.mount(canvas);
 * view.setState(await solver.snapshot({ layers: INK_VIEW_LAYERS }));
 * view.setExaggeration(0.5);
 * view.setCamera({ azimuthDeg: 30 });
 * view.dispose();
 * ```
 *
 * The view never changes the simulation; it only draws snapshots. It renders on demand (after a state,
 * camera, size or exaggeration change), never in a free-running loop.
 */
import type { LayerName, StateSnapshot } from "@hachure/terrain";
import { Color, OrthographicCamera, Scene } from "three";
import { WebGPURenderer } from "three/webgpu";
import { type ContourSet, contourSegmentCount, extractContours } from "../contours";
import { type HachureOptions, extractHachures } from "../hachures";
import { type Heightfield, heightfieldFromSnapshot } from "../heightfield";
import type { LiftState } from "../lift";
import {
  type ChannelConfig,
  type ChannelRamp,
  INK_TOKENS,
  type LegendToken,
  legendTokens,
  resolveChannels,
} from "../palette";
import {
  type CameraPose,
  type Projection,
  type TerrainFrame,
  createProjection,
  resolveCameraPose,
  terrainFrameFromHeightfield,
} from "../projection";
import { cameraFromProjection } from "./camera";
import { StrokeBuffer, StrokeLayer, TerrainMesh } from "./layers";
import {
  type InkUniforms,
  applyChannelUniforms,
  createInkUniforms,
  createStrokeMaterial,
  createTerrainMaterial,
} from "./materials";

export type InkBackendRequest = "auto" | "webgpu" | "webgl2";
export type InkBackend = "webgpu" | "webgl2";

/** Which ink layers are drawn. */
export interface InkLayers {
  readonly contours: boolean;
  readonly hachures: boolean;
  readonly boundary: boolean;
  readonly water: boolean;
  readonly sediment: boolean;
}

export const DEFAULT_INK_LAYERS: InkLayers = Object.freeze({
  contours: true,
  hachures: true,
  boundary: true,
  water: true,
  sediment: true,
});

export interface InkViewOptions {
  /** Contour interval (unit: metres). Required: the spread configures it, and the page may bind it. */
  readonly contourIntervalM: number;
  /** Every n-th contour is an index contour. Default 5. */
  readonly indexEvery?: number;
  /** Vertical scale at full lift (unit: none; 1 = true scale). The page should state it if it is not 1. */
  readonly reliefScale?: number;
  readonly camera?: Partial<CameraPose>;
  /** Fixed frame (datum and relief headroom). Default: taken from the first state. */
  readonly frame?: TerrainFrame;
  readonly channels?: { readonly water?: Partial<ChannelRamp>; readonly sediment?: Partial<ChannelRamp> };
  readonly hachures?: HachureOptions;
  readonly layers?: Partial<InkLayers>;
  /** Default "auto": WebGPU where available, otherwise WebGL2. */
  readonly backend?: InkBackendRequest;
  /** MSAA. Default true. */
  readonly antialias?: boolean;
  /** Cap on device pixels per CSS pixel. Default 2. */
  readonly maxPixelRatio?: number;
  /** Called when the GPU device or WebGL context is lost. The page should fall back to the flat SVG. */
  readonly onContextLost?: (message: string) => void;
}

/** A surface without a solver: a heightfield plus optional overlay layers, sample-aligned. */
export interface InkSurfaceState {
  readonly heightfield: Heightfield;
  readonly waterM?: Float32Array;
  readonly sedimentM?: Float32Array;
}

export type InkStateInput = StateSnapshot | InkSurfaceState;

export interface InkViewStats {
  readonly gridSize: number;
  readonly contourLines: number;
  readonly contourSegments: number;
  readonly hachures: number;
  /** CPU time of the last `setState`: contours, hachures and buffer packing (unit: milliseconds). */
  readonly lastUpdateMs: number;
}

export interface InkView {
  /** Creates the renderer on this canvas. Resolves when the backend is ready. */
  mount(canvas: HTMLCanvasElement): Promise<void>;
  /** Draws a new state. Before `mount`, the state is kept and drawn on mount. */
  setState(state: InkStateInput): void;
  /** Vertical exaggeration, clamped to [0, 1]. 0 is the flat page drawing. */
  setExaggeration(t: number): void;
  /** Changes the camera; missing fields keep their current value. */
  setCamera(pose: Partial<CameraPose>): void;
  setLayers(layers: Partial<InkLayers>): void;
  /** Applies a lift-sequence state: exaggeration plus hachure and overlay visibility. */
  applyLiftState(state: LiftState): void;
  /** Re-reads the canvas size. Called automatically by a ResizeObserver after mount. */
  resize(): void;
  /** Compiles pending pipelines and renders one complete frame. */
  renderNow(): Promise<void>;
  /** The shared projection for the current frame, pose and canvas size; `null` before the first state. */
  projection(): Projection | null;
  legend(): LegendToken[];
  readonly backend: InkBackend | null;
  readonly exaggeration: number;
  /** Vertical scale currently shown: exaggeration × reliefScale (unit: none). Bindable on the page. */
  readonly verticalExaggeration: number;
  readonly camera: CameraPose;
  readonly layers: InkLayers;
  readonly frame: TerrainFrame | null;
  readonly contours: ContourSet | null;
  readonly heightfield: Heightfield | null;
  readonly stats: InkViewStats;
  dispose(): void;
}

/** Snapshot layers the view reads: height, plus the default channel layers. */
export const INK_VIEW_LAYERS: readonly LayerName[] = Object.freeze([
  "bedrockM",
  "sedimentM",
  "waterM",
  "suspendedSedimentM",
]);

class InkViewImpl implements InkView {
  private readonly options: InkViewOptions;
  private readonly channels: ChannelConfig;
  private readonly uniforms: InkUniforms = createInkUniforms();
  private readonly scene = new Scene();
  private readonly cam = new OrthographicCamera();
  private readonly terrain: TerrainMesh;
  private readonly contourLayer: StrokeLayer;
  private readonly hachureLayer: StrokeLayer;
  private readonly boundaryLayer: StrokeLayer;
  private readonly packedContours = new StrokeBuffer();
  private readonly packedHachures = new StrokeBuffer();
  private readonly packedBoundary = new StrokeBuffer();
  private renderer: WebGPURenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private observer: ResizeObserver | null = null;
  private frameHandle = 0;
  private disposed = false;
  private pose: CameraPose;
  private layerState: InkLayers;
  private exag = 0;
  private currentFrame: TerrainFrame | null;
  private hf: Heightfield | null = null;
  private heightBuffer: Float32Array | undefined;
  private contourSet: ContourSet | null = null;
  private pendingUpload: { water?: Float32Array; sediment?: Float32Array } | null = null;
  private lastStats: InkViewStats = {
    gridSize: 0,
    contourLines: 0,
    contourSegments: 0,
    hachures: 0,
    lastUpdateMs: 0,
  };
  private activeBackend: InkBackend | null = null;
  private readonly onContextLostDom = (event: Event) => {
    event.preventDefault();
    this.options.onContextLost?.("WebGL context lost");
  };

  constructor(options: InkViewOptions) {
    if (!(options.contourIntervalM > 0)) throw new RangeError("contourIntervalM must be positive");
    this.options = options;
    this.channels = resolveChannels(options.channels);
    applyChannelUniforms(this.uniforms, this.channels);
    this.uniforms.reliefScale.value = options.reliefScale ?? 1;
    this.pose = resolveCameraPose(options.camera);
    this.layerState = { ...DEFAULT_INK_LAYERS, ...options.layers };
    this.currentFrame = options.frame ?? null;
    this.terrain = new TerrainMesh(createTerrainMaterial(this.uniforms, this.channels));
    const strokeMaterial = createStrokeMaterial(this.uniforms);
    this.contourLayer = new StrokeLayer(strokeMaterial);
    this.hachureLayer = new StrokeLayer(strokeMaterial);
    this.boundaryLayer = new StrokeLayer(strokeMaterial);
    this.terrain.mesh.renderOrder = 0;
    for (const layer of [this.contourLayer, this.hachureLayer, this.boundaryLayer])
      layer.mesh.renderOrder = 1;
    this.scene.add(
      this.terrain.mesh,
      this.contourLayer.mesh,
      this.hachureLayer.mesh,
      this.boundaryLayer.mesh,
    );
    this.scene.background = new Color(INK_TOKENS.paper);
    this.applyLayerVisibility();
  }

  get backend(): InkBackend | null {
    return this.activeBackend;
  }
  get exaggeration(): number {
    return this.exag;
  }
  get verticalExaggeration(): number {
    return this.exag * (this.options.reliefScale ?? 1);
  }
  get camera(): CameraPose {
    return this.pose;
  }
  get layers(): InkLayers {
    return this.layerState;
  }
  get frame(): TerrainFrame | null {
    return this.currentFrame;
  }
  get contours(): ContourSet | null {
    return this.contourSet;
  }
  get heightfield(): Heightfield | null {
    return this.hf;
  }
  get stats(): InkViewStats {
    return this.lastStats;
  }

  private live(): void {
    if (this.disposed) throw new Error("InkView has been disposed");
  }

  async mount(canvas: HTMLCanvasElement): Promise<void> {
    this.live();
    if (this.renderer) throw new Error("InkView is already mounted");
    const request = this.options.backend ?? "auto";
    const renderer = new WebGPURenderer({
      canvas,
      antialias: this.options.antialias ?? true,
      forceWebGL: request === "webgl2",
    });
    await renderer.init();
    if (this.disposed) {
      renderer.dispose();
      return;
    }
    const isWebGPU = (renderer.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;
    this.activeBackend = isWebGPU ? "webgpu" : "webgl2";
    if (request === "webgpu" && !isWebGPU) {
      renderer.dispose();
      throw new Error("WebGPU was requested but is not available");
    }
    renderer.setClearColor(new Color(INK_TOKENS.paper), 1);
    renderer.onDeviceLost = (info) => this.options.onContextLost?.(`GPU device lost: ${info.message}`);
    canvas.addEventListener("webglcontextlost", this.onContextLostDom);
    this.renderer = renderer;
    this.canvas = canvas;
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(canvas);
    }
    this.resize();
    this.upload();
    this.requestRender();
  }

  setState(state: InkStateInput): void {
    this.live();
    const t0 = performance.now();
    let water: Float32Array | undefined;
    let sediment: Float32Array | undefined;
    let hf: Heightfield;
    if ("heightfield" in state) {
      hf = state.heightfield;
      water = state.waterM;
      sediment = state.sedimentM;
    } else {
      hf = heightfieldFromSnapshot(state, this.heightBuffer);
      this.heightBuffer = hf.heightsM;
      water = state.layers[this.channels.water.layer];
      sediment = state.layers[this.channels.sediment.layer];
    }
    const gridChanged =
      !this.currentFrame ||
      this.currentFrame.gridSize !== hf.gridSize ||
      this.currentFrame.metresPerCell !== hf.metresPerCell;
    if (gridChanged)
      this.currentFrame =
        this.options.frame?.gridSize === hf.gridSize ? this.options.frame : terrainFrameFromHeightfield(hf);
    this.hf = hf;
    this.contourSet = extractContours(hf, this.options.contourIntervalM, {
      indexEvery: this.options.indexEvery ?? 5,
    });
    const hachures = extractHachures(hf, this.options.hachures);
    this.pendingUpload = { ...(water ? { water } : {}), ...(sediment ? { sediment } : {}) };
    this.packStrokes(hachures.strokesM);
    this.lastStats = {
      gridSize: hf.gridSize,
      contourLines: this.contourSet.lines.length,
      contourSegments: contourSegmentCount(this.contourSet),
      hachures: hachures.count,
      lastUpdateMs: performance.now() - t0,
    };
    if (gridChanged) this.updateCamera();
    this.upload();
    this.requestRender();
  }

  private packStrokes(hachuresM: Float64Array): void {
    const hf = this.hf!;
    this.packedContours.reset();
    this.packedContours.pushContours(this.contourSet!);
    this.packedHachures.reset();
    this.packedHachures.pushStrokes(hachuresM, INK_TOKENS.hachureWidthPx);
    this.packedBoundary.reset();
    const n = hf.gridSize;
    const m = hf.metresPerCell;
    const ring: number[] = [];
    const add = (x: number, y: number) => ring.push((x + 0.5) * m, (y + 0.5) * m, hf.heightsM[y * n + x]!);
    for (let x = 0; x < n - 1; x++) add(x, 0);
    for (let y = 0; y < n - 1; y++) add(n - 1, y);
    for (let x = n - 1; x > 0; x--) add(x, n - 1);
    for (let y = n - 1; y > 0; y--) add(0, y);
    this.packedBoundary.pushPolyline(ring, true, INK_TOKENS.indexContourWidthPx);
  }

  /** Sends the packed state to the GPU buffers. No-op until mounted. */
  private upload(): void {
    if (!this.renderer || !this.hf || !this.pendingUpload) return;
    this.terrain.update(this.hf, this.pendingUpload.water, this.pendingUpload.sediment);
    this.contourLayer.update(this.packedContours);
    this.hachureLayer.update(this.packedHachures);
    this.boundaryLayer.update(this.packedBoundary);
    this.pendingUpload = null;
    const frame = this.currentFrame!;
    this.uniforms.datumM.value = frame.datumM;
    this.uniforms.halfWidthM.value = (frame.gridSize * frame.metresPerCell) / 2;
    this.applyLayerVisibility();
  }

  setExaggeration(t: number): void {
    this.live();
    this.exag = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
    this.uniforms.exaggeration.value = this.exag;
    this.requestRender();
  }

  setCamera(pose: Partial<CameraPose>): void {
    this.live();
    this.pose = resolveCameraPose({ ...this.pose, ...pose });
    this.updateCamera();
    this.requestRender();
  }

  setLayers(layers: Partial<InkLayers>): void {
    this.live();
    this.layerState = { ...this.layerState, ...layers };
    this.applyLayerVisibility();
    this.requestRender();
  }

  applyLiftState(state: LiftState): void {
    this.setLayers({ hachures: state.overlays, water: state.overlays, sediment: state.overlays });
    this.setExaggeration(state.exaggeration);
  }

  private applyLayerVisibility(): void {
    const l = this.layerState;
    this.contourLayer.mesh.visible = l.contours && this.contourLayer.count > 0;
    this.hachureLayer.mesh.visible = l.hachures && this.hachureLayer.count > 0;
    this.boundaryLayer.mesh.visible = l.boundary && this.boundaryLayer.count > 0;
    this.uniforms.waterOn.value = l.water ? 1 : 0;
    this.uniforms.sedimentOn.value = l.sediment ? 1 : 0;
  }

  private viewport(): { widthPx: number; heightPx: number } | null {
    const c = this.canvas;
    if (!c) return null;
    const widthPx = c.clientWidth || c.width;
    const heightPx = c.clientHeight || c.height;
    return widthPx > 0 && heightPx > 0 ? { widthPx, heightPx } : null;
  }

  projection(): Projection | null {
    const viewport = this.viewport();
    if (!this.currentFrame || !viewport) return null;
    return createProjection(this.currentFrame, this.pose, viewport, this.options.reliefScale ?? 1);
  }

  private updateCamera(): void {
    const p = this.projection();
    if (p) cameraFromProjection(p, this.cam);
  }

  resize(): void {
    if (!this.renderer) return;
    const viewport = this.viewport();
    if (!viewport) return;
    const ratio = Math.min(globalThis.devicePixelRatio || 1, this.options.maxPixelRatio ?? 2);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(viewport.widthPx, viewport.heightPx, false);
    this.uniforms.pixelRatio.value = ratio;
    this.uniforms.resolutionPx.value.set(
      Math.max(1, Math.floor(viewport.widthPx * ratio)),
      Math.max(1, Math.floor(viewport.heightPx * ratio)),
    );
    this.updateCamera();
    this.requestRender();
  }

  private requestRender(): void {
    if (!this.renderer || this.frameHandle || this.disposed) return;
    const schedule =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (cb: () => void) => setTimeout(cb, 16);
    this.frameHandle = schedule(() => {
      this.frameHandle = 0;
      this.draw();
    }) as unknown as number;
  }

  private draw(): void {
    if (!this.renderer || this.disposed || !this.hf) return;
    this.renderer.render(this.scene, this.cam);
  }

  async renderNow(): Promise<void> {
    this.live();
    if (!this.renderer || !this.hf) return;
    await this.renderer.compileAsync(this.scene, this.cam);
    this.draw();
  }

  legend(): LegendToken[] {
    return legendTokens(this.channels);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frameHandle && typeof cancelAnimationFrame === "function")
      cancelAnimationFrame(this.frameHandle);
    this.observer?.disconnect();
    this.canvas?.removeEventListener("webglcontextlost", this.onContextLostDom);
    this.terrain.dispose();
    this.contourLayer.dispose();
    this.hachureLayer.dispose();
    this.boundaryLayer.dispose();
    (this.terrain.mesh.material as { dispose(): void }).dispose();
    (this.contourLayer.mesh.material as { dispose(): void }).dispose();
    this.renderer?.dispose();
    this.renderer = null;
  }
}

/** Creates an ink view. Call `mount(canvas)` before it draws. */
export function createInkView(options: InkViewOptions): InkView {
  return new InkViewImpl(options);
}
