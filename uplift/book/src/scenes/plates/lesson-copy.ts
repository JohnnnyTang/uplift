/**
 * 7E's lesson words for _Where plates meet_ (`@uplift/spreads`, tectonics.plate-boundaries) mapped onto the
 * words 7D's scene renders (`PlatesSceneCopy`), field by field as D-W7-7D lists (session 7F, D-W7-7F). No
 * word is written here: every string comes from the lesson, which carries the expert-review marks and the
 * claim register. ILLUSTRATION: authored shapes, not a simulation (D-L2-1).
 */
import type { LevelText } from "@hachure/runtime";
import {
  platesDeeperText,
  platesLesson as lesson,
  platesPage,
  platesSpread,
  platesTeacherNotes,
} from "@uplift/spreads";
import type { PlatesSceneCopy } from "./copy";
import type { PlateBoundary } from "./relief/index";

const c = lesson.controlsCopy;
const boundary = (id: PlateBoundary) => {
  const b = lesson.boundaries.find((x) => x.id === id)!;
  return { name: b.name, help: b.help };
};
const perLevel = (list: { readonly hs: readonly string[]; readonly uni: readonly string[] }) =>
  Array.from({ length: Math.max(list.hs.length, list.uni.length) }, (_, i) => i).map((i): LevelText => ({
    hs: list.hs[i] ?? "",
    uni: list.uni[i] ?? "",
  }));

/** Lesson 2's copy, ready for `createPlatesSpreadScene({ copy })`. */
export const PLATES_LESSON_COPY: PlatesSceneCopy = Object.freeze({
  lessonNumber: lesson.LESSON_NUMBER,
  title: lesson.title,
  runningHeads: lesson.runningHeads,
  body: platesPage.body,
  keyWords: lesson.keyWords.map((k) => ({ term: k.term, definition: k.definition })),
  predict: { question: lesson.predict.question, options: lesson.predict.options },
  flap: { summary: c.flapSummary, answer: platesPage.flap },
  labelLine: lesson.figure.label,
  figure: {
    number: lesson.FIGURE_NUMBER,
    caption: lesson.figure.caption,
    drawingAlternative: lesson.figure.drawingAlternative,
    scale: lesson.figure.scaleNote,
    labels: lesson.figure.labels,
  },
  boundaries: {
    convergent: boundary("convergent"),
    divergent: boundary("divergent"),
    transform: boundary("transform"),
  },
  controls: {
    pickerLegend: c.boundaryLegend,
    noBoundary: c.noBoundary,
    start: lesson.stageWords.start,
    stageLegend: c.stageLegend,
    early: c.stageEarly,
    middle: lesson.stageWords.middle,
    late: c.stageLate,
    play: c.play,
    pause: c.pause,
    frontFace: c.frontFace,
    reset: c.reset,
    replay: c.replay,
    leftPlateArrow: c.leftPlateArrow,
    rightPlateArrow: c.rightPlateArrow,
    arrowHelp: c.arrowHelp,
    invite: c.boundaryHelp,
    ghostsLegend: c.ghostLegend,
  },
  textAlternatives: {
    start: lesson.textAlternatives.start,
    boundary: lesson.textAlternatives.boundary,
  },
  showsIgnores: { shows: perLevel(lesson.shows), ignores: perLevel(platesPage.ignores) },
  deeper: platesDeeperText,
  equations: platesPage.equations,
  teacherNotes: platesTeacherNotes,
  sources: platesSpread.sources.map((s) => ({
    citation: s.citation,
    ...(s.url ? { url: s.url } : s.doi ? { url: `https://doi.org/${s.doi}` } : {}),
  })),
});
