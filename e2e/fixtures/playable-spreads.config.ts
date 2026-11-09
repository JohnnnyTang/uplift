import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
export default defineConfig({
  root,
  resolve: {
    alias: [
      { find: "@hachure/ink/view", replacement: root + "hachure/ink/src/view/index.ts" },
      { find: "@hachure/ink", replacement: root + "hachure/ink/src/index.ts" },
      { find: "@hachure/runtime", replacement: root + "hachure/runtime/src/index.ts" },
      { find: "@hachure/terrain/gpu", replacement: root + "hachure/terrain/src/gpu/index.ts" },
      { find: "@hachure/terrain", replacement: root + "hachure/terrain/src/index.ts" },
    ],
  },
  server: { host: "127.0.0.1", port: 4474, fs: { allow: [root] } },
});
