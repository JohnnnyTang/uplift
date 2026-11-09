import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  // Vitest runs from the repository root, so ESLint picks up eslint.config.js there.
  const eslint = new ESLint();
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages.map((m) => m.ruleId ?? "parse-error");
}

describe("ESLint bans Math.random in hachure/terrain", () => {
  it("reports Math.random() in terrain source", async () => {
    const ids = await ruleIds(
      "export const x = Math.random();\n",
      "hachure/terrain/src/rng/__lint_probe__.ts",
    );
    expect(ids).toContain("no-restricted-properties");
  }, 30_000);

  it("allows the seeded generator", async () => {
    const ids = await ruleIds(
      'import { createRng } from "./index";\nexport const x = createRng(1).nextFloat();\n',
      "hachure/terrain/src/rng/__lint_probe__.ts",
    );
    expect(ids).toEqual([]);
  }, 30_000);
});
