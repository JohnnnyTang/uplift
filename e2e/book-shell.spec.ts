import { test, expect } from "@playwright/test";
const fixture = `${process.env.BOOK_SHELL_FIXTURE_ORIGIN ?? "http://127.0.0.1:4174"}/e2e/fixtures/book-shell.html`;
test("settles before an attached page turn, coalesces, retains model and restores focus", async ({
  page,
}) => {
  await page.goto(fixture);
  await page.getByRole("button", { name: "Reveal explanation" }).click();
  await page.getByRole("button", { name: "Lift ink specimen" }).click();
  await page.evaluate(() => {
    void window.hold();
    void window.shell.navigate({ spreadId: "fixture.paper", page: "spread" });
  });
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-turning", "true");
  await expect(page.getByRole("img")).toBeVisible();
  expect(await page.evaluate(() => window.fixtures[0].calls)).not.toContain("detach");
  await page.evaluate(() => window.release());
  await expect(page.getByRole("heading", { name: "Follow another line", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Turn to Lift the drawing" }).click();
  await expect(page.getByRole("button", { name: "Lift ink specimen" })).toBeFocused();
  expect(await page.evaluate(() => window.fixtures[0].controller.presentation())).toMatchObject({
    explanationOpen: true,
    liftFraction: 1,
  });
  await page.evaluate(async () => {
    const s = window.shell;
    const results = await Promise.all([
      s.navigate({ spreadId: "fixture.paper", page: "spread" }),
      s.navigate({ spreadId: "fixture.ink", page: "spread" }),
      s.navigate({ spreadId: "fixture.paper", page: "spread" }),
    ]);
    window.results = results;
  });
  expect(await page.evaluate(() => window.results)).toEqual([false, false, true]);
  expect(await page.evaluate(() => window.fixtures.filter(Boolean).length)).toBe(2);
});
test("keyboard shortcuts respect fields and gestures; absolute history waits for release", async ({
  page,
}) => {
  await page.goto(fixture);
  await page.locator("#reader-level").focus();
  await page.keyboard.press("PageDown");
  await expect(page.getByRole("heading", { name: "Lift the drawing", exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.fixtures[0].setGesture("lift");
    void window.shell.navigate({ spreadId: "fixture.paper", page: "spread" });
  });
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-turning", "false");
  await page.evaluate(() => window.fixtures[0].setGesture("idle"));
  await expect(page.getByRole("heading", { name: "Follow another line", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Lift the drawing", exact: true })).toBeVisible();
  await page.locator("h1").focus();
  await page.keyboard.press("PageDown");
  await expect(page.getByRole("heading", { name: "Follow another line", exact: true })).toBeVisible();
});
test("phone pages settle hidden scenes, disclosures, level and resize preserve state", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixture);
  await expect(page.getByRole("img")).toHaveCount(0);
  await page.getByRole("button", { name: "Explore the illustration", exact: true }).click();
  await page.getByRole("button", { name: "Lift ink specimen" }).click();
  await page.getByRole("button", { name: "Read the explanation", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.fixtures[0].controller.status().attached)).toBe(false);
  await page.getByRole("button", { name: "Sources and depth", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Teacher note", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Return to the spread" }).click();
  await expect(page.getByRole("button", { name: "Sources and depth", exact: true })).toBeFocused();
  await page.locator("#reader-level").selectOption("uni");
  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(page.getByRole("img")).toBeVisible();
  expect(await page.evaluate(() => window.fixtures[0].controller.presentation())).toMatchObject({
    level: "uni",
    liftFraction: 1,
  });
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-page", "text");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
test("reduced motion, suspension and disposal interrupt turns coherently", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(fixture);
  await page.evaluate(async () => {
    await window.shell.navigate({ spreadId: "fixture.paper", page: "spread" });
  });
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.evaluate(async () => {
    const s = window.shell;
    const turn = s.navigate({ spreadId: "fixture.ink", page: "spread" });
    await s.suspend();
    await turn;
    await s.resume();
  });
  await expect(page.locator(".reader-spread")).toHaveCount(1);
  expect(
    await page.evaluate(() => window.fixtures.filter((f) => f?.controller.status().attached).length),
  ).toBe(1);
  await page.evaluate(async () => {
    const s = window.shell;
    void s.navigate({ spreadId: "fixture.ink", page: "spread" });
    await s.dispose();
  });
  await expect(page.locator(".reader-shell")).toHaveCount(0);
});
test("viewport evidence", async ({ page }, testInfo) => {
  await page.goto(fixture);
  for (const [name, width, height] of [
    ["desktop", 1366, 768],
    ["tablet", 900, 1100],
    ["phone", 390, 844],
    ["reflow", 320, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.locator(".reader-shell")).toHaveAttribute("data-turning", "false");
    if (name === "desktop")
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height);
    await page.screenshot({ path: `docs/review/book-revision/shell/${name}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-page", "spread");
  await page.getByRole("button", { name: "Turn to Follow another line" }).click();
  await expect(page.getByRole("heading", { name: "Follow another line", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Turn to Lift the drawing" }).click();
  await expect(page.getByRole("heading", { name: "Lift the drawing", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reveal explanation" }).click();
  await page.screenshot({ path: "docs/review/book-revision/shell/desktop-explanation.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-page", "text");
  await page.getByRole("button", { name: "Explore the illustration", exact: true }).click();
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-page", "illustration");
  await page.screenshot({ path: "docs/review/book-revision/shell/phone-illustration.png", fullPage: true });
  await testInfo.attach("paging", {
    body: "Video records attached outgoing specimen after settlement.",
    contentType: "text/plain",
  });
});

test("failed and delayed mounts settle navigation promises and suspension", async ({ page }) => {
  await page.goto(fixture);
  const failed = await page.evaluate(async () => {
    window.failMount();
    try {
      await window.shell.navigate({ spreadId: "fixture.paper", page: "spread" });
      return false;
    } catch {
      return true;
    }
  });
  expect(failed).toBe(true);
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-turning", "false");
  await page.evaluate(async () => {
    await window.shell.navigate({ spreadId: "fixture.ink", page: "spread" });
    window.holdMount();
    void window.shell.navigate({ spreadId: "fixture.paper", page: "spread" });
  });
  await expect.poll(() => page.evaluate(() => window.shell.navigation().spreadId)).toBe("fixture.paper");
  await page.evaluate(() => {
    void window.shell.suspend();
    window.releaseMount();
  });
  await expect(page.locator(".reader-shell")).toBeHidden();
  expect(
    await page.evaluate(() => window.fixtures.filter((f) => f.controller.status().attached).length),
  ).toBe(0);
  await page.evaluate(() => window.shell.resume());
  expect(
    await page.evaluate(() => window.fixtures.filter((f) => f.controller.status().attached).length),
  ).toBe(1);
});

test("reading surface drains scene work and remains safe across navigation and disposal", async ({
  page,
}) => {
  await page.goto(fixture);
  await page.evaluate(() => {
    void window.hold();
  });
  await page.getByRole("button", { name: "Sources and depth", exact: true }).click();
  await expect(page.getByRole("img")).toBeVisible();
  await page.evaluate(() => window.release());
  await expect(page.getByRole("heading", { name: "Sources and depth", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.fixtures[0].controller.status().attached)).toBe(false);
  await page.getByRole("button", { name: "Return to the spread" }).click();
  await expect(page.getByRole("img")).toBeVisible();
  await page.getByRole("button", { name: "Sources and depth", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sources and depth", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Turn to Follow another line" }).click();
  await expect(page.getByRole("heading", { name: "Follow another line", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sources and depth", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sources and depth", exact: true })).toBeVisible();
  await page.evaluate(() => window.shell.dispose());
  await expect(page.locator(".reader-shell")).toHaveCount(0);
});

test("large reading scale reflows and remains operable", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 683, height: 384 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(fixture);
  await expect(page.locator(".reader-shell")).toHaveAttribute("data-page", "text");
  await page.getByRole("button", { name: "Reveal explanation" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(683);
  await page.screenshot({ path: "docs/review/book-revision/shell/zoom-200-equivalent.png", fullPage: true });
  await context.close();
});

test("reset clears visible choice and explanation without moving reset focus", async ({ page }) => {
  await page.goto(fixture);
  await page.getByRole("radio", { name: "The drawing", exact: true }).check();
  await page.getByRole("button", { name: "Reveal explanation" }).click();
  await page.getByRole("button", { name: "Reset illustration" }).click();
  await expect(page.getByRole("radio", { name: "The drawing", exact: true })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Reveal explanation" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.getByRole("button", { name: "Reset illustration" })).toBeFocused();
});
