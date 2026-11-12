/**
 * The book stage: DOM pages under a CSS 3D tilt, and one WebGL canvas whose camera matches the page, so a
 * diorama stands on the right page, casts a shadow on the paper and may rise above the figure frame.
 * Text stays DOM. Phones, reduced motion and large zoom get the flat fallback: no tilt, and the scene
 * drawn inside the figure frame.
 *
 * ```ts
 * const diorama = createValleyDiorama({ reliefScale: 1 });
 * const stage = createBookStage({ host, book, anchor, diorama });
 * await stage.mount();
 * diorama.setSnapshot(snapshot, start);
 * runTransition((s) => stage.applyTransition(s));
 * ```
 *
 * The stage renders on demand (after a change), never in a free-running loop, and owns no model state.
 */
import {
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
} from "three";
import { MeshBasicNodeMaterial, ShadowNodeMaterial, WebGPURenderer } from "three/webgpu";
import type { TransitionState } from "../transition/index";
import { NATURAL_TOKENS } from "../materials/natural/palette";
import {
  type Rect,
  type StageGeometry,
  bookTransformCss,
  pageFrameMatrix,
  stageCamera,
  tiltedBookFits,
} from "./camera-match";
import type { ValleyDiorama } from "./diorama";

/** Presentation bounds: keep the reader above the paper and in front of the book. */
export const BOOK_VIEW_LIMITS = {
  minTiltDeg: 20,
  maxTiltDeg: 68,
  minOrbitDeg: -24,
  maxOrbitDeg: 24,
  minZoom: 1,
  maxZoom: 1.5,
} as const;
export interface BookView {
  readonly tiltDeg: number;
  readonly orbitDeg: number;
  readonly zoom: number;
}
export function clampBookView(view: BookView): BookView {
  return {
    zoom: Math.min(
      BOOK_VIEW_LIMITS.maxZoom,
      Math.max(BOOK_VIEW_LIMITS.minZoom, Number.isFinite(view.zoom) ? view.zoom : 1),
    ),
    tiltDeg: Math.min(
      BOOK_VIEW_LIMITS.maxTiltDeg,
      Math.max(BOOK_VIEW_LIMITS.minTiltDeg, Number.isFinite(view.tiltDeg) ? view.tiltDeg : 48),
    ),
    orbitDeg: Math.min(
      BOOK_VIEW_LIMITS.maxOrbitDeg,
      Math.max(BOOK_VIEW_LIMITS.minOrbitDeg, Number.isFinite(view.orbitDeg) ? view.orbitDeg : 0),
    ),
  };
}

export type StageMode = "tilted" | "flat";
export type StageModeRequest = StageMode | "auto";
export type StageBackendRequest = "auto" | "webgpu" | "webgl2";

/** Media conditions that select the flat fallback (phones, large zoom, short screens, reduced motion). */
export const FLAT_STAGE_QUERY =
  "(max-width: 60rem), (max-height: 34rem), (prefers-reduced-motion: reduce), (forced-colors: active)";

export interface BookStageOptions {
  /** The stage viewport: the desk. Gets `perspective`; the canvas covers it in tilted mode. */
  readonly host: HTMLElement;
  /** The element tilted in 3D (the open book). Must be a descendant of `host`. */
  readonly book: HTMLElement;
  /** The figure frame on the right page that the diorama stands in. Must be a descendant of `book`. */
  readonly anchor: HTMLElement;
  readonly diorama: ValleyDiorama;
  /** Book tilt (unit: degrees). Default 48. */
  readonly tiltDeg?: number;
  /** CSS perspective as a multiple of the stage's larger side (unit: none). Default 1.25. */
  readonly perspectiveFactor?: number;
  /** Fraction of the anchor box the block's footprint may fill (unit: none). Default 1. */
  readonly footprintFill?: number;
  /**
   * Turn of the block on the page, about the page normal (unit: degrees). Negative turns its front face
   * to the left, so the right side shows as well, the three-quarter view of a textbook block diagram.
   * Default −24. View-only.
   */
  readonly yawDeg?: number;
  /** Default "auto": flat when `flatQuery` matches or the tilted book does not fit. */
  readonly mode?: StageModeRequest;
  readonly flatQuery?: string;
  readonly backend?: StageBackendRequest;
  /** Cap on device pixels per CSS pixel. Default 2. */
  readonly maxPixelRatio?: number;
  readonly onModeChange?: (mode: StageMode) => void;
  /** GPU device or WebGL context lost. The page should show its static drawing. */
  readonly onContextLost?: (message: string) => void;
}

