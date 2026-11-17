import { defineConfig } from "vite";

// Public path of the built book. "/" for local use and CI; the GitHub Pages workflow sets
// UPLIFT_BASE to the project path ("/uplift/") because Pages serves the repository under a sub-path.
const base = process.env.UPLIFT_BASE ?? "/";

export default defineConfig({
  base,
  build: {
    target: "es2023",
  },
});
