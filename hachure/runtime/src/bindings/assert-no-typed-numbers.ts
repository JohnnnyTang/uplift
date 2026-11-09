import { findTypedNumbers, type LevelText } from "../schema/index";

/** Content-test assertion. Strings support scanning individual fields as well as LevelText pairs. */
export function assertNoTypedNumbers(levelText: LevelText | string): void {
  const entries = typeof levelText === "string" ? [["text", levelText]] : Object.entries(levelText);
  const issues = entries.flatMap(([level, text]) =>
    findTypedNumbers(text!).map((value) => `${level}: ${value}`),
  );
  if (issues.length) throw new Error(`Page numbers must be bindings (${issues.join("; ")})`);
}