export interface BookStage {
  readonly mode: StageMode;
  readonly view: BookView;
  /** View-only orbit; never touches a snapshot or solver. */
  setView(view: Partial<BookView>): void;
  readonly backend: "webgpu" | "webgl2" | null;
  readonly canvas: HTMLCanvasElement;
  /** Creates the renderer. Resolves when the backend is ready. Rejects if no GPU path is available. */
  mount(): Promise<void>;
  setMode(request: StageModeRequest): void;
  /** Applies a transition state to the canvas and the diorama. The host handles its own DOM drawing. */
  applyTransition(state: TransitionState): void;
  /** Re-measures the page and anchor. Called automatically on resize. */
  relayout(): void;
  requestRender(): void;
  /** Compiles pipelines and renders one complete frame. */
  renderNow(): Promise<void>;
  /**
   * Viewport (client) coordinates of points given in the diorama's block-local metres (X across, Y up from
   * the base, Z along the valley; see `ValleyDiorama.footprint`), through the current camera. `null` for a
   * point behind the camera, and for every point before `mount()`. For hit tests and DOM overlays (session
   * 5K); view-only.
   */
  projectBlockPoints(
    points: readonly (readonly [number, number, number])[],
  ): ({ x: number; y: number } | null)[];
  dispose(): void;
}

/** Book-local layout offset of `el` (ignores transforms), walking the offsetParent chain to `ancestor`. */
function layoutRect(el: HTMLElement, ancestor: HTMLElement): Rect {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    const parent = node.offsetParent as HTMLElement | null;
    if (parent && parent !== ancestor && !ancestor.contains(parent)) {
      throw new Error("The stage anchor's offset chain must pass through the book element");
    }
    node = parent;
  }
  if (node !== ancestor) throw new Error("The stage element is not positioned inside its ancestor");
  return { x, y, width: el.offsetWidth, height: el.offsetHeight };
}

/** A soft, blurred footprint used as the contact shadow right under the block. */
function contactShadowTexture(): CanvasTexture {
  const size = 256;
  const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
  const ctx = canvas.getContext("2d")!;
  ctx.filter = "blur(18px)";
  ctx.fillStyle = "#000";
  ctx.fillRect(size * 0.16, size * 0.16, size * 0.68, size * 0.68);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  return t;
}

class BookStageImpl implements BookStage {
  readonly canvas: HTMLCanvasElement;
  private readonly o: BookStageOptions;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera();
  /** Page-local frame (X right, Y up out of the paper, Z down the page); identity in flat mode. */
  private readonly page = new Group();
  /** Holds the diorama; scaled from block metres to page pixels (tilted) or kept in metres (flat). */
  private readonly holder = new Group();
  private readonly light = new DirectionalLight(0xffffff, 1);
  private readonly lightTarget = new Object3D();
  private readonly catcher: Mesh;
  private readonly contact: Mesh;
  private renderer: WebGPURenderer | null = null;
  private activeBackend: "webgpu" | "webgl2" | null = null;
  private currentMode: StageMode = "flat";
  private request: StageModeRequest;
  private currentView: BookView;
  private media: MediaQueryList | null = null;
  private observer: ResizeObserver | null = null;
  private frameHandle = 0;
  private disposed = false;
  private readonly onResize = () => this.setMode(this.request);
  private readonly onMedia = () => this.setMode(this.request);
  private readonly onContextLostDom = (event: Event) => {
    event.preventDefault();
    this.o.onContextLost?.("WebGL context lost");
  };

