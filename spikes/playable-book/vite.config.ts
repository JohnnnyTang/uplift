import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
export default defineConfig({
  cacheDir: root + "node_modules/.vite-playable-book",
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: {
    alias: [
      { find: "@hachure/ink/view", replacement: root + "hachure/ink/src/view/index.ts" },
      { find: "@hachure/ink", replacement: root + "hachure/ink/src/index.ts" },
      { find: "@hachure/terrain", replacement: root + "hachure/terrain/src/index.ts" },
    ],
  },
  server: { host: "127.0.0.1", port: 5188, fs: { allow: [root] } },
  build: { target: "es2023" },
});
