/**
 * TSL materials for the ink view. TSL compiles to WGSL on WebGPU and to GLSL on the WebGL2 fallback, so
 * both backends run the same node graph.
 *
 * Every layer (terrain fill, contours, hachures, edge) computes its world position with the same
 * `liftedPosition` and the same `exaggeration` uniform. The layers therefore move together during the
 * lift and cannot drift apart.
 */
import { Color, DoubleSide, Vector2 } from "three";
import {
  Fn,
  attribute,
  cameraProjectionMatrix,
  clamp,
  color,
  float,
  fract,
  length,
  mix,
  modelViewMatrix,
  screenCoordinate,
  select,
  step,
  varyingProperty,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import type { Node } from "three/webgpu";
import type { ChannelConfig } from "../palette";
import { INK_TOKENS, hexToRgb, srgbToLinear } from "../palette";

/** Uniforms shared by every ink material. */
export function createInkUniforms() {
  return {
    /** Vertical exaggeration, 0 (flat page) to 1 (full relief). */
    exaggeration: uniform(0),
    /** Vertical scale at full lift (unit: none). */
    reliefScale: uniform(1),
    /** Elevation at the base of the lift (unit: metres). */
    datumM: uniform(0),
    /** Half the terrain width, to centre it on the origin (unit: metres). */
    halfWidthM: uniform(0),
    /** Device pixels per CSS pixel. */
    pixelRatio: uniform(1),
    /** Drawing buffer size (unit: device pixels). */
    resolutionPx: uniform(new Vector2(1, 1)),
    /** Clip-space depth pulled towards the camera for strokes, so they sit on the surface. */
    strokeDepthBias: uniform(0.0004),
    waterOn: uniform(1),
    waterFromM: uniform(0),
    waterFullM: uniform(1),
    waterOpacity: uniform(0),
    sedimentOn: uniform(1),
    sedimentFromM: uniform(0),
    sedimentFullM: uniform(1),
    sedimentOpacity: uniform(0),
  };
}

export type InkUniforms = ReturnType<typeof createInkUniforms>;

/** Copies channel display settings into the uniforms. */
export function applyChannelUniforms(u: InkUniforms, channels: ChannelConfig): void {
  u.waterFromM.value = channels.water.visibleFromM;
  u.waterFullM.value = channels.water.fullAtM;
  u.waterOpacity.value = channels.water.maxOpacity;
  u.sedimentFromM.value = channels.sediment.visibleFromM;
  u.sedimentFullM.value = channels.sediment.fullAtM;
  u.sedimentOpacity.value = channels.sediment.maxOpacity;
}

/** Terrain point `(xM, yM, hM)` to world space at the current exaggeration. Shared by every layer. */
function liftedPosition(u: InkUniforms, p: Node<"vec3">): Node<"vec3"> {
  return vec3(
    p.x.sub(u.halfWidthM),
    p.z.sub(u.datumM).mul(u.reliefScale).mul(u.exaggeration),
    p.y.sub(u.halfWidthM),
  );
}

/** Channel opacity: the shader twin of `channelOpacity` in `palette.ts`. */
function rampOpacity(value: Node<"float">, from: Node<"float">, full: Node<"float">, max: Node<"float">) {
  return clamp(value.sub(from).div(full.sub(from)), 0, 1).mul(max);
}

/**
 * The terrain fill: paper, with water and sediment drawn from state, and nothing else. The geometry holds
 * `position = (xM, yM, 0)` and per-sample `heightM`, `waterM` and `sedimentM` attributes.
 */
export function createTerrainMaterial(u: InkUniforms, channels: ChannelConfig): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ side: DoubleSide });
  const position = attribute("position", "vec3");
  const height = attribute("heightM", "float");
  material.positionNode = liftedPosition(u, vec3(position.x, position.y, height));

  const water = attribute("waterM", "float");
  const sediment = attribute("sedimentM", "float");
  const waterAlpha = rampOpacity(water, u.waterFromM, u.waterFullM, u.waterOpacity).mul(u.waterOn);
  // Interrupted diagonal stripes in screen space: sediment stays distinct from water without colour.
  const period = float(INK_TOKENS.sedimentStripePeriodPx).mul(u.pixelRatio);
  const stripe = step(0.5, fract(screenCoordinate.x.add(screenCoordinate.y).div(period)));
  const sedimentAlpha = rampOpacity(sediment, u.sedimentFromM, u.sedimentFullM, u.sedimentOpacity)
    .mul(u.sedimentOn)
    .mul(stripe);
  const paper = color(new Color(INK_TOKENS.paper));
  const withWater = mix(paper, color(new Color(channels.water.colour)), waterAlpha);
  material.colorNode = mix(withWater, color(new Color(channels.sediment.colour)), sedimentAlpha);
  // Push the fill back so strokes lying exactly on it win the depth test.
  material.polygonOffset = true;
  material.polygonOffsetFactor = 1;
  material.polygonOffsetUnits = 1;
  return material;
}

