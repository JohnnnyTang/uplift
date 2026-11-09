import type { SimHost } from "../hachure/runtime/src/index";
import { expect, test, type Page } from "@playwright/test";
test.use({ launchOptions: { args: ["--enable-unsafe-webgpu"] } });
const origin = process.env.READER_FIXTURE_ORIGIN ?? "http://127.0.0.1:4174";
async function ready(page: Page, backend = "worker") {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/e2e/fixtures/reader-runtime.html?backend=${backend}`);
  await expect(page.locator("#state"))
    .toContainText('"step":0', { timeout: 30000 })
    .catch((error) => {
      throw new Error(`${backend}: ${errors.join("; ")} ${error.message}`);
    });
}
test("keyboard reveals before play, skips a question, preserves settled state across level/return, resets explicitly", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  const reveal = page.getByRole("button", { name: "Reveal explanation" });
  await reveal.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#answer")).toBeVisible();
  await expect(page.locator("#state")).toContainText('"prediction":"unanswered"');
  await page.locator("#step").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#state")).toContainText('"step":1');
  await page.locator("#settle").click();
  await expect(page.locator("#step")).toBeDisabled();
  await page.getByLabel("Reading depth").selectOption("uni");
  await expect(page.locator("#state")).toContainText('"step":1');
  await page.locator("#resume").click();
  await page.locator("#step").click();
  await expect(page.locator("#state")).toContainText('"step":2');
  await page.locator("#reset").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#state")).toContainText('"step":0');
  await expect(page.locator("#reset")).toBeFocused();
  await expect(page.locator("#answer")).toBeHidden();
  await expect(page.getByLabel("Reading depth")).toHaveValue("uni");
  await expect(page.getByRole("button", { name: "Reveal explanation" })).toBeEnabled();
  await page.screenshot({ path: "e2e/fixtures/reader-runtime-keyboard.png", fullPage: true });
});
async function waterResult(page: Page, backend: string): Promise<number[]> {
  await ready(page, backend);
  return page.evaluate(async () => {
    const host = (window as unknown as { readerFixture: { host: SimHost } }).readerFixture.host;
    const initial = Array.from(host.sample!.snapshot.layers.bedrockM!);
    await host.step(3);
    await host.applyTool({ kind: "spring", id: "reader", at: { xM: 3, yM: 5 }, flowM3PerS: 2 });
    await host.step(2);
    await host.pauseAndSettle();
    const sample = host.sample!;
    if (Math.abs(sample.snapshot.budget.sourcedWaterM3 - 0.35) > 1e-5)
      throw new Error("Source replacement duplicated a source");
    const water = Array.from(sample.snapshot.layers.waterM!);
    await host.configure({ rainMmPerHr: 30 }).then(
      () => {
        throw new Error("Settled host accepted a mutation");
      },
      () => undefined,
    );
    await host.reset();
    if (JSON.stringify(Array.from(host.sample!.snapshot.layers.bedrockM!)) !== JSON.stringify(initial))
      throw new Error("Reset changed authored terrain");
    if (host.sample!.snapshot.step !== 0 || host.sample!.snapshot.layers.waterM!.some((v) => v !== 0))
      throw new Error("Reset kept water or steps");
    return water;
  });
}
test("authored Worker and CPU initialization, source replacement and reset agree", async ({ page }) => {
  const cpu = await waterResult(page, "cpu");
  const worker = await waterResult(page, "worker");
  expect(worker).toEqual(cpu);
});
test.describe("native WebGPU authored transport", () => {
  test("matches CPU through authored initialization, source replacement and reset", async ({ page }) => {
    const cpu = await waterResult(page, "cpu");
    const capable = await page.evaluate(async () => {
      const gpu = (
        navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ destroy?(): void } | null> } }
      ).gpu;
      const adapter = await gpu?.requestAdapter();
      const available = Boolean(adapter);
      return available;
    });
    test.skip(
      !capable,
      "Native WebGPU adapter unavailable in this browser; CPU/Worker coverage remains required",
    );
    const gpu = await waterResult(page, "gpu");
    for (let i = 0; i < cpu.length; i++) expect(gpu[i]).toBeCloseTo(cpu[i]!, 5);
  });
});
