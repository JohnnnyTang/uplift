import { type ReaderSpread, type Probe } from "@hachure/runtime";
const text = (s: string) => ({ hs: s, uni: s });
export const GEOMETRY_PROBES: readonly Probe[] = [
  "elevation",
  "interval",
  "exaggeration",
  "wetCells",
  "sourceX",
  "sourceY",
  "threshold",
  "fullDepth",
  "width",
].map((id) => ({
  id,
  label: text(id),
  request: { kind: "scene-geometry" },
  shape: "scalar",
  unit: ["elevation", "interval", "sourceX", "sourceY", "threshold", "fullDepth", "width"].includes(id)
    ? "m"
    : "",
  significantFigures: 3,
}));
export const GEOMETRY_CATALOGUE = { params: [], tools: [], probeKinds: ["scene-geometry"] };
export function lesson(kind: "contour" | "water"): ReaderSpread {
  const water = kind === "water";
  return {
    schemaVersion: 0,
    id: water ? "hydrology.water-path" : "cartography.contours",
    title: text(water ? "Where will the water go?" : "Lift a map"),
    tags: { domain: [water ? "hydrology" : "cartography"], courses: ["geography"], levels: ["hs", "uni"] },
    tier: water ? "process-model" : "physical-law",
    engine: water ? "terrain" : "scene",
    scene: {
      preset: water ? "prepared-twin-channel" : "contour-hill",
      seed: 5,
      camera: { position: [0, 1, 1], target: [0, 0, 0], fovDeg: 45 },
      ...(water
        ? { modelScope: { kind: "live-process", time: "uncalibrated" }, stepsPerRealSecond: 2000 }
        : { modelScope: { kind: "static-geometry" } }),
    },
    controls: [],
    probes: GEOMETRY_PROBES,
    page: {
      body: water
        ? {
            hs: "Move the spring onto the other hollow. Watch where the surface becomes wet.",
            uni: "Change only the spring position on this prepared surface. Compare the resulting wet extent.",
          }
        : text("Pull the ring upward. Follow the dashed contour from drawing to surface."),
      predict: {
        question: text(
          water
            ? "Will the same part of the surface become wet?"
            : "Does lifting change the height named by the contour?",
        ),
        options: [text("I think so"), text("I think not")],
        answer: null,
      },
      flap: water
        ? {
            hs: "<!-- expert-review --> Moving the spring changes where water enters this prepared landscape. The blue patch and ink dots show water in the current model state; earlier water remains after a move.",
            uni: "<!-- expert-review --> The virtual-pipe process model routes water using surface and water levels. Source position changes the wet extent in the registered paired trials on these prepared terrains. The marks do not track individual parcels or establish a general outlet rule.",
          }
        : {
            hs: "<!-- expert-review --> A contour joins places at the same elevation. The dashed line is {{probe.elevation}} above the model datum in both views. Lifting changes the drawing, not the terrain.",
            uni: "<!-- expert-review --> This isoline is extracted from the same piecewise-linear surface used by the mesh. Its elevation stays {{probe.elevation}} while the displayed vertical scale changes to {{probe.exaggeration}}.",
          },
      ignores: {
        hs: water
          ? [
              "Prepared terrain, not a real catchment. Time is uncalibrated.",
              "No erosion, infiltration or rainfall. Wet dots show depth above the display threshold, not speed.",
            ]
          : [
              "An authored hill, not a real surveyed landscape.",
              "Vertical exaggeration changes the view only.",
            ],
        uni: water
          ? [
              "Closed boundaries except one authored edge outlet; no symmetric destination inference.",
              "No infiltration, evaporation, sediment transport or erosion. Virtual pipes approximate shallow surface flow.",
            ]
          : [
              "Sample-centred, triangulated heightfield; no survey uncertainty.",
              "Flat and lifted drawings share the same extracted isolines.",
            ],
      },
      keyWords: [],
    },
    teacherNotes: "teacher.md",
    sources: water
      ? [
          {
            citation:
              "Mei, Decaudin & Hu. Fast Hydraulic Erosion Simulation and Visualization on GPU (2007). Flow mechanism; parameter choices are educational, not field calibrated.",
            url: "https://www-evasion.imag.fr/Publications/2007/MDH07/",
          },
        ]
      : [
          {
            citation:
              "US Geological Survey. What is a topographic map? Contours join points of equal height.",
            url: "https://www.usgs.gov/faqs/what-a-topographic-map",
          },
        ],
  };
}
export const contourSpread = lesson("contour");
export const waterSpread = lesson("water");
