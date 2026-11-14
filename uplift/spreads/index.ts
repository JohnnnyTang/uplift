/** Registry of the real spreads shipped in the book. */
import { valleySpread } from "./geomorph.v-valley/spread";
import { uValleySpread } from "./geomorph.u-valley/spread";
export { valleySpread, uValleySpread };
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
/** The default book: the single lesson From V to U (the water lesson was removed in 5N2, D-W5-5N2). */
export const spreads = [uValleySpread] as const;
/** Historical process-model research remains explicitly reachable. */
export const researchSpreads = [valleySpread] as const;
export const spreadIds: readonly string[] = spreads.map((spread) => spread.id);
