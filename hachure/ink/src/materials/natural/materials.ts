/**
 * Natural, cel-shaded materials for illustrative landscape blocks (TSL: WGSL on WebGPU, GLSL on WebGL2).
 *
 * Shading is banded, not smooth: three tones (lit, half, shade) from the angle to one fixed light. That
 * reads as a painted illustration rather than a photograph, and survives the paper-to-colour wash: every
 * material mixes from a paper tone (with the same bands, like pencil shading) to its natural colour by one
 * shared `colour` uniform, which the drawing → ink → colour transition drives.
 *
 * The materials are unlit three.js node materials with their own light term, so they do not depend on scene
 * lights; the paper shadow-catcher uses a real directional light and shadow map (see `stage/`).
 */
import { CanvasTexture, Color, DoubleSide, RepeatWrapping, SRGBColorSpace, Vector3 } from "three";
import type { Texture } from "three";
import { attribute, float, mix, normalLocal, normalize, step, texture, uniform, vec2, vec3 } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import type { Node } from "three/webgpu";
import { type LithologyLook, paintLithologyTile } from "./lithology";
import { NATURAL_TOKENS } from "./palette";

/** Linear-light RGB of an sRGB hex colour, as a vector (uniform-friendly). */
function linear(hex: string): Vector3 {
  const col = new Color(hex);
  return new Vector3(col.r, col.g, col.b);
}

/** Uniforms shared by every natural material in one scene. */
export function createNaturalUniforms() {
  return {
    /** Colour wash (unit: none): 0 = paper with pencil-like bands, 1 = full natural colour. */
    colour: uniform(1),
    /** Direction towards the light, in the block's local frame (unit vector). */
    lightDir: uniform(new Vector3(-0.42, 0.95, -0.3).normalize()),
    /** Lit and shade colours of the current rock (set from its lithology look). */
    rockLit: uniform(linear("#B9AFA7")),
    rockShade: uniform(linear("#8F857E")),
  };
}

export type NaturalUniforms = ReturnType<typeof createNaturalUniforms>;

/** A linear-light constant colour from sRGB hex. */
const c = (hex: string): Node<"vec3"> => {
  const col = new Color(hex);
  return vec3(col.r, col.g, col.b);
};

/** Three-tone band of the light term: 0 (shade), 0.5 (half) or 1 (lit). */
function lightBand(u: NaturalUniforms): Node<"float"> {
  const nl = normalize(normalLocal).dot(u.lightDir).max(0);
  return step(0.22, nl).mul(0.5).add(step(0.58, nl).mul(0.5));
}

function tone(band: Node<"float">, lit: Node<"vec3">, shade: Node<"vec3">): Node<"vec3"> {
  return mix(shade, lit, band);
}

/** Paper with the same bands (a pencil-shaded white) washing to `natural` as `colour` rises. */
function wash(u: NaturalUniforms, band: Node<"float">, natural: Node<"vec3">): Node<"vec3"> {
  const paper = c(NATURAL_TOKENS.paper).mul(float(0.84).add(band.mul(0.16)));
  return mix(paper, natural, u.colour);
}

function basic(): MeshBasicNodeMaterial {
  const m = new MeshBasicNodeMaterial({ side: DoubleSide });
  // Strokes lying exactly on a surface must win the depth test.
  m.polygonOffset = true;
  m.polygonOffsetFactor = 1;
  m.polygonOffsetUnits = 1;
  return m;
}

/**
 * The land surface: bare rock in the current rock's colour, meadow and snow where the per-vertex weights
 * `meadowW` and `snowW` exceed one half. The threshold (not a blend) gives crisp, map-like cover edges.
 */
export function createGroundMaterial(u: NaturalUniforms): MeshBasicNodeMaterial {
  const m = basic();
  const b = lightBand(u);
  const meadowW = attribute("meadowW", "float");
  const snowW = attribute("snowW", "float");
  let natural = tone(b, u.rockLit, u.rockShade);
  natural = mix(
    natural,
    tone(b, c(NATURAL_TOKENS.meadow), c(NATURAL_TOKENS.meadowShade)),
    step(0.5, meadowW),
  );
  natural = mix(natural, tone(b, c(NATURAL_TOKENS.snow), c(NATURAL_TOKENS.snowShade)), step(0.5, snowW));
  m.colorNode = wash(u, b, natural);
  return m;
}

