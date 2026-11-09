export interface FieldTolerance {
  readonly absolute: number;
  readonly relative: number;
}
export const WATER_TOLERANCES = Object.freeze({
  waterM: { absolute: 2e-7, relative: 5e-4 },
  fluxM3PerS: { absolute: 2e-6, relative: 5e-4 },
  velocityMPerS: { absolute: 2e-5, relative: 5e-4 },
});
/** Absolute floor protects near-dry zeros; relative tolerance scales with the local reference magnitude. */
export function compareFields(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  tolerance: FieldTolerance,
) {
  if (actual.length !== expected.length) throw new RangeError("Comparison arrays differ in length");
  let maxAbsolute = 0,
    maxScaled = 0,
    failed = 0;
  for (let i = 0; i < actual.length; i++) {
    const difference = Math.abs(actual[i] - expected[i]);
    const allowed = tolerance.absolute + tolerance.relative * Math.abs(expected[i]);
    const scaled = difference / allowed;
    if (!Number.isFinite(difference) || scaled > 1) failed++;
    maxAbsolute = Math.max(maxAbsolute, difference);
    maxScaled = Math.max(maxScaled, scaled);
  }
  return { maxAbsolute, maxScaled, failed };
}
