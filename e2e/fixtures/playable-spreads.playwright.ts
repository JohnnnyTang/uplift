import { defineConfig } from "@playwright/test";
process.env.PLAYABLE_FIXTURE_URL = "http://127.0.0.1:4474";
export default defineConfig({
  testDir: "..",
  testMatch: "playable-spreads.spec.ts",
  timeout: 60000,
  workers: 1,
  use: {
    viewport: { width: 1366, height: 768 },
    launchOptions: { channel: "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
    video: "on",
  },
  webServer: {
    command: "pnpm exec vite --config e2e/fixtures/playable-spreads.config.ts --port 4474 --strictPort",
    url: "http://127.0.0.1:4474/e2e/fixtures/playable-spreads.html",
    reuseExistingServer: true,
  },
});
