import { type ReaderSpread, type Probe } from "@hachure/runtime";
const text = (s: string) => ({ hs: s, uni: s });
export const GEOMETRY_PROBES: readonly Probe[] = [
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
  unit: ["sourceX", "sourceY", "threshold", "fullDepth", "width"].includes(id) ? "m" : "",
  significantFigures: 3,
}));
export const GEOMETRY_CATALOGUE = { params: [], tools: [], probeKinds: ["scene-geometry"] };
/** The water lesson: spread 2 of the default book. */
export const waterSpread: ReaderSpread = {
  schemaVersion: 0,
  id: "hydrology.water-path",
  title: text("Where will the water go?"),
  tags: { domain: ["hydrology"], courses: ["geography"], levels: ["hs", "uni"] },
  tier: "process-model",
  engine: "terrain",
  scene: {
    preset: "prepared-twin-channel",
    seed: 5,
    camera: { position: [0, 1, 1], target: [0, 0, 0], fovDeg: 45 },
    modelScope: { kind: "live-process", time: "uncalibrated" },
    stepsPerRealSecond: 2000,
  },
  controls: [],
  probes: GEOMETRY_PROBES,
  page: {
    body: {
      hs: "Move the spring onto the other hollow. Watch where the surface becomes wet.",
      uni: "Change only the spring position on this prepared surface. Compare the resulting wet extent.",
    },
    predict: {
      question: text("Will the same part of the surface become wet?"),
      options: [text("I think so"), text("I think not")],
      answer: null,
    },
    flap: {
      hs: "<!-- expert-review --> Moving the spring changes where water enters this prepared landscape. The blue patch and ink dots show water in the current model state; earlier water remains after a move.",
      uni: "<!-- expert-review --> The virtual-pipe process model routes water using surface and water levels. Source position changes the wet extent in the registered paired trials on these prepared terrains. The marks do not track individual parcels or establish a general outlet rule.",
    },
    ignores: {
      hs: [
        "Prepared terrain, not a real catchment. Time is uncalibrated.",
        "No erosion, infiltration or rainfall. Wet dots show depth above the display threshold, not speed.",
      ],
      uni: [
        "Closed boundaries except one authored edge outlet; no symmetric destination inference.",
        "No infiltration, evaporation, sediment transport or erosion. Virtual pipes approximate shallow surface flow.",
      ],
    },
    keyWords: [],
  },
  teacherNotes: "teacher.md",
  sources: [
    {
      citation:
        "Mei, Decaudin & Hu. Fast Hydraulic Erosion Simulation and Visualization on GPU (2007). Flow mechanism; parameter choices are educational, not field calibrated.",
      url: "https://www-evasion.imag.fr/Publications/2007/MDH07/",
    },
  ],
};
