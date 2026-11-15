/**
 * Session 7A storyboard for the plate-boundaries lesson: draws the shared starting landscape and each boundary
 * at stage 0, 0.5 and 1 as simple oblique block diagrams with the front face, straight from the 7A parameter
 * table (docs/science/plates/parameters.json). From the repository root:
 *
 *   node docs/review/plates/brief/storyboard.mjs
 *
 * Writes the SVG frames, front-face-ghosts.svg and crust-geometry.json next to this file.
 *
 * This is a reference sketch of the authored shapes for the owner and for 7C, not production code and not a
 * simulation: every landform here is drawn from a formula, never from flow, transport or deposition. 7C owns the
 * production generators (uplift/book/src/scenes/plates/relief/**) and may differ in detail, but must follow
 * the same table and formulas (docs/science/plates/parameters.md, "Formulas").
 */
import { readFileSync, writeFileSync } from "node:fs";
import { URL, fileURLToPath } from "node:url";
import console from "node:console";

const P = JSON.parse(
  readFileSync(new URL("../../../science/plates/parameters.json", import.meta.url), "utf8"),
);
const outDir = fileURLToPath(new URL("./", import.meta.url));

// ---------------------------------------------------------------------------------------------------------
// Deterministic noise (no Math.random): integer hash → smooth value noise → three octaves.
// ---------------------------------------------------------------------------------------------------------

