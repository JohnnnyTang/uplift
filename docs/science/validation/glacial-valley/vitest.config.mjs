// Session 5N acceptance evaluation (gated by GLACIAL_VALLEY_EVALUATE=1; not part of `pnpm test`).
// Run through `node docs/science/validation/glacial-valley/run.mjs evaluate`.
import { URL, fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL("../../../..", import.meta.url)),
  test: {
    include: ["docs/science/validation/glacial-valley/*.acceptance.ts"],
    environment: "node",
    testTimeout: 600_000,
  },
});
