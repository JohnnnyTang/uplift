import type { Spread } from "@hachure/runtime";
const both = (text: string) => ({ hs: text, uni: text });
/** UI fixture only: no scientific claims, answer evidence, calibration or challenge award. */
export const mockSpread: Spread = {
  schemaVersion: 0,
  id: "test.widgets",
  title: both("Read the page. Try the controls."),
  tags: { domain: ["test"], courses: [], levels: ["hs", "uni"] },
  tier: "process-model",
  engine: "terrain",
  scene: {
    preset: "fake-tilted-plane",
    seed: 7,
    camera: { position: [0, 1, 1], target: [0, 0, 0], fovDeg: 40 },
    stepsPerRealSecond: 20,
  },
  controls: [
    {
      kind: "slider",
      id: "rain",
      label: both("Rain input"),
      levels: ["hs", "uni"],
      param: "rainMmPerHr",
      min: 0,
      max: 50,
      step: 1,
      default: 10,
      unit: "mm/h",
    },
    {
      kind: "speed",
      id: "speed",
      label: both("Playback speed"),
      levels: ["hs", "uni"],
      min: 0.25,
      max: 4,
      step: 0.25,
      default: 1,
    },
  ],
  probes: [],
  page: {
    body: {
      hs: "This test spread lets you rehearse the book’s guided loop: predict, test, then reveal. The drawing uses a fake solver, so it cannot answer a geography question.",
      uni: "The reading level changes this page’s depth while preserving the same fixture state, prediction and controls. The formula below is a typesetting specimen, with semantic MathML.",
    },
    predict: {
      question: both("What do you want to inspect first?"),
      options: [both("The water readout"), both("The surface drawing"), both("The control labels")],
      answer: 0,
    },
    flap: both(
      "You committed a choice before testing. This fixture records your choice without marking it right or wrong. A scientific spread must supply model-backed evidence before it can score an answer.",
    ),
    ignores: {
      hs: [
        "This is a widget test fixture, not a scientific model.",
        "The fake solver scripts its surface changes; no landform or time calibration is demonstrated.",
      ],
      uni: [
        "All fake-solver magnitudes are arbitrary and unsuitable for scientific interpretation.",
        "Calibration, qualitative validation, real terrain rendering and challenge assessment belong to later integration.",
      ],
    },
    keyWords: [
      { term: both("Prediction"), definition: both("A choice you commit before testing.") },
      {
        term: both("Reading level"),
        definition: both("The depth of explanation; changing it keeps the same running state."),
      },
    ],
    equations: ["a + b = c"],
  },
  challenge: {
    prompt: both("Inspect the widgets; no scientific challenge is scored."),
    check: { kind: "all", checks: [] },
    stamp: { id: "none", label: both("No stamp in a fixture") },
  },
  teacherNotes: "This test fixture is for interface review only.",
  sources: [
    { citation: "KaTeX API: semantic HTML and MathML output", url: "https://katex.org/docs/api.html" },
  ],
};
