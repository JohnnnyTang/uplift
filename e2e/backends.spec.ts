import { test, expect, type Page, type TestInfo } from "@playwright/test";
import process from "node:process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import data from "../hachure/terrain/src/validation/rain-comparison-data.json" with { type: "json" };
import { ready, scienceGuards, unchangedAcrossLevels } from "./helpers";

// Generic CI keeps its bundled Chromium/software rendering settings. Hardware proof
// explicitly selects installed Chrome and does not inherit SwiftShader forcing.
if (process.env.UPLIFT_BACKEND_CHROME)
  test.use({ channel: "chrome", launchOptions: { args: ["--enable-unsafe-webgpu"] } });

async function openBackend(page: Page, backend: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await ready(page, `/?backend=${backend}&debug`);
  await expect(page.locator(".book")).toHaveAttribute("data-backend-ready", "true");
  await expect(page.locator(".terrain-flat svg path").first()).toBeVisible();
  return errors;
}
async function predict(page: Page) {
  await page.locator('input[name="prediction"]').nth(data.answer).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Show result", exact: true })).toBeEnabled();
}
async function checkDomain(page: Page, grid: number) {
  await expect(page.locator(".book")).toHaveAttribute("data-grid", String(grid));
  await expect(page.locator(".runtime-debug")).toHaveAttribute("data-grid", String(grid));
  // The bound scale bar is one quarter of the actual snapshot domain.
  await expect(page.locator(".widget-scale")).toContainText(/320\s*m/);
}
async function stable(page: Page) {
  await expect
    .poll(async () => {
      const before = await page.locator(".book").getAttribute("data-state-hash");
      await page.waitForTimeout(150);
      return before === (await page.locator(".book").getAttribute("data-state-hash"));
    })
    .toBe(true);
}
async function canvasStats(page: Page, bytes: Buffer) {
  return page.evaluate(async (encoded) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(encoded)], { type: "image/png" }));
    const copy = document.createElement("canvas");
    copy.width = bitmap.width;
    copy.height = bitmap.height;
    const context = copy.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    let minimum = 255,
      maximum = 0,
      opaque = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      minimum = Math.min(minimum, pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
      maximum = Math.max(maximum, pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
      if (pixels[i + 3]! > 0) opaque++;
    }
    bitmap.close();
    return { width: copy.width, height: copy.height, contrast: maximum - minimum, opaque };
  }, Array.from(bytes));
}
async function record(page: Page, testInfo: TestInfo, name: string, extra: Record<string, unknown> = {}) {
  const metadata = await page.evaluate(async () => {
    const book = document.querySelector<HTMLElement>(".book")!;
    const adapter = await navigator.gpu?.requestAdapter();
    return {
      utc: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      book: { ...book.dataset },
      debug: { ...document.querySelector<HTMLElement>(".runtime-debug")!.dataset },
      scale: document.querySelector(".widget-scale")!.textContent,
      adapter: adapter
        ? {
            vendor: adapter.info.vendor,
            architecture: adapter.info.architecture,
            device: adapter.info.device,
            description: adapter.info.description,
            isFallbackAdapter: adapter.info.isFallbackAdapter,
          }
        : null,
    };
  });
  const evidence = {
    ...metadata,
    ...extra,
    scope:
      "Actual book integration in headless Chrome; uncontrolled power/thermal conditions, no classroom frame-rate or expert-science acceptance",
  };
  await testInfo.attach(name, { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
  if (process.env.UPLIFT_BACKEND_EVIDENCE) {
    const directory = resolve("hachure/runtime/src/sim-host/backend/evidence");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, `${name}.json`), JSON.stringify(evidence, null, 2) + "\n");
    await page.screenshot({ path: resolve(directory, `${name}.png`), fullPage: true });
  }
}

