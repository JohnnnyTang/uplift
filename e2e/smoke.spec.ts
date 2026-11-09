import { test, expect } from "@playwright/test";
import { ready, commit, scienceGuards, unchangedAcrossLevels } from "./helpers";

test("flat diagram, prediction gate, rendered lift and live state preservation", async ({
  page,
}, testInfo) => {
  const errors = await ready(page);
  await expect(page.locator(".runtime-debug")).toHaveCount(0);
  await expect(page.locator(".terrain-flat svg path").first()).toBeVisible();
  await expect(page.locator("#rain")).toBeDisabled();
  await expect(page.locator("#valley-tools-tool")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Show result", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Reveal explanation" })).toBeDisabled();
  // AC7: scope and the quantity legends stay visible in both reading levels.
  await expect(page.locator(".widget-tier")).toContainText("Process model");
  await expect(page.locator(".widget-scale")).toContainText(/m/);
  await expect(page.getByLabel("Colour and quantity legend")).toContainText(/Water/);
  await expect(page.getByText("What this model ignores", { exact: true })).toBeVisible();
  await scienceGuards(page);
  await expect(page.locator("math")).toBeHidden();
  await commit(page);
  await expect
    .poll(async () => Number(await page.locator(".book").getAttribute("data-step")))
    .toBeGreaterThan(0);
  await expect(page.locator("canvas")).toHaveCSS("opacity", "1");
  // Inspect a captured complete frame, not only an opaque canvas element.
  const image = await page.locator("canvas").screenshot();
  await testInfo.attach("raised-terrain", { body: image, contentType: "image/png" });
  const pixelStats = await page.evaluate(async (bytes) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let min = 255,
      max = 0,
      opaque = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      min = Math.min(min, pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
      max = Math.max(max, pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
      if (pixels[i + 3]! > 0) opaque++;
    }
    return { contrast: max - min, opaque };
  }, Array.from(image));
  expect(pixelStats.opaque).toBeGreaterThan(0);
  expect(pixelStats.contrast).toBeGreaterThan(40);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  // Wait for the pause-triggered atomic refresh and any in-flight worker batch.
  await expect
    .poll(async () => {
      const first = await page.locator(".book").getAttribute("data-state-hash");
      await page.waitForTimeout(150);
      return first === (await page.locator(".book").getAttribute("data-state-hash"));
    })
    .toBe(true);
  if (await page.getByRole("button", { name: "Pause comparison" }).count())
    await page.getByRole("button", { name: "Pause comparison" }).click();
  await unchangedAcrossLevels(page);
  await page.getByLabel("Reading level").selectOption("uni");
  await expect(page.locator("math")).toBeVisible();
  await expect(page.getByText("Comparative theory", { exact: true })).toBeVisible();
  await page.getByLabel("Reading level").selectOption("hs");
  await expect(page.getByText("Comparative theory", { exact: true })).toBeHidden();
  expect(errors).toEqual([]);
});

test("debug readout is opt-in and uses measured worker batch timings", async ({ page }) => {
  const errors = await ready(page, "/?debug");
  const debug = page.getByRole("complementary", { name: "Runtime diagnostics" });
  await expect(debug).toHaveAttribute("data-grid", "128");
  await expect(debug).toHaveAttribute("data-backend", "cpu-worker");
  await expect(debug).toHaveAttribute("data-ms-per-step", "pending");
  await expect(debug).toHaveAttribute("data-seed", /\d+/);
  await expect.poll(async () => Number(await debug.getAttribute("data-fps"))).toBeGreaterThan(0);
  await commit(page);
  await expect(debug).toHaveAttribute("data-ms-per-step", /^\d+(\.\d+)?$/);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  // Diagnostics can observe an unsampled batch before the page snapshot catches up.
  // Pause requests an async atomic refresh; wait for that snapshot before reading its counters.
  await expect
    .poll(async () => Number(await page.locator(".book").getAttribute("data-batch-steps")))
    .toBeGreaterThan(0);
  const batch = await page.locator(".book").evaluate((node) => ({
    ms: Number(node.dataset.batchMs),
    steps: Number(node.dataset.batchSteps),
  }));
  expect(batch.steps).toBeGreaterThan(0);
  expect(batch.ms).toBeGreaterThanOrEqual(0);
  await expect(debug).toContainText(/Page fps.*ms\/step.*grid.*backend.*seed/);
  expect(errors).toEqual([]);
});
