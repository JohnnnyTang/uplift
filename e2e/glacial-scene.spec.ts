/**
 * Session 5K: the production glacial scene on the review route (recorded 5G2 runs). Every gesture is checked
 * together with its keyboard equivalent, and view changes are checked to leave the run alone.
 */
import { type Page, expect, test } from "@playwright/test";

const route = "/?review=glacial-stage";

interface Geometry {
  outline: { x: number; y: number }[];
  frontFace: { x: number; y: number }[];
  perRow: { x: number; y: number };
}

async function open(page: Page, query = "") {
  await page.goto(route + query);
  await page.waitForSelector(".gs-desk[data-ready], .gs-tray[disabled]", { timeout: 60_000 });
}

/** Waits for the drawing → ink → colour transition to finish (the text alternative is then announced). */
async function settled(page: Page) {
  await expect(page.locator(".gs-sr")).toContainText("front face of the block", { timeout: 20_000 });
}

const desk = (page: Page) => page.locator(".gs-desk");
const geometry = (page: Page) =>
  page.evaluate(() =>
    (
      document.querySelector(".gs-desk") as unknown as { blockScreenGeometry(): Geometry }
    ).blockScreenGeometry(),
  );
const centre = (points: { x: number; y: number }[]) => ({
  x: points.reduce((s, p) => s + p.x, 0) / points.length,
  y: points.reduce((s, p) => s + p.y, 0) / points.length,
});