for (const [backend, grid] of [
  ["webgpu", 256],
  ["cpu-worker", 128],
  ["cpu-64", 64],
  ["flat", 64],
] as const) {
  test(`forced ${backend}: domain, rendered tier, level preservation and reset`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const errors = await openBackend(page, backend),
      book = page.locator(".book");
    const selected = await book.getAttribute("data-backend");
    if (backend === "webgpu" && selected !== "webgpu") {
      // Generic CI may have no usable WebGPU adapter. This is truthful fallback,
      // not a substitute for the separately required local hardware proof.
      expect(
        process.env.UPLIFT_REQUIRE_WEBGPU,
        (await book.getAttribute("data-backend-failures")) ?? "",
      ).toBeFalsy();
      expect(selected).toBe("flat");
      expect(JSON.parse((await book.getAttribute("data-backend-failures"))!)).toEqual([
        expect.objectContaining({ backend: "webgpu", reason: expect.any(String) }),
      ]);
      await checkDomain(page, 64);
      await record(page, testInfo, "forced-webgpu-unavailable");
      return;
    }
    await expect(book).toHaveAttribute("data-backend", backend);
    await checkDomain(page, grid);
    const initialHash = await book.getAttribute("data-state-hash");
    await expect(book).toHaveAttribute("data-step", "0");
    await predict(page);
    if (backend === "flat") {
      for (const selector of ["#rain", "#speed", "#valley-tools-tool"])
        await expect(page.locator(selector)).toBeDisabled();
      for (const name of ["Play", "Pause"])
        await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
      await expect(page.locator("canvas")).toHaveCSS("opacity", "0");
      await expect(page.locator(".terrain-flat svg path").first()).toBeVisible();
    } else {
      await expect(page.locator("#rain")).toBeEnabled();
      await expect(page.locator("#valley-tools-tool")).toBeEnabled();
      await expect(page.locator("canvas")).toHaveCSS("opacity", "1");
      await expect(page.locator(".runtime-debug")).toContainText(
        `renderer ${backend === "webgpu" ? "webgpu" : "webgl2"}`,
      );
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect.poll(async () => Number(await book.getAttribute("data-step"))).toBeGreaterThan(0);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await stable(page);
      const image = await page.locator("canvas").screenshot(),
        pixels = await canvasStats(page, image);
      expect(pixels.opaque).toBeGreaterThan(0);
      expect(pixels.contrast).toBeGreaterThan(40);
      await testInfo.attach(`${backend}-terrain`, { body: image, contentType: "image/png" });
      if (backend === "webgpu")
        await record(page, testInfo, "book-webgpu256", { pixels, domainM: 1280, metresPerCell: 5 });
    }
    await page.getByRole("button", { name: "Show result", exact: true }).click();
    await expect(page.locator(".comparison-feedback")).toContainText(
      "Your prediction matches this comparison",
    );
    await unchangedAcrossLevels(page);
    await scienceGuards(page);
    await record(page, testInfo, `forced-${backend}`, { domainM: 1280, metresPerCell: 1280 / grid });
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(book).toHaveAttribute("data-step", "0");
    await expect(book).toHaveAttribute("data-state-hash", initialHash!);
    await expect(book).toHaveAttribute("data-backend", backend);
    await checkDomain(page, grid);
    await expect(page.locator("#rain-comparison-timeline")).toBeDisabled();
    await expect(page.locator(".paired-replay")).toHaveAttribute("data-values", "[0,0]");
    await unchangedAcrossLevels(page);
    if (backend === "flat") {
      await predict(page);
      await page.getByRole("button", { name: "Show result", exact: true }).click();
      await expect(page.getByRole("button", { name: "Reveal explanation" })).toBeEnabled();
      await page.getByRole("button", { name: "Replay comparison" }).click();
      await expect(page.locator(".paired-replay")).toHaveAttribute("data-playing", "true");
      await page.getByRole("button", { name: "Pause comparison" }).click();
      await expect(book).toHaveAttribute("data-state-hash", initialHash!);
      await expect(page.locator("#rain")).toBeDisabled();
    }
    expect(errors).toEqual([]);
  });
}

