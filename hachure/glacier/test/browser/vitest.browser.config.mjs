// Real-browser CPU/GPU glacier comparison (session 5I). Same harness as the water comparison
// (hachure/terrain/src/compare/vitest.browser.config.mjs): Vitest browser mode, Playwright, installed Chrome
// with --enable-unsafe-webgpu by default; GPU_CHROMIUM_BUNDLED=1 uses Playwright's Chromium, GPU_SOFTWARE=1
// requests a software adapter. The registered-horizon suite runs only with GLACIER_GPU_FULL=1.
import { URL, fileURLToPath } from "node:url";
import process from "node:process";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

const full = process.env.GLACIER_GPU_FULL === "1";
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url)),
  define: {
    __GLACIER_GPU_FULL__: JSON.stringify(full),
    // Session 5N: an acceptance rerun writes its own evidence directory (relative to this root).
    __GLACIER_GPU_OUT__: JSON.stringify(process.env.GLACIER_GPU_OUT ?? null),
  },
  test: {
    include: ["test/browser/**/*.browser.ts"],
    testTimeout: full ? 4 * 3_600_000 : 600_000,
    hookTimeout: 600_000,
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
      provider: playwright({
        launchOptions: {
          ...(process.env.GPU_CHROMIUM_BUNDLED ? {} : { channel: "chrome" }),
          args: [
            "--enable-unsafe-webgpu",
            ...(process.env.GPU_SOFTWARE ? ["--use-angle=swiftshader", "--enable-features=Vulkan"] : []),
          ],
        },
      }),
      instances: [{ browser: "chromium" }],
    },
  },
});