test.describe("glacial production scene", () => {
  test("opens at the default front face (grid column 51, last snapshot) with bound notes, lens and labels", async ({
    page,
  }) => {
    await open(page);
    await settled(page);
    await expect(desk(page)).toHaveAttribute("data-cut-column", "51");
    await expect(page.locator(".gs-time-now")).toHaveText("300 model years");
    const notes = page.locator(".gs-margin");
    await expect(notes).toContainText("front face");
    await expect(notes).toContainText("floor lowered");
    // The enlarged front face draws the bed, the dashed starting V and the ice.
    const lens = page.locator(".gs-lens svg");
    await expect(lens).toBeVisible();
    await expect(lens.locator(".lens-start")).toHaveCount(1);
    await expect(lens.locator(".lens-ice")).not.toHaveCount(0);
    // The text alternative describes the current profile from the model's shape fit.
    await expect(page.locator(".gs-sr")).toContainText("closer to a U than a V");
    // Fig. 1 carries leader-line word labels and no numbers.
    const labels = await page.locator(".gs-drawing text").allTextContents();
    expect(labels).toContain("valley head");
    expect(labels).toContain("V-shaped valley");
    for (const l of labels) expect(l).not.toMatch(/\d/);
    // Cloth colour (D-W5-R1 item 8).
    expect(await page.locator(".gs-boards").evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
      "rgb(59, 53, 47)",
    );
  });

  test("the rock selector (keyboard) and the specimen dropped on the block call the same command", async ({
    page,
  }) => {
    await open(page);
    await settled(page);
    await expect(desk(page)).toHaveAttribute("data-live-rock", "sandstone");
    // Keyboard: the radio group.
    await page.getByRole("radio", { name: /^Sandstone/ }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(desk(page)).toHaveAttribute("data-live-rock", "shale");
    await expect(desk(page)).toHaveAttribute("data-ghost", "sandstone");
    await expect(page.locator(".gs-note-kept")).toContainText("sandstone");
    await expect(page.locator(".gs-sr")).toContainText(
      "ghost line is a separate run with another rock, sandstone",
    );
    await expect(page.locator(".gs-lens .lens-ghost")).toHaveCount(1);
    // Pointer: carry the granite specimen onto the block.
    const chip = await page.locator('.gs-specimen[data-rock="granite"]').boundingBox();
    const target = centre((await geometry(page)).outline);
    await page.mouse.move(chip!.x + 12, chip!.y + chip!.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++)
      await page.mouse.move(
        chip!.x + 12 + ((target.x - chip!.x - 12) * i) / 10,
        chip!.y + chip!.height / 2 + ((target.y - chip!.y - chip!.height / 2) * i) / 10,
      );
    await expect(page.locator(".gs-drop-overlay")).toHaveAttribute("data-active", "");
    await page.mouse.up();
    await expect(desk(page)).toHaveAttribute("data-live-rock", "granite");
    await expect(desk(page)).toHaveAttribute("data-ghost", "shale");
    await expect(page.getByRole("radio", { name: /^Granite/ })).toBeChecked();
    // Letting go away from the block changes nothing.
    const sandstone = await page.locator('.gs-specimen[data-rock="sandstone"]').boundingBox();
    await page.mouse.move(sandstone!.x + 12, sandstone!.y + sandstone!.height / 2);
    await page.mouse.down();
    await page.mouse.move(sandstone!.x + 80, sandstone!.y + 60, { steps: 5 });
    await page.mouse.up();
    await expect(desk(page)).toHaveAttribute("data-live-rock", "granite");
  });

  test("the front face moves by keyboard (one grid cell per arrow) and by dragging the face", async ({
    page,
  }) => {
    await open(page);
    await settled(page);
    const slider = page.getByRole("slider", { name: "Front face" });
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(desk(page)).toHaveAttribute("data-cut-column", "50");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(desk(page)).toHaveAttribute("data-cut-column", "52");
    const view = await page.getByRole("slider", { name: "Turn" }).inputValue();
    const g = await geometry(page);
    const face = centre(g.frontFace);
    await page.mouse.move(face.x, face.y);
    await page.mouse.down();
    await page.mouse.move(face.x, face.y - 30, { steps: 6 });
    await page.mouse.up();
    expect(Number(await desk(page).getAttribute("data-cut-column"))).toBeGreaterThan(52);
    // Dragging the face never turns the camera (the orbit is the scene's other drag).
    await expect(page.getByRole("slider", { name: "Turn" })).toHaveValue(view);
  });

  test("see under the ice and the turntable are view-only and keyboard operable", async ({ page }) => {
    await open(page);
    await settled(page);
    const notes = await page.locator(".gs-margin").innerText();
    await page.getByLabel("See under the ice").focus();
    await page.keyboard.press("Space");
    await expect(page.locator(".gs-sr")).toContainText("ice is hidden");
    await expect(page.locator(".gs-lens .lens-ice")).toHaveCount(0);
    const turn = page.getByRole("slider", { name: "Turn" });
    await turn.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    expect(await page.locator(".gs-margin").innerText()).toBe(notes);
  });

  test("shows the overdeepening note only where the model's floor is worn below the floor further down", async ({
    page,
  }) => {
    await open(page, "&rock=shale&column=35");
    await settled(page);
    await expect(desk(page)).toHaveAttribute("data-overdeepened", "true");
    await expect(page.locator(".gs-note-overdeepened")).toContainText("overdeepening");
    await page.getByRole("radio", { name: /^Granite/ }).check();
    await expect(desk(page)).toHaveAttribute("data-overdeepened", "false");
    await expect(page.locator(".gs-note-overdeepened")).toHaveCount(0);
  });

  test("phone: flat page, the lens in the flow, no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await settled(page);
    await expect(desk(page)).toHaveAttribute("data-stage-mode", "flat");
    await expect(page.locator(".gs-lens svg")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("reduced motion: flat page, the scene still describes its profile", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1366, height: 900 },
    });
    const page = await context.newPage();
    await open(page);
    await settled(page);
    await expect(desk(page)).toHaveAttribute("data-stage-mode", "flat");
    await context.close();
  });

  test("static fallback: labelled drawing, and the enlarged front face of the recorded run", async ({
    page,
  }) => {
    await open(page, "&static=1");
    await expect(page.locator(".gs-tray + .gs-limit")).toContainText("Drawing only");
    await expect(page.locator(".gs-lens svg")).toBeVisible();
    await expect(page.locator(".gs-sr")).toContainText("Fig. 1:");
  });
});
