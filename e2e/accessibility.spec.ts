import { test, expect } from "@playwright/test";

for (const [title, spread, desk, readiness, value] of [
  ["From V to U", "geomorph.u-valley", ".gs-desk", "data-source", "live"],
  ["Where plates meet", "tectonics.plate-boundaries", ".ps-desk", "data-ready", "true"],
] as const) {
  test(`6B: ${title} has one main landmark and accessible deeper reading panels`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/?backend=cpu-worker&glacier=cpu&spread=${spread}`);
    await expect(page.locator(desk)).toHaveAttribute(readiness, value, { timeout: 60_000 });
    await expect(page.getByRole("main")).toHaveCount(1);
    await page.getByRole("button", { name: "University level", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Read deeper level ↗" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const panel = page.locator(".gs-reading-panel[open]");
    await expect(panel.getByRole("button", { name: "Back to the book" })).toBeFocused();
    if (spread === "geomorph.u-valley") {
      // This equation overflows at the default panel width. Reach it with Tab, then scroll with a key.
      const equation = panel.locator(".widget-formula").first();
      await page.keyboard.press("Tab");
      await expect(equation).toBeFocused();
      expect(await equation.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => equation.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    }
    await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
    const violations = await page.evaluate(async () => {
      const axe = (
        window as unknown as {
          axe: { run(): Promise<{ violations: { id: string; impact: string }[] }> };
        }
      ).axe;
      return (await axe.run()).violations.map(({ id, impact }) => ({ id, impact }));
    });
    expect(violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(panel).toHaveCount(0);
    await page.getByRole("button", { name: "Contents", exact: true }).click();
    await page.getByRole("button", { name: "Research example", exact: true }).click();
    await expect(page.locator(".book")).toHaveAttribute("data-backend-ready", "true");
    await expect(page.getByRole("main")).toHaveCount(1);
    await page.getByRole("button", { name: "Return to the book", exact: true }).click();
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeFocused();
    await expect(page.getByRole("main")).toHaveCount(1);
  });
}