/**
 * Screen-space ink strokes (contours, hachures, the terrain edge). WebGL line widths are not portable,
 * so each segment is an instanced quad: `position = (along, side, 0)` with along ∈ {0, 1} and
 * side ∈ {−1, 1}. Per instance: `segStart` and `segEnd` are terrain points `(xM, yM, hM)`; `segPrev` and
 * `segNext` are the neighbouring polyline points (equal to the segment's own ends at an open end); and
 * `segWidth` is the stroke width in CSS pixels.
 *
 * Joints are mitred from the same three points on both sides, so neighbouring quads share their joint
 * vertices exactly: no gaps and no double coverage. Edges are anti-aliased analytically (box-filter
 * coverage of the stroke across a one-pixel fringe), like the SVG renderer, rather than by MSAA alone:
 * four MSAA samples quantise a sub-pixel line into visible dashes as it drifts across sample rows.
 */
export function createStrokeMaterial(u: InkUniforms): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ side: DoubleSide, transparent: true, depthWrite: false });
  const corner = attribute("position", "vec3");
  const prev = attribute("segPrev", "vec3");
  const start = attribute("segStart", "vec3");
  const end = attribute("segEnd", "vec3");
  const next = attribute("segNext", "vec3");
  const width = attribute("segWidth", "float");
  /** Signed distance from the stroke centre line (unit: device pixels). */
  const side = varyingProperty("float", "vInkSide");
  const halfWidth = varyingProperty("float", "vInkHalfWidth");

  material.vertexNode = Fn(() => {
    const mvp = cameraProjectionMatrix.mul(modelViewMatrix);
    const halfRes = u.resolutionPx.mul(0.5);
    const clipOf = (p: Node<"vec3">) => mvp.mul(vec4(liftedPosition(u, p), 1));
    const a = clipOf(start);
    const b = clipOf(end);
    const screen = (c: Node<"vec4">) => c.xy.div(c.w).mul(halfRes);
    const sp = screen(clipOf(prev));
    const sa = screen(a);
    const sb = screen(b);
    const sn = screen(clipOf(next));
    const unit = (v: Node<"vec2">, fallback: Node<"vec2">) => {
      const len = length(v);
      return select(len.greaterThan(1e-4), v.div(len), fallback);
    };
    const dirAB = unit(sb.sub(sa), vec2(1, 0));
    const atEnd = corner.x.greaterThan(0.5);
    // Incoming and outgoing directions at this joint. Both segments meeting at a joint evaluate the same
    // expressions on the same points, so they produce bitwise-identical joint vertices.
    const dirIn = select(atEnd, dirAB, unit(sa.sub(sp), dirAB));
    const dirOut = select(atEnd, unit(sn.sub(sb), dirAB), dirAB);
    const tangent = unit(dirIn.add(dirOut), dirIn);
    const miter = vec2(tangent.y.negate(), tangent.x);
    const cosHalf = miter.dot(vec2(dirIn.y.negate(), dirIn.x)).max(0.35);
    const hw = width.mul(u.pixelRatio).mul(0.5);
    const reach = hw.add(1); // one device pixel of anti-aliasing fringe
    halfWidth.assign(hw);
    side.assign(corner.y.mul(reach));
    const offsetPx = miter.mul(corner.y.mul(reach).div(cosHalf));
    const clip = select(atEnd, b, a);
    const xy = clip.xy.add(offsetPx.div(halfRes).mul(clip.w));
    return vec4(xy, clip.z.sub(u.strokeDepthBias.mul(clip.w)), clip.w);
  })();
  material.colorNode = color(new Color(INK_TOKENS.ink));
  // Coverage of a one-pixel box filter at distance d from a stroke of half-width hw.
  const d = side.abs();
  const coverage = clamp(d.add(0.5).min(halfWidth).sub(d.sub(0.5).max(halfWidth.negate())), 0, 1);
  // three blends in linear light; browsers blend SVG strokes in sRGB. Convert coverage so a stroke over
  // paper gets the same sRGB value as the SVG stroke, keeping line weight unchanged at the crossfade.
  const [paperS, inkS] = [INK_TOKENS.paper, INK_TOKENS.ink].map((hex) => hexToRgb(hex)[1]) as [
    number,
    number,
  ];
  const paperL = srgbToLinear(paperS);
  const inkL = srgbToLinear(inkS);
  const targetS = float(paperS).add(float(inkS - paperS).mul(coverage));
  const targetL = targetS.add(0.055).div(1.055).pow(2.4);
  material.opacityNode = clamp(
    float(paperL)
      .sub(targetL)
      .div(paperL - inkL),
    0,
    1,
  );
  return material;
}
