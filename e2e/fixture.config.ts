import { defineConfig } from "vite";

// Test-only entries never become part of the production book build.
export default defineConfig({ root: "." });
