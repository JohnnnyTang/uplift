/** Registry of the real spreads shipped in the book. */
import { contourSpread, waterSpread } from "../book/src/scenes/content";
import { valleySpread } from "./geomorph.v-valley/spread";
export { valleySpread, contourSpread, waterSpread };
export { teacherNotesText as valleyTeacherNotes } from "./geomorph.v-valley/content";
export const spreads = [contourSpread, waterSpread] as const;
/** Historical process-model research remains explicitly reachable. */
export const researchSpreads = [valleySpread] as const;
export const spreadIds: readonly string[] = spreads.map((spread) => spread.id);
