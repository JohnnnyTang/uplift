/**
 * Session 7G: acceptance walk of the two-lesson book on the default app, named by row (PB1–PB9 of
 * `docs/plan/product-realignment.md`, PL1–PL9 of `docs/plan/stage-1-wave-7-plates.md` §5) and by the owner's
 * 7G decisions (D-W7-7G). The ledger in `docs/review/plates/acceptance/` links each row to these tests.
 *
 * Lean by design (CI's e2e job has a 40-minute limit): one page, opened once on lesson 1 and turned to
 * lesson 2 by a real page turn, walks every row in order and returns to lesson 1 at the end. Viewport and
 * media changes reuse the same page. The deeper journeys stay in `plates-book.spec.ts` (7F) and
 * `plates-scene.spec.ts` (7D); this file adds what acceptance needs on top of them.
 *
 * Lesson 2 is an illustration (D-L2-1): no runs, no model time. Nothing here checks a landform's shape as
 * science: PL3 is judged by people on the captures, and 7C's unit tests hold the shapes to 7A's table.
 */
import { type Page, expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial", timeout: 120_000 });

const L1 = "From V to U";
const L2 = "Where plates meet";
type Point = { x: number; y: number };
type Box = { left: number; top: number; right: number; bottom: number };

let page: Page;
let lessonOneRun = "";
const problems: string[] = [];
const l1 = () => page.locator(".gs-desk:not(.ps-desk)");
const l2 = () => page.locator(".ps-desk");
const bar = () => page.getByRole("navigation", { name: "Book pages" });
const status = () => page.locator(".ps-scene [role=status]");
const stage = async () => Number(await l2().getAttribute("data-stage"));

async function scrub(value: number) {
  await page.locator("#ps-stage").evaluate((input: HTMLInputElement, v) => {
    input.value = String(v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function dragArrow(side: "left" | "right", dx: number, dy: number) {
  const target = () =>
    l2().evaluate(
      (d, s) =>
        (d as unknown as { plateArrowTargets(): Record<string, Point | null> }).plateArrowTargets()[s] ??
        null,
      side,
    );
  await expect.poll(target).not.toBeNull();
  const p = (await target())!;
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let k = 1; k <= 6; k++) await page.mouse.move(p.x + (dx * k) / 6, p.y + (dy * k) / 6);
  await page.mouse.up();
}

/** Waits until the stage has relaid out for the viewport (the canvas covers the desk again). */
async function resize(width: number, height: number) {
  await page.setViewportSize({ width, height });
  await expect
    .poll(() =>
      l2().evaluate((d, w) => {
        const c = d.querySelector("canvas");
        return d.getAttribute("data-stage-mode") === "flat" || (c ? Math.abs(c.clientWidth - w) <= 2 : true);
      }, width),
    )
    .toBe(true);
  await page.waitForTimeout(300);
}

/** Screen geometry of the figure page, the block's front face and the ghost key's entries. */
function figureGeometry() {
  return l2().evaluate((desk) => {
    const box = (e: Element): Box => {
      const r = e.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const g = (
      desk as unknown as { blockScreenGeometry(): { frontFace: Point[]; outline: Point[] } | null }
    ).blockScreenGeometry();
    return {
      mode: desk.getAttribute("data-stage-mode"),
      page: box(desk.querySelector(".gs-page-figure")!),
      face: g?.frontFace ?? null,
      outline: g?.outline ?? null,
      entries: [...desk.querySelectorAll(".ps-ghost-key .ps-ghost-item")].map((e) => ({
        boundary: (e as HTMLElement).dataset.boundary,
        box: box(e),
      })),
      leaders: [...document.querySelectorAll(".ps-ghost-leaders g")].map((e) => {
        const d = e.querySelector(".ps-leader")!.getAttribute("d")!;
        const [ax, ay, bx, by] = d.match(/-?[\d.]+/g)!.map(Number);
        return {
          boundary: (e as HTMLElement).dataset.boundary,
          from: { x: ax, y: ay },
          to: { x: bx, y: by },
        };
      }),
    };
  });
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e)}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
});
test.afterAll(async () => {
  await page.close();
});

test("PB7 PL8: lesson 1 turns to lesson 2 with a real page turn, on the same tilt, focus on its title", async () => {
  await page.goto("/");
  await expect(l1()).toHaveAttribute("data-source", "live", { timeout: 60_000 });
  await expect(l1()).toHaveAttribute("data-transition", "done", { timeout: 30_000 });
  // Leave lesson 1 with a state worth keeping: a shale run (a new run from the start).
  await page.getByRole("radio", { name: /Shale/ }).check();
  await expect(l1()).toHaveAttribute("data-live-rock", "shale");
  const tilt1 = await l1()
    .locator(".gs-book")
    .evaluate((b) => (b as HTMLElement).style.transform);
  lessonOneRun = (await l1().getAttribute("data-run-id"))!;
  // PageDown on the page turns; the turn is a real one: the drawing goes over into the block again.
  await page.locator(".gs-page-text h1").first().focus();
  await page.keyboard.press("PageDown");
  await expect(l2()).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(page).toHaveURL(/spread=tectonics\.plate-boundaries/);
  await expect(page.getByRole("heading", { level: 1, name: L2 })).toBeFocused();
  await expect(bar().locator(".reader-position")).toHaveText(new RegExp(`2\\s*${L2}`));
  await expect(l2()).toHaveAttribute("data-transition", "done", { timeout: 60_000 });
  const tilt2 = await l2()
    .locator(".gs-book")
    .evaluate((b) => (b as HTMLElement).style.transform);
  expect(tilt1).toMatch(/rotateX\(48deg\)/);
  expect(tilt2).toMatch(/rotateX\(48deg\)/);
  // Contents lists both lessons and the research route.
  await bar().getByRole("button", { name: "Contents" }).click();
  await expect(page.locator(".reader-contents .reader-contents-link")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Research example" })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("PB1 PB4: lesson 2 fits 1366×768 and 1440×900 with no page scroll; the picker works before any answer", async () => {
  for (const [w, h] of [
    [1366, 768],
    [1440, 900],
  ] as const) {
    await resize(w, h);
    await expect(l2()).toHaveAttribute("data-stage-mode", "tilted");
    const m = await page.evaluate(() => {
      const desk = document.querySelector(".ps-desk")!.getBoundingClientRect();
      const spread = document.querySelector(".ps-desk .gs-spread")!.getBoundingClientRect();
      const column = document.querySelector<HTMLElement>(".ps-text-column")!;
      const book = document.querySelector<HTMLElement>(".ps-desk .gs-book")!.style.transform;
      return {
        pageScroll: document.documentElement.scrollHeight > innerHeight + 1,
        horizontal: document.documentElement.scrollWidth > innerWidth + 1,
        inDesk: spread.top >= desk.top - 1 && spread.bottom <= desk.bottom + 1,
        columnScrolls: column.scrollHeight > column.clientHeight + 1,
        scale: Number(book.match(/scale3d\(([\d.]+)/)?.[1] ?? 1),
      };
    });
    const g = await figureGeometry();
    const xs = g.outline!.map((p) => p.x);
    const ys = g.outline!.map((p) => p.y);
    const block = `${Math.round(Math.max(...xs) - Math.min(...xs))}×${Math.round(Math.max(...ys) - Math.min(...ys))} px`;
    test
      .info()
      .annotations.push({ type: `view-metrics ${w}×${h}`, description: `scale ${m.scale}, block ${block}` });
    expect({ ...m, scale: undefined }, `${w}×${h}`).toEqual({
      pageScroll: false,
      horizontal: false,
      inDesk: true,
      columnScrolls: false,
      scale: undefined,
    });
    // The key action is on screen and works with no prediction chosen (PB4).
    await expect(page.locator(".ps-choice[data-boundary=convergent]")).toBeInViewport();
    await expect(page.locator(".ps-desk .gs-predict input:checked")).toHaveCount(0);
  }
});

test("PL1: the picker, a dragged plate arrow and the arrow keys each choose a boundary from the shared start", async () => {
  await page.locator(".ps-choice[data-boundary=convergent]").click();
  await expect(l2()).toHaveAttribute("data-boundary", "convergent");
  await expect(l2()).toHaveAttribute("data-stage", "0");
  await expect(status()).toContainText("Convergent boundary, starting stage");
  await scrub(0.5);
  // The left plate's arrow dragged away from the boundary (screen left) asks for a divergent boundary.
  await dragArrow("left", -70, 0);
  await expect(l2()).toHaveAttribute("data-boundary", "divergent");
  await expect(l2()).toHaveAttribute("data-stage", "0");
  // A focused handle answers the arrow keys with the same command: along the boundary → transform.
  await page.locator(".hb-handle[data-handle=right]").focus();
  await page.keyboard.press("ArrowUp");
  await expect(l2()).toHaveAttribute("data-boundary", "transform");
  await expect(l2()).toHaveAttribute("data-stage", "0");
  await expect(page.locator("input[name=ps-boundary][value=transform]")).toBeChecked();
});

test("PL2: play, pause and scrub early → late, with no time or years; viewed boundaries as labelled ghosts", async () => {
  const play = page.locator(".ps-stage .gs-play");
  await play.click();
  await expect(l2()).toHaveAttribute("data-playing", "true");
  await expect.poll(stage, { timeout: 30_000 }).toBeGreaterThan(0.1);
  await play.click();
  await expect(l2()).toHaveAttribute("data-playing", "false");
  const paused = await stage();
  await page.waitForTimeout(400);
  expect(await stage()).toBe(paused);
  await scrub(0.75);
  await expect(l2()).toHaveAttribute("data-stage-word", "late");
  const controls = await page.locator(".ps-stage").innerText();
  expect(controls).toMatch(/early/);
  expect(controls).toMatch(/late/);
  expect(await page.locator(".ps-scene").innerText()).not.toMatch(
    /\bruns?\b|model time|simulat|\byears?\b|\bMa\b|million/i,
  );
  await expect(l2()).toHaveAttribute("data-ghosts", "convergent,divergent");
  for (const b of ["convergent", "divergent"]) {
    await expect(page.locator(`.ps-ghost-key [data-boundary=${b}] .ps-glyph`)).toHaveCount(1);
    await expect(page.locator(`.ps-ghost-key [data-boundary=${b}] .ps-ghost-sample`)).toHaveCount(1);
    await expect(page.locator(`.ps-ghost-leaders [data-boundary=${b}]`)).toHaveCount(1);
  }
  await expect(page.locator(".ps-ghost-key")).toContainText("at the same stage");
  await expect(status()).toContainText(
    "The dotted line on the front face is the convergent profile at the same stage",
  );
});

test("D-W7-7G owner item 1: ghost labels sit on the page under the front face, never over it, and stay inside the page", async () => {
  for (const [w, h] of [
    [1440, 900],
    [1920, 1080],
    [1366, 768],
    [390, 844],
  ] as const) {
    await resize(w, h);
    if (w === 390) await page.locator(".ps-ghost-key").scrollIntoViewIfNeeded();
    // The leaders follow the block on the next frames.
    await expect.poll(async () => (await figureGeometry()).leaders.length).toBe(2);
    const g = await figureGeometry();
    expect(g.face, `${w}×${h}`).not.toBeNull();
    const faceBottom = Math.max(g.face![0]!.y, g.face![1]!.y);
    expect(g.entries).toHaveLength(2);
    for (const e of g.entries) {
      const where = `${w}×${h} ${e.boundary}`;
      // Inside the figure page…
      expect(e.box.left, where).toBeGreaterThanOrEqual(g.page.left - 1);
      expect(e.box.right, where).toBeLessThanOrEqual(g.page.right + 1);
      expect(e.box.top, where).toBeGreaterThanOrEqual(g.page.top - 1);
      expect(e.box.bottom, where).toBeLessThanOrEqual(g.page.bottom + 1);
      // …and below the front face, so no label covers it.
      expect(e.box.top, where).toBeGreaterThanOrEqual(faceBottom - 2);
      // Its leader runs from its profile on the block down to the entry.
      const leader = g.leaders.find((l) => l.boundary === e.boundary)!;
      expect(leader.to.y, where).toBeGreaterThanOrEqual(e.box.top - 1);
      expect(leader.to.y, where).toBeLessThanOrEqual(e.box.bottom + 1);
      expect(leader.to.x, where).toBeGreaterThanOrEqual(e.box.left - 1);
      expect(leader.to.x, where).toBeLessThanOrEqual(e.box.right + 1);
      expect(leader.from.y, where).toBeLessThan(e.box.top);
    }
    test.info().annotations.push({
      type: `ghost-key ${w}×${h}`,
      description: g.entries
        .map((e) => `${e.boundary} ${Math.round(e.box.right - e.box.left)} px`)
        .join(", "),
    });
  }
  await resize(1440, 900);
});

test("D-W7-7G owner item 2: the book keeps lesson 1's 48° tilt and the block is tipped up for a higher view", async () => {
  // The stage applies the book pose a frame after mount; on SwiftShader that can lag the spread's ready state.
  await expect
    .poll(() =>
      l2()
        .locator(".gs-book")
        .evaluate((b) => (b as HTMLElement).style.transform),
    )
    .toMatch(/rotateX\(48deg\)/);
  await expect(page.locator(".gs-view-controls input").first()).toHaveAttribute(
    "aria-valuetext",
    /^42 degrees/,
  );
  // How much of the block's top shows against its front face: the top's depth on screen over the face's height.
  // Measured on SwiftShader: 1.2–1.4 untipped (lesson 1's pose) and 2.0–2.2 with the 12° tip at 1366–1920 wide.
  const ratio = await l2().evaluate((desk) => {
    const g = (
      desk as unknown as { blockScreenGeometry(): { frontFace: Point[]; outline: Point[] } }
    ).blockScreenGeometry();
    const [bl, , , tl] = g.frontFace;
    const top = Math.min(...g.outline.map((p) => p.y));
    return (tl!.y - top) / (bl!.y - tl!.y);
  });
  test.info().annotations.push({ type: "top-to-face ratio", description: ratio.toFixed(2) });
  expect(ratio).toBeGreaterThan(1.7);
});

test("PL4 PL5: the text alternative names each crust change; one label line; authored-shapes disclosure; marks", async () => {
  const crust: Record<string, RegExp> = {
    convergent: /crust beneath it is thicker: a deep root/,
    divergent: /crust beneath the rift is thinner/,
    transform: /crust is unchanged/,
  };
  for (const [b, words] of Object.entries(crust)) {
    await page.locator(`.ps-choice[data-boundary=${b}]`).click();
    await scrub(1);
    await expect(status()).toContainText(words);
  }
  await expect(page.locator(".ps-label-line")).toHaveText("Illustration: shapes drawn from real examples");
  await expect(page.getByText("Illustration: shapes drawn from real examples")).toHaveCount(1);
  await expect(page.locator(".widget-tier")).toHaveCount(0);
  for (const level of ["school", "university"]) {
    const sources = (await page.locator(".ps-scene .gs-sources").textContent()) ?? "";
    expect(sources, level).toMatch(/authored/);
    expect(sources, level).toMatch(/do not form in the scene/);
    const visible = await page.locator(".ps-scene").innerText();
    expect(visible, level).not.toMatch(/\bruns?\b|model time|simulat|\byears?\b/i);
    if (level === "school") await bar().getByRole("button", { name: "University level" }).click();
  }
  await bar().getByRole("button", { name: "University level" }).click();
  // The lesson's words carry the expert-review mark into the page (7E's copy; register in docs/science/plates).
  expect(
    await page.evaluate(() => {
      const walker = document.createTreeWalker(document.querySelector(".ps-scene")!, NodeFilter.SHOW_COMMENT);
      let n = 0;
      while (walker.nextNode()) if (/expert-review/.test(walker.currentNode.nodeValue ?? "")) n++;
      return n;
    }),
  ).toBeGreaterThan(0);
});

test("PL6: Replay the drawing runs drawing → ink → colour on the tilted page and keeps boundary, stage and ghosts", async () => {
  const before = await l2().evaluate((d) =>
    [d.dataset.boundary, d.dataset.stage, d.dataset.ghosts].join("|"),
  );
  await page.getByRole("button", { name: "Replay the drawing" }).click();
  await expect(l2()).toHaveAttribute("data-transition", "running");
  await expect(page.locator(".ps-desk .gs-drawing svg[role=img]")).toBeVisible();
  await expect(l2()).toHaveAttribute("data-transition", "done", { timeout: 60_000 });
  await expect(l2()).toHaveAttribute("data-stage-mode", "tilted");
  expect(await l2().evaluate((d) => [d.dataset.boundary, d.dataset.stage, d.dataset.ghosts].join("|"))).toBe(
    before,
  );
});

test("PL7: the keyboard alone chooses, plays and scrubs; the text alternative follows", async () => {
  await page.locator("input[name=ps-boundary][value=transform]").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(l2()).toHaveAttribute("data-boundary", "divergent");
  await expect(status()).toContainText("Divergent boundary, starting stage");
  const stageInput = page.locator("#ps-stage");
  await stageInput.focus();
  await page.keyboard.press("End");
  await expect(l2()).toHaveAttribute("data-stage", "1");
  await expect(status()).toContainText("Divergent boundary, late stage");
  await page.keyboard.press("Home");
  await expect(l2()).toHaveAttribute("data-stage", "0");
  await page.locator(".ps-stage .gs-play").focus();
  await page.keyboard.press("Space");
  await expect(l2()).toHaveAttribute("data-playing", "true");
  await page.keyboard.press("Space");
  await expect(l2()).toHaveAttribute("data-playing", "false");
  const cut = page.getByRole("slider", { name: /Front face/ });
  const cutBefore = await cut.inputValue();
  await cut.focus();
  await page.keyboard.press("ArrowLeft");
  expect(await cut.inputValue()).not.toBe(cutBefore);
});

test("PL7 PB2: phone, 320 px reflow and reduced motion: one flat page, no sideways scroll, stage in steps", async () => {
  // 390 px phone, 320 CSS px (the 200 % zoom reflow width) and 683 × 384 (200 % zoom of 1366 × 768).
  for (const [w, h] of [
    [390, 844],
    [320, 700],
    [683, 384],
  ] as const) {
    await resize(w, h);
    await expect(l2(), `${w}×${h}`).toHaveAttribute("data-stage-mode", "flat");
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${w}×${h}`).toBeLessThanOrEqual(
      w,
    );
    await expect(page.locator(".ps-choice[data-boundary=convergent]")).toBeVisible();
  }
  await resize(390, 844);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(l2()).toHaveAttribute("data-reduced-motion", "true");
  await expect(page.locator("#ps-stage")).toHaveAttribute("step", "0.25");
  expect(
    await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length),
  ).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await resize(1440, 900);
  await expect(l2()).toHaveAttribute("data-stage-mode", "tilted");
});

test("PB6: the prediction can be skipped, and the flap opens without an answer", async () => {
  await expect(page.locator(".ps-desk .gs-predict input:checked")).toHaveCount(0);
  await page.locator(".ps-desk .gs-flap summary").click();
  await expect(page.locator(".ps-desk .gs-flap")).toHaveAttribute("open", "");
  await expect(page.locator(".ps-desk .gs-flap-answer")).not.toBeEmpty();
  await page.locator(".ps-desk .gs-flap summary").click();
});

test("PB7 PL8 PL9: turning back finds lesson 1 exactly as left; lesson 2's choices never touched it", async () => {
  await page.locator(".ps-desk h1").focus();
  await page.keyboard.press("PageUp");
  await expect(l1()).toHaveAttribute("data-source", "live", { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: L1 })).toBeFocused();
  await expect(l1()).toHaveAttribute("data-run-id", lessonOneRun);
  await expect(l1()).toHaveAttribute("data-live-rock", "shale");
  await expect(page.getByRole("radio", { name: /Shale/ })).toBeChecked();
  await expect(l1()).toHaveAttribute("data-model-years", "0");
  expect(problems).toEqual([]);
});
