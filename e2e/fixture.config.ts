import { defineConfig } from "vite";

// Test-only entries never become part of the production book build.
// Standalone spikes have their own aliases; do not scan their HTML as test entries.
export default defineConfig({ root: ".", optimizeDeps: { entries: ["e2e/fixtures/*.html"] } });
