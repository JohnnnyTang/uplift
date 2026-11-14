/** Registry of the real spreads shipped in the book. */
import { waterSpread } from "../book/src/scenes/content";
import { valleySpread } from "./geomorph.v-valley/spread";
import { uValleySpread } from "./geomorph.u-valley/spread";
export { valleySpread, waterSpread, uValleySpread };
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
/** The default book (5M): From V to U opens it and the water lesson is spread 2. */
export const spreads = [uValleySpread, waterSpread] as const;
/** Historical process-model research remains explicitly reachable. */
export const researchSpreads = [valleySpread] as const;
export const spreadIds: readonly string[] = spreads.map((spread) => spread.id);
