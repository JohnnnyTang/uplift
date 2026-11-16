/* global document, navigator, innerWidth, innerHeight, location */
import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { format } from "prettier";
import { cpus, release } from "node:os";
import process from "node:process";

// Run against a production preview; this records automated evidence, never human listening or real zoom.
const origin = process.env.UPLIFT_AUDIT_ORIGIN ?? "http://127.0.0.1:4273";
const output = "docs/review/book-revision/accessibility";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const report = {
  utc: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  diff: execFileSync("git", ["diff", "--stat"], { encoding: "utf8" }).trim(),
  os: `${process.platform} ${release()}`,
  cpu: cpus()[0]?.model,
  browser: browser.version(),
  scope:
    "Headless bundled Chromium, SwiftShader, CPU worker, automated axe and focus checks. No human listening, browser UI zoom, projector or hardware acceptance.",
  scans: [],
};
async function scan(page, name) {
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const result = await page.evaluate(async () => {
    const results = await globalThis.axe.run();
    const simplify = (items) =>
      items.map(({ id, impact, description, nodes }) => ({
        id,
        impact,
        description,
        nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
      }));
    return {
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      userAgent: navigator.userAgent,
      axeVersion: results.testEngine.version,
      violations: simplify(results.violations),
      incomplete: simplify(results.incomplete),
      passedRules: results.passes.length,
      desk: { ...document.querySelector(".gs-desk, .ps-desk, .book")?.dataset },
    };
  });
  report.scans.push({ name, ...result });
  process.stdout.write(
    `${name}: ${result.violations.length} violations, ${result.incomplete.length} manual-review rules\n`,
  );
  writeFileSync(`${output}/axe-results.json`, await format(JSON.stringify(report), { parser: "json" }));
}
try {
  for (const [slug, spread, desk, ready] of [
    ["glacial", "geomorph.u-valley", ".gs-desk", "data-source"],
    ["plates", "tectonics.plate-boundaries", ".ps-desk", "data-ready"],
  ]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await page.goto(`${origin}/?backend=cpu-worker&glacier=cpu&spread=${spread}`);
    await expect(page.locator(desk)).toHaveAttribute(ready, slug === "glacial" ? "live" : "true", {
      timeout: 60000,
    });
    await scan(page, `${slug}-school`);
    await page.locator(".gs-flap summary").click();
    await scan(page, `${slug}-answer-open`);
    await page.getByRole("button", { name: "University level", exact: true }).click();
    await scan(page, `${slug}-university`);
    for (const label of [/Read deeper level/, /Read .*sources.*teacher notes/i]) {
      const trigger = page.getByRole("button", { name: label });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const panel = page.locator(".gs-reading-panel[open]");
      await expect(panel.getByRole("button", { name: "Back to the book" })).toBeFocused();
      await scan(page, `${slug}-panel-${label.source}`);
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await expect(panel).toHaveCount(0);
    }
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await scan(page, `${slug}-university-${width}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, reducedMotion: "reduce" });
  await page.goto(`${origin}/?view=research&backend=cpu-worker`);
  await expect(page.locator(".book")).toHaveAttribute("data-backend-ready", "true");
  await scan(page, "research-school");
  await page.getByRole("button", { name: "Reveal explanation", exact: true }).click();
  await page.getByLabel("Reading level").selectOption("uni");
  await scan(page, "research-university-answer-open");
  await page.close();
} finally {
  await browser.close();
}
const failures = report.scans.flatMap((scan) =>
  scan.violations.filter((v) => ["serious", "critical"].includes(v.impact)),
);
if (failures.length) process.exitCode = 1;
