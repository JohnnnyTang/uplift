import { defineConfig } from "vite";

// Public path of the built book. "/" for local use and CI; the GitHub Pages workflow sets
// UPLIFT_BASE to the project path ("/uplift/") because Pages serves the repository under a sub-path.
const base = process.env.UPLIFT_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [
    {
      name: "reader-default-language",
      transformIndexHtml(html) {
        if (process.env.UPLIFT_DEFAULT_LANGUAGE !== "zh-CN") return html;
        return html
          .replace('<html lang="en">', '<html lang="zh-CN">')
          .replace("<title>Uplift</title>", "<title>一页山河</title>");
      },
    },
  ],
  build: {
    target: "es2023",
  },
});