for (const failure of ["gpu", "gpu-worker", "gpu-rendering", "gpu-null-rendering"] as const) {
  test(`automatic chain recovers from unavailable ${failure}`, async ({ page }, testInfo) => {
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, "gpu", {
        value: mode === "gpu-null-rendering" ? { requestAdapter: async () => null } : undefined,
        configurable: true,
      });
      if (mode === "gpu-worker") {
        const ActualWorker = window.Worker;
        window.Worker = new Proxy(ActualWorker, {
          construct(target, args) {
            if (String(args[0]).includes("terrain.worker"))
              throw new Error("Test: terrain Worker unavailable");
            return Reflect.construct(target, args);
          },
        });
      }
      if (mode === "gpu-rendering" || mode === "gpu-null-rendering") {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          type: string,
          ...args: unknown[]
        ) {
          if (["webgl", "experimental-webgl", "webgl2", "webgpu"].includes(type)) return null;
          return Reflect.apply(original, this, [type, ...args]);
        } as typeof original;
      }
    }, failure);
    const errors = await openBackend(page, "auto"),
      book = page.locator(".book");
    const selected = await book.getAttribute("data-backend"),
      failures = JSON.parse((await book.getAttribute("data-backend-failures"))!) as {
        backend: string;
        reason: string;
      }[];
    expect(failures[0]!.backend).toBe("webgpu");
    if (failure === "gpu") {
      expect(["cpu-worker", "cpu-64"]).toContain(selected);
      if (selected === "cpu-64")
        expect(failures.find((f) => f.backend === "cpu-worker")!.reason).toMatch(/Measured compute/);
    } else if (failure === "gpu-worker") {
      expect(selected).toBe("cpu-64");
      expect(failures.find((f) => f.backend === "cpu-worker")!.reason).toContain("Worker unavailable");
    } else {
      expect(selected).toBe("flat");
      for (const tier of ["cpu-worker", "cpu-64"])
        expect(failures.find((f) => f.backend === tier)!.reason).toContain("WebGL2 rendering unavailable");
    }
    await checkDomain(page, selected === "cpu-worker" ? 128 : 64);
    await predict(page);
    await page.getByRole("button", { name: "Show result", exact: true }).click();
    await expect(page.locator(".comparison-feedback")).toContainText(
      "Your prediction matches this comparison",
    );
    if (selected === "flat") await expect(page.locator("#rain")).toBeDisabled();
    await scienceGuards(page);
    await record(page, testInfo, `failure-${failure}`, { mockedUnavailable: failure });
    expect(errors).toEqual([]);
  });
}

test("automatic unforced selection initializes a real tier and preserves the preset after admission", async ({
  page,
}, testInfo) => {
  const errors = await openBackend(page, "auto"),
    book = page.locator(".book"),
    selected = await book.getAttribute("data-backend");
  expect(["webgpu", "cpu-worker", "cpu-64", "flat"]).toContain(selected);
  if (process.env.UPLIFT_REQUIRE_WEBGPU)
    expect(selected, (await book.getAttribute("data-backend-failures")) ?? "").toBe("webgpu");
  const grid = selected === "webgpu" ? 256 : selected === "cpu-worker" ? 128 : 64;
  await checkDomain(page, grid);
  await expect(book).toHaveAttribute("data-step", "0");
  await predict(page);
  if (selected !== "flat") {
    await expect(page.locator("canvas")).toHaveCSS("opacity", "1");
    const image = await page.locator("canvas").screenshot(),
      pixels = await canvasStats(page, image);
    expect(pixels.contrast).toBeGreaterThan(40);
    expect(pixels.opaque).toBeGreaterThan(0);
  }
  await record(page, testInfo, `automatic-${selected}`, { domainM: 1280, metresPerCell: 1280 / grid });
  await scienceGuards(page);
  expect(errors).toEqual([]);
});
