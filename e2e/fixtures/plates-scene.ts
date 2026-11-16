/**
 * Session 7D fixture: lesson 2's production scene mounted the way 7F will mount it (a "stage" entry of the
 * reader shell), after a stand-in for lesson 1 whose state must survive turning to lesson 2 and back.
 * Query: `?mode=flat|tilted`, `?motion=reduce`, `?static=1`, `?level=uni`, `?start=plates` (open on lesson 2).
 */
import { createReaderShell } from "../../uplift/book/src/reader/shell";
import { createSceneFixture } from "../../uplift/book/src/reader/fixtures/scene";
import type { ReaderEntry } from "../../uplift/book/src/reader/contracts";
import type { ReaderSpread } from "../../hachure/runtime/src/index";
import { createPlatesSpreadScene } from "../../uplift/book/src/scenes/plates/index";

const params = new URLSearchParams(location.search);
const both = (value: string) => ({ hs: value, uni: value });
const spreadOf = (id: string, title: string): ReaderSpread => ({
  schemaVersion: 0,
  id,
  title: both(title),
  tags: { domain: [], courses: [], levels: ["hs", "uni"] },
  tier: "physical-law",
  engine: "scene",
  scene: {
    preset: "fixture",
    seed: 1,
    modelScope: { kind: "static-geometry" },
    camera: { position: [0, 1, 1], target: [0, 0, 0], fovDeg: 40 },
  },
  controls: [],
  probes: [],
  page: {
    body: both("Stand-in page for the fixture; it makes no scientific claim."),
    flap: both("Stand-in explanation."),
    ignores: { hs: ["Fixture only."], uni: ["Fixture only."] },
    keyWords: [],
  },
  teacherNotes: "#teacher",
  sources: [{ citation: "Fixture notes; no science demonstrated." }],
});

const lessonOne = createSceneFixture({
  scope: { kind: "live-process", time: "uncalibrated" },
  presentation: {
    level: "hs",
    prediction: { kind: "unanswered" },
    explanationOpen: false,
    liftFraction: 0,
    selection: { kind: "none" },
  },
  attach(container) {
    const button = document.createElement("button");
    button.id = "lesson-one-lift";
    button.textContent = "Lift the stand-in";
    button.onclick = () => {
      const p = lessonOne.controller.presentation();
      lessonOne.controller.present({ ...p, liftFraction: p.liftFraction ? 0 : 1 });
    };
    container.append(button);
  },
});
const mode = params.get("mode");
const entries: ReaderEntry[] = [
  { spread: spreadOf("fixture.lesson-one", "Lesson one stand-in"), createScene: () => lessonOne.controller },
  {
    spread: spreadOf("tectonics.plate-boundaries", "Where plates meet"),
    layout: "stage",
    // The book's wording (`scenes/entries.ts`): this lesson has no recorded runs, only the drawing.
    fallbackStatus: (reason) => `Drawing only: ${reason}`,
    createScene: (level, { folio }) =>
      createPlatesSpreadScene({
        level,
        folio,
        ...(mode === "flat" || mode === "tilted" ? { mode } : {}),
        ...(params.get("motion") === "reduce" ? { reducedMotion: true, mode: "flat" as const } : {}),
        ...(params.get("static") === "1" ? { staticOnly: true } : {}),
      }),
  },
];
const shell = await createReaderShell(document.querySelector<HTMLElement>("#shell")!, entries, {
  initialLevel: params.get("level") === "uni" ? "uni" : "hs",
  history: false,
});
if (params.get("start") === "plates")
  await shell.navigate({ spreadId: "tectonics.plate-boundaries", page: "spread" });
Object.assign(window, { shell, lessonOne });
document.body.dataset.fixtureReady = "true";
