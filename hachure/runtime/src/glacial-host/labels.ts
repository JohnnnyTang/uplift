/**
 * Default reader-facing labels for model time and recorded moments. Every number in them is read from model
 * state passed in, never typed. Model time is "model years", time compressed for erosion (D-W5-5G item 7),
 * never geological years. The page (5L) may supply its own wording around the same bound values.
 */

/** Model time as text: whole numbers when whole, else up to two decimals. */
export function formatModelYears(modelYears: number): string {
  const rounded = Math.round(modelYears * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded)} model years`;
}

/** The live run's state now. */
export function liveViewLabel(modelYears: number): string {
  return `model time ${formatModelYears(modelYears)}`;
}

/** A recorded moment of the live run, shown while scrubbing (wave plan §4: "earlier · model time t"). */
export function pastViewLabel(modelYears: number): string {
  return `earlier · model time ${formatModelYears(modelYears)}`;
}

/** A recorded moment of a kept run (scrubbed, flipped to, or drawn as the comparison ghost). */
export function keptRunLabel(ordinal: number, modelYears: number): string {
  return `kept run ${ordinal} · model time ${formatModelYears(modelYears)}`;
}
