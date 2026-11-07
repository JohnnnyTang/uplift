import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["spikes/ink-look/*.test.ts"], environment: "node" } });
