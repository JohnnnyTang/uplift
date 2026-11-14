import { test, expect } from "@playwright/test";
import { ready, commit, scienceGuards, unchangedAcrossLevels } from "./helpers";

test("flat diagram, independent play/reveal, rendered lift and live state preservation", async ({
  page,
}, testInfo) => {
  const errors = await ready(page);
  await expect(page.locator(".runtime-debug")).toHaveCount(0);
  await expect(page.locator(".terrain-flat svg path").first()).toBeVisible();
  await expect(page.locator("#rain")).toBeDisabled();
  await expect(page.locator("#valley-tools-tool")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Show result", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reveal explanation" })).toBeEnabled();
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

test("default book: unanswered play, settled turns, research return and explicit reset", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?backend=cpu-worker");
  // 5M: the default book opens on From V to U (live glacier runtime) and the water lesson is spread 2.
  await expect(page.getByRole("heading", { name: "From V to U", exact: true })).toBeVisible();
  await expect(page.locator(".learning-log, .challenge-status, .paired-replay")).toHaveCount(0);
  const desk = page.locator(".gs-desk");
  await expect(desk).toHaveAttribute("data-transition", "done", { timeout: 60_000 });
  await page.locator(".gs-flap summary").click();
  await expect(page.locator(".gs-flap")).toHaveAttribute("open", "");
  await page.getByRole("radio", { name: /Granite/ }).check();
  await expect(desk).toHaveAttribute("data-live-rock", "granite");
  await page.getByRole("button", { name: "Turn to Where will the water go?" }).click();
  const spring = page.getByRole("button", { name: "Move spring with arrow keys" });
  await expect(spring).toBeEnabled();
  await spring.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => page.locator("[data-wet]").getAttribute("d")).not.toBe("");
  // Wait for a settled response before requiring exact return-state equality.
  await expect
    .poll(async () => {
      const before = await page.locator("[data-wet]").getAttribute("d");
      await page.waitForTimeout(400);
      return before === (await page.locator("[data-wet]").getAttribute("d"));
    })
    .toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.screenshot({ path: "output/playwright/5e-default-water.png", fullPage: true });
  const wet = await page.locator("[data-wet]").getAttribute("d");
  await page.getByRole("button", { name: "University level" }).click();
  await expect(page.locator(".scene-caption")).toContainText("Spring at 19 m, 9 m");
  await expect(page.locator("[data-wet]")).toHaveAttribute("d", wet!);
  await page.getByRole("button", { name: "Contents" }).click();
  await page.getByRole("button", { name: "Research example", exact: true }).click();
  await expect(page.locator(".book")).toHaveAttribute("data-backend-ready", "true");
  await page.getByRole("button", { name: "Reveal explanation", exact: true }).click();
  await expect(page.locator("#explanation")).toBeVisible();
  await expect(page.locator('input[name="prediction"]:checked')).toHaveCount(0);
  await expect(page.locator(".comparison-feedback")).toBeEmpty();
  await page.getByRole("button", { name: "Lift the drawing", exact: true }).click();
  await expect(page.locator("#rain")).toBeEnabled();
  await page.getByRole("button", { name: "Return to the book", exact: true }).click();
  await expect(spring).toBeEnabled();
  await expect(page.locator("[data-wet]")).toHaveAttribute("d", wet!);
  await page.getByRole("button", { name: "Reset illustration" }).click();
  await expect(page.locator("[data-wet]")).toHaveAttribute("d", "");
  await page.getByRole("button", { name: "Turn to From V to U" }).click();
  await expect(desk).toHaveAttribute("data-transition", "done", { timeout: 60_000 });
  await expect(desk).toHaveAttribute("data-live-rock", "granite");
  await expect(page.locator(".gs-flap")).toHaveAttribute("open", "");
  expect(errors).toEqual([]);
});

for (const backend of ["cpu-64", "flat", "webgpu"]) {
  test(`default ${backend}: source readiness, context loss and free navigation`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/?backend=${backend}&spread=hydrology.water-path&page=spread`);
    const spring = page.getByRole("button", { name: "Move spring with arrow keys" });
    await expect(page.locator(".reader-scene-status")).not.toContainText("Preparing");
    if (backend === "flat" || (await spring.isDisabled())) {
      await expect(page.locator(".scene-caption")).toContainText("No live water process");
    } else {
      await spring.focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => page.locator("[data-wet]").getAttribute("d")).not.toBe("");
      await page.getByRole("button", { name: "University level" }).click();
      await expect(page.locator(".scene-caption")).toContainText("Spring at 21 m, 9 m");
      await page.locator(".playable-drawing canvas").dispatchEvent("webglcontextlost");
      await expect(page.locator(".scene-caption")).toContainText("Flat diagram");
    }
    await page.getByRole("button", { name: "Turn to From V to U" }).click();
    await expect(page.getByRole("heading", { name: "From V to U", exact: true })).toBeVisible();
    await page.locator(".gs-flap summary").click();
    await expect(page.locator(".gs-flap")).toHaveAttribute("open", "");
  });
}

test("actual phone book has readable pages and a rapid in-flight departure retains the source", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?backend=cpu-worker&spread=hydrology.water-path&page=illustration");
  const spring = page.getByRole("button", { name: "Move spring with arrow keys" });
  await expect(spring).toBeEnabled();
  await spring.focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Read the explanation", exact: true }).click();
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-page", "text");
  await page.getByRole("button", { name: "Explore the illustration", exact: true }).click();
  await expect(spring).toBeEnabled();
  await page.getByRole("button", { name: "University level" }).click();
  await expect(page.locator(".scene-caption")).toContainText("Spring at 19 m, 9 m");
  await expect.poll(() => page.locator("[data-wet]").getAttribute("d")).not.toBe("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("research departure cancels an unfinished lift and return can lift again", async ({ page }) => {
  await page.goto("/?view=research&backend=cpu-worker");
  const lift = page.getByRole("button", { name: "Lift the drawing", exact: true });
  await expect(lift).toBeEnabled();
  await lift.click();
  await page.getByRole("button", { name: "Return to the book", exact: true }).click();
  await page.getByRole("button", { name: "Contents" }).click();
  await page.getByRole("button", { name: "Research example", exact: true }).click();
  await expect(lift).toBeEnabled();
  await lift.click();
  await expect(page.locator("#rain")).toBeEnabled();
  await expect(page.locator('input[name="prediction"]:checked')).toHaveCount(0);
});
