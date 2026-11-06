// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", "**/playwright-report/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Architecture rule: Hachure (the engine) never imports from Uplift (the book).
    files: ["hachure/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@uplift/*"], message: "Hachure must never import from Uplift." },
            { group: ["**/uplift/**"], message: "Hachure must never import from Uplift." },
          ],
        },
      ],
    },
  },
  {
    // Spreads use Hachure's public API only: no deep imports into package internals.
    files: ["uplift/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@hachure/*/src/*", "**/hachure/**"],
              message: "Use the @hachure/* public entry points only.",
            },
          ],
        },
      ],
    },
  },
);
