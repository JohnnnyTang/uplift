/** Registry of the real spreads shipped in the book. */
import { valleySpread } from "./geomorph.v-valley/spread";
import { uValleySpread } from "./geomorph.u-valley/spread";
import { platesSpread } from "./tectonics.plate-boundaries/spread";
export { valleySpread, uValleySpread, platesSpread };
export { teacherNotesText as valleyTeacherNotes } from "./geomorph.v-valley/content";
/** "From V to U" (5L): editorial pieces, view defaults and reader text, for the book (5M). */
export * as uValleyLesson from "./geomorph.u-valley/lesson";
export { U_VALLEY_VIEW, noteSpanM, roundForNote, resolveDefaultFrontFace } from "./geomorph.u-valley/config";
export {
  deeperText as uValleyDeeperText,
  pageContent as uValleyPage,
  teacherNotesText as uValleyTeacherNotes,
} from "./geomorph.u-valley/content";
export { uValleyProbes } from "./geomorph.u-valley/bindings";
/** "Where plates meet" (7E): lesson 2, an illustration (D-L2-1); its words for the plates scene (7D, 7F). */
export * as platesLesson from "./tectonics.plate-boundaries/lesson";
export {
  deeperText as platesDeeperText,
  pageContent as platesPage,
  teacherNotesText as platesTeacherNotes,
} from "./tectonics.plate-boundaries/content";
export { platesProbes } from "./tectonics.plate-boundaries/bindings";
export { sources as platesSources } from "./tectonics.plate-boundaries/sources";
/** The default book: From V to U, then Where plates meet (7F, D-L2-1 decision 6: two lessons, a real page turn). */
export const spreads = [uValleySpread, platesSpread] as const;
/** Historical process-model research remains explicitly reachable. */
export const researchSpreads = [valleySpread] as const;
export const spreadIds: readonly string[] = spreads.map((spread) => spread.id);
