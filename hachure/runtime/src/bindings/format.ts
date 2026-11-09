/** Locale is fixed so teachers get reproducible labels on every machine. */
export function formatBoundNumber(value: number, unit = "", significantFigures = 3): string {
  if (!Number.isFinite(value)) throw new RangeError("Binding values must be finite");
  if (!Number.isInteger(significantFigures) || significantFigures < 1 || significantFigures > 15)
    throw new RangeError("Significant figures must be an integer from one to fifteen");
  const formatted = new Intl.NumberFormat("en-US", { maximumSignificantDigits: significantFigures }).format(
    Object.is(value, -0) ? 0 : value,
  );
  return unit && unit !== "1" ? `${formatted} ${unit}` : formatted;
}