function hash01(x, y, seed) {
  let h =
    (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = smooth(x - x0);
  const sy = smooth(y - y0);
  const v = (i, j) => hash01(x0 + i, y0 + j, seed) * 2 - 1;
  const top = v(0, 0) + (v(1, 0) - v(0, 0)) * sx;
  const bottom = v(0, 1) + (v(1, 1) - v(0, 1)) * sx;
  return top + (bottom - top) * sy;
}

/** About −0.7 to 0.7. */
function fbm(x, y, seed) {
  return (
    valueNoise(x, y, seed) * 0.6 +
    valueNoise(x * 2, y * 2, seed + 1) * 0.3 +
    valueNoise(x * 4, y * 4, seed + 2) * 0.1
  );
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function smooth(t) {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
}

// ---------------------------------------------------------------------------------------------------------
// The authored field (metres; x across the boundary, z along it from the back (−) to the front (+)).
// ---------------------------------------------------------------------------------------------------------

const S = P.start;
const C = P.crust;
const seed = P.seed;
const meanderPhase = 2 * Math.PI * hash01(11, 0, seed);
const D0 = C.normalThicknessM - S.lowlandElevationM; // Moho depth below sea level under the lowland

/** The smooth part of the start: lowland with a regional tilt down towards +x. */
const startSmooth = (x) => S.lowlandElevationM - (S.regionalTiltMPerKm * x) / 1000;
const meander = (x) =>
  S.ridgeMeanderAmplitudeM * Math.sin((2 * Math.PI * x) / S.ridgeMeanderWavelengthM + meanderPhase);

/** The shared starting landscape (identical for every boundary at stage 0). */
function start(x, z) {
  const u = (z + meander(x)) / S.ridgeSpacingM;
  const ridge = 0.5 * S.ridgeReliefM * Math.cos(2 * Math.PI * u);
  const d = Math.abs(u - Math.floor(u) - 0.5) * S.ridgeSpacingM; // distance to the trough line
  const channel = -S.streamChannelDepthM * smooth(1 - d / (S.streamChannelWidthM / 2));
  const noise =
    S.surfaceNoiseAmplitudeM *
    (fbm(x / S.surfaceNoiseWavelengthM, z / S.surfaceNoiseWavelengthM, seed) / 0.7);
  return startSmooth(x) + ridge + channel + noise;
}

const ease = (s) => clamp(s, 0, 1); // P.stage.ease === "linear"

/** Smooth uplift envelope of the range (no noise), metres. */
function rangeEnvelope(x, s) {
  const G = P.convergent;
  const k = G.rangeWidthAtStageZeroFraction + (1 - G.rangeWidthAtStageZeroFraction) * ease(s);
  const p = smooth((G.rangeWidthM * k * 0.5 - Math.abs(x)) / (G.rangeFlankWidthM * k));
  return ease(s) * (G.rangeCrestElevationM - S.lowlandElevationM) * p;
}

const riftEdges = (() => {
  const R = P.divergent;
  const n = R.scarpsPerSide;
  const outer = R.riftWidthM / 2;
  const inner = R.riftFloorWidthM / 2;
  return Array.from({ length: n }, (_, i) => outer + ((inner - outer) * i) / Math.max(1, n - 1));
})();

/** Smooth surface change of the rift (stepped scarps and shoulders), metres. */
function riftChange(x, s) {
  const R = P.divergent;
  const a = Math.abs(x);
  const step = (e) => smooth((e - a) / R.scarpFaceWidthM + 0.5);
  let drop = 0;
  riftEdges.forEach((e, i) => (drop += R.floorDropM * R.scarpDropFractions[i] * step(e)));
  const shoulder =
    R.shoulderHeightM *
    Math.exp(-Math.max(0, a - riftEdges[0]) / R.shoulderDecayM) *
    (1 - step(riftEdges[0]));
  return ease(s) * (shoulder - drop);
}

function riftMohoRise(x, s) {
  const R = P.divergent;
  const axisDepth = R.crustThicknessAtAxisM - (S.lowlandElevationM - R.floorDropM);
  const rise = D0 - axisDepth;
  const a = Math.abs(x);
  if (a >= R.thinningHalfWidthM) return 0;
  return ease(s) * rise * Math.cos((Math.PI * a) / (2 * R.thinningHalfWidthM)) ** 2;
}

/** Along-boundary displacement of each side (right-lateral: the right half moves towards +z, the reader). */
function transformShift(x, s) {
  const T = P.transform;
  return 0.5 * ease(s) * T.offsetM * Math.tanh(x / T.faultZoneHalfWidthM);
}

/**
 * One cell of the authored field: surface (bed) elevation, Moho depth below sea level, and the vertical
 * offset of the rock layers relative to the start. All in real metres.
 */
function field(boundary, s, x, z) {
  if (boundary === "convergent") {
    const E = rangeEnvelope(x, s);
    const G = P.convergent;
    const n = clamp(fbm(x / G.peakNoiseWavelengthM, z / G.peakNoiseWavelengthM, seed + 101) / 0.7, -1, 1);
    return {
      bedM: start(x, z) + E * (1 + G.peakNoiseFraction * n),
      mohoDepthM: D0 + C.airyRootPerMetreOfUplift * E,
      layerOffsetM: E,
    };
  }
  if (boundary === "divergent") {
    const d = riftChange(x, s);
    return { bedM: start(x, z) + d, mohoDepthM: D0 - riftMohoRise(x, s), layerOffsetM: d };
  }
  if (boundary === "transform") {
    return { bedM: start(x, z - transformShift(x, s)), mohoDepthM: D0, layerOffsetM: 0 };
  }
  return { bedM: start(x, z), mohoDepthM: D0, layerOffsetM: 0 };
}

/** Smooth (ridge- and noise-free) surface, for the crust-geometry table. */
function smoothSurface(boundary, s, x) {
  if (boundary === "convergent") return startSmooth(x) + rangeEnvelope(x, s);
  if (boundary === "divergent") return startSmooth(x) + riftChange(x, s);
  return startSmooth(x);
}

// ---------------------------------------------------------------------------------------------------------
// Drawing: an oblique block with the front face true-shape and the top receding up and to the right.
// ---------------------------------------------------------------------------------------------------------

const VE = P.display.surfaceVerticalExaggeration;
const VEC = P.display.crustVerticalExaggeration;
const halfM = ((P.grid.columns - 1) * P.grid.metresPerCell) / 2;
const halfKm = halfM / 1000;

const PX = 3; // pixels per display kilometre
const DEPTH = 0.55;
const ANGLE = (40 * Math.PI) / 180;
const W = 820;
const H = 640;
const OX = 60;
const OY = 400; // sea level at the front face

/** Display kilometres: surface and layers ×VE, crust base ×VEC. */
const yS = (m) => (m / 1000) * VE;
const yC = (depthM) => (-depthM / 1000) * VEC;
/** Block base, on the crust-base scale (one fixed frame for every boundary and stage). */
const baseKm = yC(P.display.blockBaseDepthBelowSeaLevelM);

function proj(xKm, zKm, yKm) {
  const back = halfKm - zKm;
  return [
    OX + PX * (xKm + halfKm) + PX * DEPTH * back * Math.cos(ANGLE),
    OY - PX * yKm - PX * DEPTH * back * Math.sin(ANGLE),
  ];
}

const f1 = (v) => (Math.round(v * 10) / 10).toString();
const pts = (list) => list.map(([a, b]) => `${f1(a)} ${f1(b)}`).join("L");
const pathOf = (list, close = true) => `M${pts(list)}${close ? "z" : ""}`;
/** Whole-pixel path for the many surface quads (keeps the files small). */
const quadPath = (list) => `M${list.map(([a, b]) => `${Math.round(a)} ${Math.round(b)}`).join("L")}z`;

const COLOURS = {
  sandstone: "#e2c48c",
  shale: "#9aa4a8",
  limestone: "#dcd6c2",
  crust: "#cfaaa0",
  mantle: "#8e9a68",
  ink: "#3b3127",
  water: "#3f7fb5",
  paper: "#fbf8f1",
};

function surfaceColour(hM, lambert) {
  let base;
  if (hM > P.dressing.snowlineM) base = [242, 243, 239];
  else if (hM > P.dressing.treelineM) base = [163, 156, 144];
  else if (hM > 2000) base = [184, 164, 126];
  else base = [157, 183, 127];
  // Quantized shading keeps the files small (quads of one colour in a row share one path).
  const k = Math.round(clamp(0.72 + 0.4 * lambert, 0.55, 1.12) * 20) / 20;
  const c = base.map((v) => clamp(Math.round(v * k), 0, 255));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const LIGHT = (() => {
  const v = [-0.55, 0.75, 0.35];
  const n = Math.hypot(...v);
  return v.map((a) => a / n);
})();

function xSamples(boundary) {
  const xs = new Set();
  for (let x = -halfKm; x <= halfKm + 1e-9; x += 2.5) xs.add(Math.round(x * 100) / 100);
  if (boundary === "divergent")
    for (const e of riftEdges)
      for (const d of [-0.5, 0, 0.5])
        for (const sgn of [-1, 1]) xs.add(Math.round(sgn * (e / 1000 + d) * 100) / 100);
  if (boundary === "transform") for (const d of [-2, -1, -0.5, 0, 0.5, 1, 2]) xs.add(d);
  return [...xs].filter((x) => x >= -halfKm && x <= halfKm).sort((a, b) => a - b);
}

/** Front-face sample positions (km): 1 km, refined to 0.25 km across the rift scarps. */
function faceSamples(boundary) {
  const xs = new Set();
  for (let x = -halfKm; x <= halfKm + 1e-9; x += 1) xs.add(Math.round(x * 100) / 100);
  if (boundary === "divergent")
    for (const e of riftEdges)
      for (const sgn of [-1, 1])
        for (let d = -1; d <= 1 + 1e-9; d += 0.25) xs.add(Math.round(sgn * (e / 1000 + d) * 100) / 100);
  return [...xs].filter((x) => x >= -halfKm && x <= halfKm).sort((a, b) => a - b);
}

/** The stack on a vertical face: surface, layer bases, Moho and block base (display km). */
function stackAt(boundary, s, x, z) {
  const f = field(boundary, s, x * 1000, z * 1000);
  const top = startSmooth(x * 1000) - S.ridgeReliefM / 2 + f.layerOffsetM;
  let cum = 0;
  const layerBases = S.layers.map((l) => {
    cum += l.thicknessM;
    return yS(top - cum);
  });
  return { surf: yS(f.bedM), layerBases, moho: yC(f.mohoDepthM), base: baseKm };
}

/** Polygons of the layered face along a line of samples, given a projection for each sample. */
function facePolygons(samples, project) {
  const out = [];
  const bands = [];
  const n = S.layers.length;
  for (let i = 0; i < n; i++) {
    bands.push({
      fill: COLOURS[S.layers[i].name] ?? COLOURS.limestone,
      top: (st) => (i === 0 ? st.surf : Math.min(st.surf, st.layerBases[i - 1])),
      bottom: (st) => Math.min(st.surf, st.layerBases[i]),
    });
  }
  bands.push({
    fill: COLOURS.crust,
    top: (st) => Math.min(st.surf, st.layerBases[n - 1]),
    bottom: (st) => st.moho,
    pattern: true,
  });
  bands.push({ fill: COLOURS.mantle, top: (st) => st.moho, bottom: (st) => st.base });
  for (const b of bands) {
    const upper = samples.map((sm) => project(sm, b.top(sm.st)));
    const lower = samples.map((sm) => project(sm, b.bottom(sm.st))).reverse();
    out.push(`<path d="${pathOf([...upper, ...lower])}" fill="${b.pattern ? "url(#crustHatch)" : b.fill}"/>`);
  }
  return out;
}

const GLYPH = { convergent: "→ ←", divergent: "← →", transform: "⇅" };
const NAME = {
  convergent: "Convergent (collision)",
  divergent: "Divergent (rift)",
  transform: "Transform (sideways)",
};

function arrow(from, to, cls) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hl = 11;
  const h1 = [x2 - hl * Math.cos(a - 0.45), y2 - hl * Math.sin(a - 0.45)];
  const h2 = [x2 - hl * Math.cos(a + 0.45), y2 - hl * Math.sin(a + 0.45)];
  return `<g class="${cls}"><path d="M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}" fill="none" stroke="${COLOURS.ink}" stroke-width="5" stroke-linecap="round"/><path d="M${pts([to, h1, h2])}z" fill="${COLOURS.ink}"/></g>`;
}

function plateArrows(boundary) {
  const zA = -30;
  const lift = (x, z) => yS(start(x * 1000, z * 1000)) + 3;
  const on = (x, z) => proj(x, z, lift(x, z));
  if (boundary === "convergent")
    return [arrow(on(-62, zA), on(-38, zA), "plate"), arrow(on(62, zA), on(38, zA), "plate")];
  if (boundary === "divergent")
    return [arrow(on(-38, zA), on(-62, zA), "plate"), arrow(on(38, zA), on(62, zA), "plate")];
  if (boundary === "transform")
    return [arrow(on(-45, -15), on(-45, -45), "plate"), arrow(on(45, -45), on(45, -15), "plate")];
  return [];
}

function frame(boundary, s, title, notes) {
  const shown = boundary ?? "start";
  const el = [];
  const xs = xSamples(shown);
  const zStep = 4;
  const zs = [];
  for (let z = -halfKm; z <= halfKm + 1e-9; z += zStep) zs.push(Math.round(z * 100) / 100);

  // Right side face (x = +half), along z.
  const sideSamples = [];
  for (let z = -halfKm; z <= halfKm + 1e-9; z += 2) sideSamples.push({ z, st: stackAt(shown, s, halfKm, z) });
  el.push(...facePolygons(sideSamples, (sm, y) => proj(halfKm, sm.z, y)));

  // Surface quads, back to front, with streams and ink profiles in painter order.
  const hgt = zs.map((z) => xs.map((x) => field(shown, s, x * 1000, z * 1000).bedM));
  const streams = streamLines(shown, s);
  for (let j = 0; j < zs.length - 1; j++) {
    const byFill = new Map();
    for (let i = 0; i < xs.length - 1; i++) {
      const c = [
        [xs[i], zs[j], hgt[j][i]],
        [xs[i + 1], zs[j], hgt[j][i + 1]],
        [xs[i + 1], zs[j + 1], hgt[j + 1][i + 1]],
        [xs[i], zs[j + 1], hgt[j + 1][i]],
      ];
      const dx = xs[i + 1] - xs[i];
      const dydx = (yS(c[1][2]) - yS(c[0][2]) + yS(c[2][2]) - yS(c[3][2])) / (2 * dx);
      const dydz = (yS(c[3][2]) - yS(c[0][2]) + yS(c[2][2]) - yS(c[1][2])) / (2 * zStep);
      const nrm = [-dydx, 1, -dydz];
      const len = Math.hypot(...nrm);
      const lambert = (nrm[0] * LIGHT[0] + nrm[1] * LIGHT[1] + nrm[2] * LIGHT[2]) / len;
      const hMean = (c[0][2] + c[1][2] + c[2][2] + c[3][2]) / 4;
      const fill = surfaceColour(hMean, lambert);
      byFill.set(fill, (byFill.get(fill) ?? "") + quadPath(c.map(([x, z, h]) => proj(x, z, yS(h)))));
    }
    for (const [fill, d] of byFill)
      el.push(`<path d="${d}" fill="${fill}" stroke="${fill}" stroke-width="0.6"/>`);
    if (j % 2 === 0) {
      const line = xs.map((x, i) => proj(x, zs[j], yS(hgt[j][i])));
      el.push(
        `<path d="${pathOf(line, false)}" fill="none" stroke="${COLOURS.ink}" stroke-opacity="0.28" stroke-width="0.7"/>`,
      );
    }
    for (const st of streams) if (st.zKm >= zs[j] && st.zKm < zs[j + 1]) el.push(st.svg);
  }

  // Block outline: back and left top edges, front top edge, vertical corners, base.
  const edge = (pairs) =>
    `<path d="${pathOf(pairs, false)}" fill="none" stroke="${COLOURS.ink}" stroke-width="1.4"/>`;
  el.push(edge(xs.map((x, i) => proj(x, zs[0], yS(hgt[0][i])))));
  el.push(edge(zs.map((z, j) => proj(-halfKm, z, yS(hgt[j][0])))));

  // Front face (z = +half), true shape.
  const front = [];
  for (const x of faceSamples(shown)) front.push({ x, st: stackAt(shown, s, x, halfKm) });
  el.push(...facePolygons(front, (sm, y) => proj(sm.x, halfKm, y)));
  // Layer boundaries and the crust base as ink lines on the front face.
  for (let i = 0; i < S.layers.length; i++)
    el.push(
      `<path d="${pathOf(
        front.map((sm) => proj(sm.x, halfKm, Math.min(sm.st.surf, sm.st.layerBases[i]))),
        false,
      )}" fill="none" stroke="${COLOURS.ink}" stroke-opacity="0.5" stroke-width="0.6"/>`,
    );
  el.push(
    `<path d="${pathOf(
      front.map((sm) => proj(sm.x, halfKm, sm.st.moho)),
      false,
    )}" fill="none" stroke="${COLOURS.ink}" stroke-width="1.6"/>`,
  );
  el.push(...faultMarks(shown, s));
  el.push(edge(front.map((sm) => proj(sm.x, halfKm, sm.st.surf))));
  el.push(edge(sideSamples.map((sm) => proj(halfKm, sm.z, sm.st.surf))));
  const corners = [
    [proj(-halfKm, halfKm, front[0].st.surf), proj(-halfKm, halfKm, baseKm)],
    [proj(halfKm, halfKm, front.at(-1).st.surf), proj(halfKm, halfKm, baseKm)],
    [proj(halfKm, -halfKm, sideSamples[0].st.surf), proj(halfKm, -halfKm, baseKm)],
  ];
  for (const c of corners) el.push(edge(c));
  el.push(edge([proj(-halfKm, halfKm, baseKm), proj(halfKm, halfKm, baseKm), proj(halfKm, -halfKm, baseKm)]));

  // Boundary trace on the surface (dashed), then the plate arrows.
  if (boundary) {
    const trace = zs.map((z) => proj(0, z, yS(field(shown, s, 0, z * 1000).bedM) + 0.6));
    el.push(
      `<path d="${pathOf(trace, false)}" fill="none" stroke="${COLOURS.ink}" stroke-width="1.2" stroke-dasharray="5 4"/>`,
    );
    el.push(...plateArrows(boundary));
  }

  // Labels.
  const [mx, my] = proj(halfKm, halfKm, front.at(-1).st.moho);
  el.push(`<text x="${f1(mx + 8)}" y="${f1(my + 4)}" class="small">crust base</text>`);
  const [lx, ly] = proj(halfKm, halfKm, (front.at(-1).st.moho + baseKm) / 2);
  el.push(`<text x="${f1(lx + 8)}" y="${f1(ly + 4)}" class="small">mantle</text>`);
  const [cx, cy] = proj(halfKm, halfKm, (front.at(-1).st.layerBases.at(-1) + front.at(-1).st.moho) / 2);
  el.push(`<text x="${f1(cx + 8)}" y="${f1(cy + 4)}" class="small">crust</text>`);

  const legend = [
    ...S.layers.map((l) => [COLOURS[l.name] ?? COLOURS.limestone, l.name]),
    [COLOURS.crust, S.basementName],
    [COLOURS.mantle, "mantle"],
  ];
  const lg = legend
    .map(
      ([fill, label], i) =>
        `<rect x="${40 + i * 150}" y="${H - 52}" width="14" height="14" fill="${fill}" stroke="${COLOURS.ink}" stroke-width="0.6"/><text x="${64 + i * 150}" y="${H - 40}" class="small">${label}</text>`,
    )
    .join("");
  const glyph = boundary
    ? `<text x="${W - 40}" y="40" class="glyph" text-anchor="end">${GLYPH[boundary]}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
<title id="t">${title}</title>
<desc id="d">${notes.join(" ")}</desc>
<defs>
<pattern id="crustHatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="10" height="10" fill="${COLOURS.crust}"/><path d="M0 0L0 10" stroke="${COLOURS.ink}" stroke-opacity="0.18" stroke-width="1"/></pattern>
<style>text{font-family:Georgia,'Times New Roman',serif;fill:${COLOURS.ink}}.title{font-size:20px}.small{font-size:12px}.note{font-size:12px;font-style:italic}.glyph{font-size:26px}</style>
</defs>
<rect width="${W}" height="${H}" fill="${COLOURS.paper}"/>
<text x="24" y="34" class="title">${title}</text>
${notes.map((t, i) => `<text x="24" y="${56 + i * 16}" class="note">${t}</text>`).join("\n")}
${glyph}
${el.join("\n")}
${lg}
<text x="24" y="${H - 14}" class="note">Storyboard (7A), authored from the 7A table; not simulated; not production art. Heights, layers ×${VE}; crust base ×${VEC}.</text>
</svg>
`;
}

function streamLines(boundary, s) {
  const out = [];
  const lambda = S.ridgeSpacingM / 1000;
  const sides = boundary === "transform" ? [-1, 1] : [0];
  for (let k = -6; k <= 6; k++) {
    for (const side of sides) {
      const xsLine = [];
      for (let x = -halfKm; x <= halfKm + 1e-9; x += 1) {
        if (side < 0 && x > 0.5) continue;
        if (side > 0 && x < -0.5) continue;
        xsLine.push(x);
      }
      const segs = [];
      let cur = [];
      let zSum = 0;
      let zN = 0;
      for (const x of xsLine) {
        const z0 = (k + 0.5) * lambda - meander(x * 1000) / 1000;
        const z = boundary === "transform" ? z0 + transformShift(x * 1000, s) / 1000 : z0;
        const hidden =
          z < -halfKm || z > halfKm || (boundary === "convergent" && rangeEnvelope(x * 1000, s) > 100);
        if (hidden) {
          if (cur.length > 1) segs.push(cur);
          cur = [];
          continue;
        }
        const h = field(boundary, s, x * 1000, z * 1000).bedM;
        cur.push(proj(x, z, yS(h) + 0.4));
        zSum += z;
        zN++;
      }
      if (cur.length > 1) segs.push(cur);
      if (!segs.length) continue;
      const svg = segs
        .map(
          (sg) =>
            `<path d="${pathOf(sg, false)}" fill="none" stroke="${COLOURS.water}" stroke-width="1.6" stroke-linejoin="round"/>`,
        )
        .join("");
      out.push({ zKm: zSum / zN, svg });
    }
  }
  return out;
}

function faultMarks(boundary, s) {
  const out = [];
  const z = halfKm;
  if (boundary === "divergent" && s > 0) {
    for (const e of riftEdges)
      for (const sgn of [-1, 1]) {
        const x = (sgn * e) / 1000;
        const st = stackAt(boundary, s, x, z);
        const xIn = x - sgn * 2.5;
        const stIn = stackAt(boundary, s, xIn, z);
        out.push(
          `<path d="M${pts([proj(x, z, st.surf), proj(xIn, z, stIn.layerBases.at(-1) - 6)])}" fill="none" stroke="${COLOURS.ink}" stroke-width="1.2"/>`,
        );
      }
  }
  if (boundary === "transform") {
    const st = stackAt(boundary, s, 0, z);
    out.push(
      `<path d="M${pts([proj(0, z, st.surf), proj(0, z, st.moho)])}" fill="none" stroke="${COLOURS.ink}" stroke-width="1.2" stroke-dasharray="4 3"/>`,
    );
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Front-face ghosts: surface and crust base of the three boundaries at the same stage, as on the page.
// ---------------------------------------------------------------------------------------------------------

function ghosts(s) {
  const w = 820;
  const h = 420;
  const ox = 60;
  const oy = 150;
  const px = 4.2;
  const X = (xKm) => ox + (xKm + halfKm) * px;
  const Y = (yKm) => oy - yKm * px * 0.5;
  const styles = {
    convergent: { dash: "", width: 2.4 },
    divergent: { dash: "8 5", width: 2 },
    transform: { dash: "2 4", width: 2 },
  };
  const el = [];
  const startLine = [];
  for (let x = -halfKm; x <= halfKm; x += 0.5)
    startLine.push([X(x), Y(yS(field(null, 0, x * 1000, halfM).bedM))]);
  el.push(`<path d="${pathOf(startLine, false)}" fill="none" stroke="#9b9186" stroke-width="1"/>`);
  for (const b of ["convergent", "divergent", "transform"]) {
    const surf = [];
    const moho = [];
    for (let x = -halfKm; x <= halfKm; x += 0.5) {
      const f = field(b, s, x * 1000, halfM);
      surf.push([X(x), Y(yS(f.bedM))]);
      moho.push([X(x), Y(yC(f.mohoDepthM))]);
    }
    const st = styles[b];
    for (const line of [surf, moho])
      el.push(
        `<path d="${pathOf(line, false)}" fill="none" stroke="${COLOURS.ink}" stroke-width="${st.width}" stroke-dasharray="${st.dash}"/>`,
      );
  }
  const keys = ["convergent", "divergent", "transform"]
    .map((b, i) => {
      const st = styles[b];
      const y = h - 70 + i * 18;
      return `<path d="M60 ${y}L110 ${y}" stroke="${COLOURS.ink}" stroke-width="${st.width}" stroke-dasharray="${st.dash}"/><text x="120" y="${y + 4}" class="small">${GLYPH[b]}  ${NAME[b]}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t d">
<title id="t">Front face ghosts at stage ${s}</title>
<desc id="d">Surface (upper lines) and crust base (lower lines) on the front face for the three boundaries at stage ${s}; thin grey line is the shared start. The range rises and its root deepens where the rift sinks and its crust thins; the transform matches the start.</desc>
<style>text{font-family:Georgia,'Times New Roman',serif;fill:${COLOURS.ink}}.title{font-size:18px}.small{font-size:12px}.note{font-size:12px;font-style:italic}</style>
<rect width="${w}" height="${h}" fill="${COLOURS.paper}"/>
<text x="24" y="30" class="title">Front face ghosts, stage ${s}: surface (top) and crust base (bottom)</text>
<text x="24" y="48" class="note">Each boundary already viewed is drawn as a labelled profile at the same stage. Heights ×${VE}; crust base ×${VEC}.</text>
${el.join("\n")}
<text x="${X(halfKm) + 6}" y="${Y(yS(S.lowlandElevationM)) + 4}" class="small">surface</text>
<text x="${X(halfKm) + 6}" y="${Y(yC(D0)) + 4}" class="small">crust base</text>
${keys}
</svg>
`;
}

// ---------------------------------------------------------------------------------------------------------
// Crust geometry table: smooth surface, crust thickness, Moho depth and the crust-base field for 7B/7C.
// ---------------------------------------------------------------------------------------------------------

function crustGeometry() {
  const rows = [];
  const crustScale = VEC / VE;
  for (const b of ["convergent", "divergent", "transform"])
    for (const s of [0, 0.5, 1])
      for (const xKm of [0, 10, 20, 30, 40, 60]) {
        const hM = smoothSurface(b, s, xKm * 1000);
        const f = field(b, s, xKm * 1000, 0);
        const mohoDepthM = f.mohoDepthM;
        rows.push({
          boundary: b,
          stage: s,
          xFromBoundaryKm: xKm,
          smoothSurfaceM: Math.round(hM),
          mohoDepthBelowSeaLevelM: Math.round(mohoDepthM),
          crustThicknessM: Math.round(hM + mohoDepthM),
          crustBaseSceneM: Math.round(-mohoDepthM * crustScale),
        });
      }
  return rows;
}

// ---------------------------------------------------------------------------------------------------------

const frames = [];
for (const b of ["convergent", "divergent", "transform"])
  for (const [s, tag] of [
    [0, "0"],
    [0.5, "05"],
    [1, "1"],
  ]) {
    const file = `${b}-stage-${tag}.svg`;
    const notes = {
      convergent: [
        "Plates move towards each other. A range rises along the boundary and widens; snow on its high ground.",
        "Front face: the crust thickens into a root beneath the range (Airy proportion, from the table).",
      ],
      divergent: [
        "Plates move apart. The land sinks into a rift between stepped fault scarps; the shoulders rise slightly.",
        "Front face: rock layers drop in steps; the crust thins beneath the rift.",
      ],
      transform: [
        "Plates slide past each other. Ridges and streams that cross the boundary are offset sideways.",
        "Front face: no change; the crust keeps its thickness.",
      ],
    }[b];
    writeFileSync(`${outDir}${file}`, frame(b, s, `${NAME[b]} · stage ${s}`, notes));
    frames.push(file);
  }
writeFileSync(
  `${outDir}start.svg`,
  frame(null, 0, "Starting landscape (stage 0 for every boundary)", [
    "Rolling lowland; low ridges and stream valleys run left to right across the middle of the block.",
    "Front face: flat rock layers over the crystalline crust, a crust band of uniform thickness, mantle below.",
  ]),
);
writeFileSync(`${outDir}front-face-ghosts.svg`, ghosts(1));
writeFileSync(`${outDir}front-face-ghosts-05.svg`, ghosts(0.5));
writeFileSync(`${outDir}crust-geometry.json`, `${JSON.stringify(crustGeometry(), null, 2)}\n`);
// Extremes over the real grid at stage 1, for the fixed block frame (7B/7C).
for (const b of ["convergent", "divergent", "transform"]) {
  let lo = Infinity;
  let hi = -Infinity;
  let deepest = 0;
  for (let r = 0; r < P.grid.rows; r++)
    for (let c = 0; c < P.grid.columns; c++) {
      const f = field(
        b,
        1,
        (c - (P.grid.columns - 1) / 2) * P.grid.metresPerCell,
        (r - (P.grid.rows - 1) / 2) * P.grid.metresPerCell,
      );
      lo = Math.min(lo, f.bedM);
      hi = Math.max(hi, f.bedM);
      deepest = Math.max(deepest, f.mohoDepthM);
    }
  console.log(
    `${b} stage 1: bed ${Math.round(lo)} to ${Math.round(hi)} m; deepest Moho ${Math.round(deepest)} m`,
  );
}
console.log(
  `Wrote start.svg, ${frames.join(", ")}, front-face-ghosts.svg, front-face-ghosts-05.svg, crust-geometry.json`,
);
