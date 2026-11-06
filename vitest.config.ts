import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["hachure/*/src/**/*.test.ts", "uplift/*/src/**/*.test.ts", "uplift/spreads/**/*.test.ts"],
    environment: "node",
  },
});
