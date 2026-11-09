import process from "node:process";
import { defineConfig } from "@playwright/test";

const appPort = process.env.UPLIFT_E2E_PORT ?? "4173";
const fixturePort = process.env.UPLIFT_FIXTURE_PORT ?? "4174";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...(process.env.UPLIFT_E2E_CHANNEL ? { channel: process.env.UPLIFT_E2E_CHANNEL } : {}),
    baseURL: `http://127.0.0.1:${appPort}`,
    viewport: { width: 1366, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: [
    {
      command: `pnpm build && pnpm --filter @uplift/book preview --host 127.0.0.1 --port ${appPort} --strictPort`,
      url: `http://127.0.0.1:${appPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm exec vite --config e2e/fixture.config.ts --host 127.0.0.1 --port ${fixturePort} --strictPort`,
      url: `http://127.0.0.1:${fixturePort}/e2e/fixtures/science.html`,
      reuseExistingServer: false,
    },
  ],
});
