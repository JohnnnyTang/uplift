import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import process from "node:process";

export default defineConfig({
  test: {
    include: ["src/compare/**/*.browser.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
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