/** Glacier surface: pale blue, banded. */
export function createIceMaterial(u: NaturalUniforms): MeshBasicNodeMaterial {
  const m = basic();
  const b = lightBand(u);
  m.colorNode = wash(u, b, tone(b, c(NATURAL_TOKENS.ice), c(NATURAL_TOKENS.iceShade)));
  return m;
}

/** Glacier ice seen in section on the cut face. */
export function createIceSectionMaterial(u: NaturalUniforms): MeshBasicNodeMaterial {
  const m = basic();
  const b = lightBand(u);
  m.colorNode = wash(u, b, c(NATURAL_TOKENS.iceSection).mul(float(0.9).add(b.mul(0.1))));
  return m;
}

/** Meltwater river ribbon. */
export function createWaterMaterial(u: NaturalUniforms): MeshBasicNodeMaterial {
  const m = basic();
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -2;
  m.colorNode = wash(u, float(1), c(NATURAL_TOKENS.meltwater));
  return m;
}

/** Stylised conifers. */
export function createTreeMaterial(u: NaturalUniforms): MeshBasicNodeMaterial {
  const m = basic();
  const b = lightBand(u);
  m.colorNode = wash(u, b, tone(b, c(NATURAL_TOKENS.conifer), c(NATURAL_TOKENS.coniferShade)));
  return m;
}

/** Size of one lithology tile on the block sides (unit: metres of the model). */
export interface WallMaterialOptions {
  readonly tileM: number;
}

/**
 * The block sides and cut face: the rock's lithology pattern (texture tiled in model metres, so the marks
 * keep their size as the block is cut), with a soil band of per-vertex thickness `soilM` at the top.
 * Attributes: `wallU` (distance along the wall, metres), `wallV` (elevation, metres), `depthM` (depth below
 * the ground surface, metres) and `soilM` (soil thickness at that column, metres).
 */
export function createWallMaterial(
  u: NaturalUniforms,
  rockTexture: Texture,
  options: WallMaterialOptions,
): { material: MeshBasicNodeMaterial; setTexture(t: Texture): void } {
  const m = basic();
  const b = lightBand(u);
  const uvM = vec2(attribute("wallU", "float"), attribute("wallV", "float").negate()).div(options.tileM);
  const tex = texture(rockTexture, uvM);
  const rock = tex.rgb.mul(float(0.8).add(b.mul(0.2)));
  const soil = c(NATURAL_TOKENS.soil).mul(float(0.85).add(b.mul(0.15)));
  const inSoil = step(attribute("depthM", "float"), attribute("soilM", "float"));
  m.colorNode = wash(u, b, mix(rock, soil, inSoil));
  return {
    material: m,
    setTexture: (t: Texture) => {
      tex.value = t;
    },
  };
}

/** A repeating canvas texture of a rock's lithology pattern, with bedding bands. */
export function createLithologyTexture(look: LithologyLook, sizePx = 128): Texture {
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(sizePx, sizePx)
      : Object.assign(document.createElement("canvas"), { width: sizePx, height: sizePx });
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error("2D canvas is not available for the lithology texture");
  paintLithologyTile(ctx, look, { sizePx, markWidthPx: sizePx / 28, bedding: true });
  const t = new CanvasTexture(canvas as HTMLCanvasElement);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Sets the rock colours used on the land surface from a lithology look. */
export function applyRockLook(u: NaturalUniforms, look: LithologyLook): void {
  // Exposed rock on the land surface is weathered: a cool grey tinted by the rock. The full lithology
  // colour and pattern show on the block's sides, where the rock is seen in section.
  const lit = new Color(NATURAL_TOKENS.weatheredRock).lerp(new Color(look.colour), 0.3);
  const shade = lit.clone().lerp(new Color(look.markColour), 0.4);
  u.rockLit.value.set(lit.r, lit.g, lit.b);
  u.rockShade.value.set(shade.r, shade.g, shade.b);
}
