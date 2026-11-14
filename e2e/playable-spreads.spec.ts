import type { ReaderSceneController } from "../hachure/runtime/src/index";
import type { StateSnapshot } from "../hachure/terrain/src/index";
import { test, expect } from "@playwright/test";
const url =
  (process.env.PLAYABLE_FIXTURE_URL ?? "http://127.0.0.1:4174") + "/e2e/fixtures/playable-spreads.html";
const evidence = "docs/review/book-revision/example";
test("real water gesture, state, keyboard and fallback", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(page.locator(".scene-caption")).toContainText("surface is wet");
  await page.getByRole("button", { name: "Change level" }).click();
  const source = page.getByRole("button", { name: "Move spring with arrow keys" });
  await source.focus();
  await source.press("ArrowRight");
  await expect(page.locator(".scene-caption")).not.toContainText("0 wet cells");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${evidence}/water-response-desktop.png` });
  const surface = page.locator("canvas"),
    box = (await surface.boundingBox())!;
  await surface.click({ position: { x: box.width * 0.75, y: box.height * 0.2 } });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${evidence}/water-moved-desktop.png` });
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".scene-caption")).toContainText("0 wet cells");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await source.focus();
  await source.press("ArrowRight");
  await expect(page.locator(".scene-caption")).not.toContainText("0 wet cells");
  await page.screenshot({ path: `${evidence}/water-reduced-motion.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${evidence}/water-phone.png`, fullPage: true });
  await page.goto(url + "?flat");
  await expect(page.locator(".scene-caption")).toContainText("Flat diagram");
  await expect(page.locator(".scene-caption")).toContainText("No live water process");
  await expect(page.getByRole("button", { name: "Move spring with arrow keys" })).toBeDisabled();
  await page.screenshot({ path: `${evidence}/flat-fallback-phone.png`, fullPage: true });
  expect(errors).toEqual([]);
  if (page.video()) {
    const videoPath = await page.video()!.path();
    testInfo.attachments.push({ name: "interaction", path: videoPath, contentType: "video/webm" });
  }
});

type Harness = {
  playable: { scenes: { water: ReaderSceneController }; show: () => Promise<void> };
  playableModel: { snapshot: () => Promise<StateSnapshot>; hash: () => Promise<string> };
};
test("departure retains partial response, level and selection never mutate model, return finishes response", async ({
  page,
}) => {
  await page.goto(url + "?lag");
  await page.getByRole("button", { name: "Move spring with arrow keys" }).press("ArrowRight");
  const settled = await page.evaluate(async () => {
    const h = window as unknown as Harness,
      s = h.playable.scenes.water;
    await s.pauseAndSettle();
    const step = (await h.playableModel.snapshot()).step,
      before = await h.playableModel.hash();
    s.present({
      ...s.presentation(),
      level: "uni",
      selection: { kind: "source", id: "unplaced-selection", xM: 47, yM: 9 },
    });
    const after = await h.playableModel.hash();
    return { step, before, after, caption: s.bindings.render("{{probe.sourceX}}") };
  });
  expect(settled.step).toBeGreaterThan(0);
  expect(settled.step).toBeLessThan(2000);
  expect(settled.after).toEqual(settled.before);
  expect(settled.caption).toBe("19 m");
  await page.evaluate(async () => {
    const h = window as unknown as Harness;
    await h.playable.show();
  });
  await expect
    .poll(() =>
      page.evaluate(async () => (await (window as unknown as Harness).playableModel.snapshot()).step),
    )
    .toBe(2000);
  await page.evaluate(async () => {
    const s = (window as unknown as Harness).playable.scenes.water;
    await s.reset();
  });
  expect(
    await page.evaluate(async () => (await (window as unknown as Harness).playableModel.snapshot()).step),
  ).toBe(0);
});

test("disposal while initialization awaits cannot resurrect a scene", async ({ page }) => {
  await page.goto(url);
  await expect(page.locator(".scene-caption")).toContainText("surface is wet");
  const result = await page.evaluate(async () =>
    (
      window as unknown as {
        playable: {
          disposalRace: () => Promise<{ readiness: { kind: string }; attached: boolean; releases: number }>;
        };
      }
    ).playable.disposalRace(),
  );
  expect(result).toMatchObject({ readiness: { kind: "disposed" }, attached: false, releases: 1 });
});
