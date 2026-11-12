import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

describe("ESLint bans Math.random in hachure/glacier", () => {
  it("reports Math.random() in glacier source", async () => {
    const eslint = new ESLint();
    const [result] = await eslint.lintText("export const x = Math.random();\n", {
      filePath: "hachure/glacier/src/cpu/__lint_probe__.ts",
    });
    expect(result!.messages.map((m) => m.ruleId)).toContain("no-restricted-properties");
  }, 30_000);
});
