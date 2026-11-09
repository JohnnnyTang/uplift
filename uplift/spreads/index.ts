/** Registry of the real spreads shipped in the book. */
import { valleySpread } from "./geomorph.v-valley/spread";
export { valleySpread };
export { teacherNotesText as valleyTeacherNotes } from "./geomorph.v-valley/content";
export const spreads = [valleySpread] as const;
export const spreadIds: readonly string[] = spreads.map((spread) => spread.id);