  constructor(options: BookStageOptions) {
    this.o = options;
    this.currentView = clampBookView({ tiltDeg: options.tiltDeg ?? 48, orbitDeg: 0, zoom: 1 });
    this.request = options.mode ?? "auto";
    this.canvas = document.createElement("canvas");
    this.canvas.className = "hachure-stage-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      maxWidth: "none",
      maxHeight: "none",
      border: "0",
      pointerEvents: "none",
      opacity: "0",
      zIndex: "2",
    });
    this.page.matrixAutoUpdate = false;
    this.catcher = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new ShadowNodeMaterial());
    (this.catcher.material as ShadowNodeMaterial).opacity = 0.22;
    (this.catcher.material as ShadowNodeMaterial).color = new Color(NATURAL_TOKENS.shadow);
    this.catcher.receiveShadow = true;
    const contactMaterial = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    contactMaterial.color = new Color(NATURAL_TOKENS.shadow);
    contactMaterial.alphaMap = contactShadowTexture();
    contactMaterial.opacity = 0.32;
    this.contact = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), contactMaterial);
    this.contact.renderOrder = -1;
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    this.light.shadow.bias = -0.0004;
    this.light.shadow.normalBias = 0.5;
    this.light.target = this.lightTarget;
    this.holder.add(options.diorama.group);
    this.holder.add(this.contact);
    this.page.add(this.catcher, this.holder, this.light, this.lightTarget);
    this.scene.add(this.page);
    options.diorama.onChange = () => {
      this.relayoutHolder();
      this.requestRender();
    };
  }

  get view(): BookView {
    return { ...this.currentView };
  }

  setView(view: Partial<BookView>): void {
    this.currentView = clampBookView({ ...this.currentView, ...view });
    this.relayout();
  }

  get mode(): StageMode {
    return this.currentMode;
  }
  get backend() {
    return this.activeBackend;
  }

  async mount(): Promise<void> {
    if (this.renderer) throw new Error("The book stage is already mounted");
    const request = this.o.backend ?? "auto";
    const renderer = new WebGPURenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      forceWebGL: request === "webgl2",
    });
    await renderer.init();
    if (this.disposed) {
      renderer.dispose();
      return;
    }
    const isWebGPU = (renderer.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;
    if (request === "webgpu" && !isWebGPU) {
      renderer.dispose();
      throw new Error("WebGPU was requested but is not available");
    }
    this.activeBackend = isWebGPU ? "webgpu" : "webgl2";
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.onDeviceLost = (info) => this.o.onContextLost?.(`GPU device lost: ${info.message}`);
    this.canvas.addEventListener("webglcontextlost", this.onContextLostDom);
    this.renderer = renderer;
    this.media = matchMedia(this.o.flatQuery ?? FLAT_STAGE_QUERY);
    this.media.addEventListener("change", this.onMedia);
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(this.onResize);
      this.observer.observe(this.o.host);
      this.observer.observe(this.o.anchor);
      this.observer.observe(this.o.book);
    }
    window.addEventListener("resize", this.onResize);
    window.visualViewport?.addEventListener("resize", this.onResize);
    this.setMode(this.request);
  }

  setMode(request: StageModeRequest): void {
    this.request = request;
    const { host, book } = this.o;
    const mode: StageMode = request === "auto" ? (this.prefersFlat() ? "flat" : "tilted") : request;
    if (mode === "tilted") {
      this.applyTilted();
      // geometry() fits the paper; media conditions choose the readable flat layout.
    }
    if (mode === "flat") {
      host.style.perspective = "";
      host.style.perspectiveOrigin = "";
      book.style.transform = "";
      book.style.transformOrigin = "";
      host.dataset.stageMode = "flat";
      // Slightly larger than the frame so the cast shadow is not clipped at the frame edge.
      Object.assign(this.canvas.style, { inset: "-3% auto auto -6%", width: "116%", height: "109%" });
      this.o.anchor.append(this.canvas);
    }
    const changed = mode !== this.currentMode;
    this.currentMode = mode;
    this.relayout();
    if (changed) this.o.onModeChange?.(mode);
  }

  private prefersFlat(): boolean {
    if (this.media?.matches) return true;
    // Large default text size (a reader's zoom preference) also gets the readable flat page.
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return rootPx >= 24;
  }

  private applyTilted(): void {
    const { host, book } = this.o;
    host.dataset.stageMode = "tilted";
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    if (getComputedStyle(book).position === "static") book.style.position = "relative";
    const g = this.geometry();
    host.style.perspective = `${g.perspectivePx}px`;
    host.style.perspectiveOrigin = "50% 50%";
    book.style.transformOrigin = `50% 50% ${g.pivotHeightPx}px`;
    book.style.transform = bookTransformCss(g.tiltDeg, g.orbitDeg, g.viewScale);
    this.sizeTiltedCanvas();
    host.append(this.canvas);
  }

  private geometry(): StageGeometry {
    const { host, book } = this.o;
    const widthPx = host.clientWidth;
    const heightPx = host.clientHeight;
    const geometry = {
      widthPx,
      heightPx,
      perspectivePx: Math.round(Math.max(widthPx, heightPx) * (this.o.perspectiveFactor ?? 1.25)),
      book: layoutRect(book, host),
      tiltDeg: this.currentView.tiltDeg,
      orbitDeg: this.currentView.orbitDeg,
      pivotHeightPx: Math.min(book.offsetWidth, book.offsetHeight) * 0.06,
      viewScale: 1,
    };
    // Reserve space for the physical binding beyond the DOM paper rectangle.
    while (geometry.viewScale > 0.55 && !tiltedBookFits(geometry, 64, 0)) geometry.viewScale *= 0.98;
    geometry.viewScale *= this.currentView.zoom;
    return geometry;
  }

  /**
   * The tilted canvas covers the host exactly, sized in pixels: percentage sizes of an absolutely
   * positioned child resolve against the grid area when the host is a grid container.
   */
  private sizeTiltedCanvas(): void {
    const { host } = this.o;
    Object.assign(this.canvas.style, {
      inset: "auto",
      left: "0",
      top: "0",
      width: `${host.clientWidth}px`,
      height: `${host.clientHeight}px`,
    });
  }

  relayout(): void {
    if (!this.renderer || this.disposed) return;
    if (this.currentMode === "tilted") this.sizeTiltedCanvas();
    const canvasW = this.canvas.clientWidth;
    const canvasH = this.canvas.clientHeight;
    if (!canvasW || !canvasH) return;
    if (this.currentMode === "tilted") {
      const g = this.geometry();
      this.o.host.style.perspective = `${g.perspectivePx}px`;
      this.o.book.style.transformOrigin = `50% 50% ${g.pivotHeightPx}px`;
      this.o.book.style.transform = bookTransformCss(g.tiltDeg, g.orbitDeg, g.viewScale);
      this.camera.zoom = 1;
      const cam = stageCamera(g);
      this.camera.fov = cam.fovDeg;
      this.camera.aspect = cam.aspect;
      this.camera.near = cam.near;
      this.camera.far = cam.far;
      this.camera.position.set(...cam.position);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(new Vector3(...cam.target));
      this.page.matrix.fromArray(pageFrameMatrix(g));
    } else {
      this.page.matrix.identity();
    }
    this.page.matrixWorldNeedsUpdate = true;
    const ratio = Math.min(globalThis.devicePixelRatio || 1, this.o.maxPixelRatio ?? 2);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(canvasW, canvasH, false);
    this.o.diorama.setViewport(ratio, Math.floor(canvasW * ratio), Math.floor(canvasH * ratio));
    this.relayoutHolder();
    this.requestRender();
  }

  /** Places and scales the diorama, the shadow planes and the light for the current mode. */
  private relayoutHolder(): void {
    const fp = this.o.diorama.footprint();
    if (!fp || !this.renderer) return;
    const fill = this.o.footprintFill ?? 1;
    const yaw = ((this.o.yawDeg ?? -24) * Math.PI) / 180;
    this.holder.rotation.set(0, yaw, 0);
    // Footprint of the turned block, for fitting it to the frame.
    const spanX = fp.widthM * Math.abs(Math.cos(yaw)) + fp.depthM * Math.abs(Math.sin(yaw));
    const spanZ = fp.widthM * Math.abs(Math.sin(yaw)) + fp.depthM * Math.abs(Math.cos(yaw));
    let scale: number;
    let centre: Vector3;
    if (this.currentMode === "tilted") {
      const a = layoutRect(this.o.anchor, this.o.book);
      // The block's footprint fits the frame; its front edge sits near the frame's lower edge, so the
      // relief rises up the page (and may rise past the frame) rather than over the caption.
      scale = Math.min((a.width * fill) / spanX, (a.height * fill) / spanZ);
      centre = new Vector3(a.x + a.width / 2, 0, a.y + a.height - (spanZ * scale) / 2);
      const b = layoutRect(this.o.book, this.o.host);
      this.catcher.scale.set(b.width, 1, b.height);
      this.catcher.position.set(b.width / 2, 0.2, b.height / 2);
    } else {
      scale = 1;
      centre = new Vector3(0, 0, 0);
      const span = Math.max(spanX, spanZ) * 3;
      this.catcher.scale.set(span, 1, span);
      this.catcher.position.set(0, 0, 0);
      this.fitFlatCamera({ widthM: spanX, heightM: fp.heightM, depthM: spanZ });
    }
    this.holder.position.copy(centre);
    this.holder.scale.setScalar(scale);
    // Contact shadow under the visible (cut) block, in block-local metres.
    const visibleDepth = fp.frontZ - fp.backZ;
    this.contact.scale.set(fp.widthM * 1.3, 1, visibleDepth + fp.widthM * 0.3);
    this.contact.position.set(0, fp.heightM * 0.001, (fp.frontZ + fp.backZ) / 2);
    // Light from the upper left, behind the page top: shadows fall right and towards the reader.
    const radius = Math.hypot(fp.widthM, fp.depthM, fp.heightM) * scale;
    const dir = this.o.diorama.uniforms.lightDir.value;
    this.lightTarget.position.copy(centre);
    this.light.position.copy(centre).addScaledVector(dir, radius * 2);
    const cam = this.light.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = radius * 0.2;
    cam.far = radius * 4;
    cam.updateProjectionMatrix();
    this.light.shadow.normalBias = radius * 0.002;
  }

  private fitFlatCamera(fp: { widthM: number; heightM: number; depthM: number }): void {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.camera.fov = 26;
    this.camera.zoom = this.currentView.zoom;
    this.camera.aspect = w / h;
    const centre = new Vector3(0, fp.heightM * 0.4, 0);
    const radius = Math.hypot(fp.widthM, fp.depthM, fp.heightM) / 2;
    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const distance = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 0.88;
    // From the front and above; the block's yaw gives the three-quarter view, as on the tilted page.
    const elevation = ((90 - this.currentView.tiltDeg) * Math.PI) / 180;
    const azimuth = (-this.currentView.orbitDeg * Math.PI) / 180;
    this.camera.position.set(
      centre.x + distance * Math.cos(elevation) * Math.sin(azimuth),
      centre.y + distance * Math.sin(elevation),
      centre.z + distance * Math.cos(elevation) * Math.cos(azimuth),
    );
    this.camera.near = distance * 0.1;
    this.camera.far = distance * 4;
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(centre);
  }

  applyTransition(state: TransitionState): void {
    this.canvas.style.opacity = String(state.sceneOpacity);
    this.o.diorama.setReveal(state);
  }

  requestRender(): void {
    if (!this.renderer || this.frameHandle || this.disposed) return;
    this.frameHandle = requestAnimationFrame(() => {
      this.frameHandle = 0;
      this.draw();
    });
  }

  private draw(): void {
    if (!this.renderer || this.disposed) return;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  projectBlockPoints(
    points: readonly (readonly [number, number, number])[],
  ): ({ x: number; y: number } | null)[] {
    if (!this.renderer || this.disposed) return points.map(() => null);
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    this.camera.updateProjectionMatrix();
    const rect = this.canvas.getBoundingClientRect();
    const world = this.o.diorama.group.matrixWorld;
    const v = new Vector3();
    return points.map(([x, y, z]) => {
      v.set(x, y, z).applyMatrix4(world).project(this.camera);
      if (!Number.isFinite(v.x) || v.z < -1 || v.z > 1) return null;
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    });
  }

  async renderNow(): Promise<void> {
    if (!this.renderer) return;
    this.camera.updateProjectionMatrix();
    await this.renderer.compileAsync(this.scene, this.camera);
    this.draw();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frameHandle) cancelAnimationFrame(this.frameHandle);
    this.observer?.disconnect();
    window.removeEventListener("resize", this.onResize);
    window.visualViewport?.removeEventListener("resize", this.onResize);
    this.media?.removeEventListener("change", this.onMedia);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLostDom);
    const { host, book } = this.o;
    host.style.perspective = "";
    host.style.perspectiveOrigin = "";
    book.style.transform = "";
    book.style.transformOrigin = "";
    delete host.dataset.stageMode;
    this.canvas.remove();
    this.catcher.geometry.dispose();
    (this.catcher.material as ShadowNodeMaterial).dispose();
    this.contact.geometry.dispose();
    const contactMaterial = this.contact.material as MeshBasicNodeMaterial;
    contactMaterial.alphaMap?.dispose();
    contactMaterial.dispose();
    this.renderer?.dispose();
    this.renderer = null;
  }
}

/** Creates a book stage. Call `mount()` before it draws. */
export function createBookStage(options: BookStageOptions): BookStage {
  return new BookStageImpl(options);
}
