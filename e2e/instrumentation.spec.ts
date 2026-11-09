import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { isLearningEvent, type LearningExport } from "../hachure/runtime/src/instrumentation/log";
import { commit, ready, unchangedAcrossLevels, scienceGuards } from "./helpers";

async function lessonState(page: Page) {
  return page.evaluate(() => ({
    hash: document.querySelector<HTMLElement>(".book")!.dataset.stateHash,
    step: document.querySelector<HTMLElement>(".book")!.dataset.step,
    recorded: { ...document.querySelector<HTMLElement>(".paired-replay")!.dataset },
    gated: document.querySelector<HTMLInputElement>("#rain")!.disabled,
  }));
}

test("collection remains off through a complete opt-out lesson flow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await ready(page);
  const panel = page.locator(".learning-log");
  await panel.locator("summary").click();
  await expect(panel).toHaveAttribute("data-collecting", "false");
  await expect(page.getByRole("button", { name: "Export anonymous JSON" })).toBeDisabled();
  await expect(page.locator('input[name="learning-pre"]').first()).toBeDisabled();
  await commit(page);
  await page.getByRole("button", { name: "Show result", exact: true }).click();
  await page.getByRole("button", { name: "Reveal explanation" }).click();
  await unchangedAcrossLevels(page);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".book")).toHaveAttribute("data-step", "0");
  await expect(panel).toHaveAttribute("data-events", "0");
  await expect(panel).toHaveAttribute("data-collecting", "false");
  await scienceGuards(page);
  expect(errors).toEqual([]);
});

test("keyboard opt-in, anonymous export, stop/clear and levels preserve lesson states", async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await ready(page);
  const panel = page.locator(".learning-log");
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  const initial = await lessonState(page);
  await panel.locator("summary").focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Start local collection" }).focus();
  await page.keyboard.press("Enter");
  await expect(panel).toHaveAttribute("data-collecting", "true");
  expect(await lessonState(page)).toEqual(initial);
  await expect(page.locator("#rain")).toBeDisabled();
  await page.locator('input[name="learning-pre"]').nth(0).focus();
  await page.keyboard.press("Space");
  await commit(page);
  await page.getByRole("slider", { name: "Recorded model step" }).focus();
  await page.keyboard.press("End");
  await page.getByRole("button", { name: "Reveal explanation" }).click();
  await page.getByLabel("Recorded landscape", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Show result", exact: true }).click();
  await unchangedAcrossLevels(page);
  await expect(panel).toHaveAttribute("data-collecting", "true");
  await page.locator('input[name="learning-post"]').nth(1).focus();
  await page.keyboard.press("Space");
  await page.getByRole("slider", { name: "Rain input", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#rain")).toHaveValue("11");
  await page.locator("#valley-tools-tool").selectOption("dig");
  await page.getByRole("button", { name: /^Terrain brush cursor\./ }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.locator("#valley-tools-status")).toContainText("Dig applied");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".book")).toHaveAttribute("data-step", "0");
  await expect(page.locator("#rain")).toBeDisabled();
  // Reset publishes its zero-step sample before the default-rain configure reply.
  await expect(page.locator("#rain")).toHaveValue("10");
  const beforeStop = await lessonState(page);
  await page.getByRole("button", { name: "Stop local collection" }).focus();
  await page.keyboard.press("Enter");
  const size = await panel.getAttribute("data-events");
  expect(await lessonState(page)).toEqual(beforeStop);
  await page.getByLabel("Reading level").selectOption("uni");
  await expect(panel).toHaveAttribute("data-events", size!);
  const beforeExport = await lessonState(page);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export anonymous JSON" }).focus();
  await page.keyboard.press("Enter");
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("uplift-anonymous-events.json");
  const exported = JSON.parse(await readFile((await download.path())!, "utf8")) as LearningExport;
  expect(exported.version).toBe(1);
  expect(exported.scope).toBe("rain-gross-erosion");
  expect(exported.events.length).toBe(Number(size));
  expect(exported.events.every(isLearningEvent)).toBe(true);
  expect(exported.events.map((e) => e.sequence)).toEqual(exported.events.map((_, i) => i));
  const kinds = exported.events.map((e) => e.action.kind);
  for (const kind of [
    "collection",
    "prediction",
    "comparison",
    "flap",
    "challenge",
    "level",
    "control",
    "tool",
    "reset",
    "learning-check",
  ])
    expect(kinds).toContain(kind);
  expect(kinds.indexOf("prediction")).toBeLessThan(kinds.indexOf("flap"));
  const first = exported.events[0]!;
  expect(first.context.live!.modelStep).toBe(0);
  expect(first.context.live!.backend).toBe("cpu-worker");
  expect(first.context.live!.config.rainMmPerHr).toBe(10);
  expect(
    exported.events.some((e) => e.action.kind === "control" && e.context.live!.config.rainMmPerHr === 11),
  ).toBe(true);
  const endpoints = exported.events.filter(
    (e) => e.action.kind === "comparison" && e.action.action === "endpoint",
  );
  expect(endpoints.length).toBeGreaterThanOrEqual(2);
  expect(endpoints.some((e) => e.context.recorded.seed === 17 && e.context.live!.seed === 1)).toBe(true);
  expect(endpoints.every((e) => e.source === "recorded")).toBe(true);
  expect(exported.events.filter((e) => e.action.kind === "challenge").map((e) => e.action)).toEqual([
    { kind: "challenge", status: "pending" },
  ]);
  expect(await lessonState(page)).toEqual(beforeExport);
  expect(requests.every((url) => url.startsWith("http://127.0.0.1:4173/") || url.startsWith("blob:"))).toBe(
    true,
  );
  await page.getByRole("button", { name: "Clear local log" }).focus();
  await page.keyboard.press("Enter");
  await expect(panel).toHaveAttribute("data-events", "0");
  await expect(panel).toHaveAttribute("data-collecting", "false");
  await expect(page.getByRole("button", { name: "Export anonymous JSON" })).toBeDisabled();
  expect(await lessonState(page)).toEqual(beforeExport);
  await scienceGuards(page);
  expect(errors).toEqual([]);
});

test("a failing replay observer cannot interrupt keyboard controls or endpoint gating", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4174/e2e/fixtures/observer.html");
  const timeline = page.getByRole("slider", { name: "Recorded model step" });
  await timeline.focus();
  await page.keyboard.press("End");
  await expect(page.locator("body")).toHaveAttribute("data-endpoint", "true");
  await page.keyboard.press("Home");
  await expect(page.locator("body")).toHaveAttribute("data-endpoint", "false");
  await page.getByLabel("Recorded landscape", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Show result", exact: true }).click();
  await expect(page.locator(".paired-replay")).toHaveAttribute("data-seed", "17");
  await expect(page.locator("body")).toHaveAttribute("data-endpoint", "true");
  expect(errors).toEqual([]);
});
