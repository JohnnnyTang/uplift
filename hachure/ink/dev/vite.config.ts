import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Dev page for @hachure/ink: `pnpm --filter @hachure/ink dev`.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: { host: "127.0.0.1", port: 5176 },
  build: { target: "es2023" },
  // `@hachure/terrain/testing` imports Vitest next to the fake solver; stub it in the browser.
  resolve: { alias: { vitest: fileURLToPath(new URL("./vitest-shim.ts", import.meta.url)) } },
});
