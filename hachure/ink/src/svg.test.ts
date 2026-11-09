import { describe, expect, it } from "vitest";
import { extractContours } from "./contours";
import { heightfieldFromFunction } from "./heightfield";
import { INK_TOKENS } from "./palette";
import { createProjection, projectToViewport, terrainFrameFromHeightfield } from "./projection";
import { toSvg } from "./svg";

const hf = heightfieldFromFunction(24, 10, (x, y) => 60 - Math.hypot(x - 120, y - 120) * 0.3);
const contours = extractContours(hf, 5);
const projection = createProjection(terrainFrameFromHeightfield(hf), {}, { widthPx: 640, heightPx: 480 }, 2);

describe("toSvg", () => {
  it("draws one path per contour line plus the boundary, with index contours heavier", () => {
    const svg = toSvg(contours, { projection, title: "Test drawing" });
    const paths = svg.match(/<path /g) ?? [];
    expect(paths).toHaveLength(contours.lines.length + 1);
    expect(svg).toContain(`stroke-width="${INK_TOKENS.indexContourWidthPx}"`);
    expect(svg).toContain(`stroke-width="${INK_TOKENS.contourWidthPx}"`);
    expect(svg).toContain(`stroke="${INK_TOKENS.ink}"`);
    expect(svg).toContain('viewBox="0 0 640 480"');
    expect(svg).toMatch(/^<svg [^>]*role="img" aria-label="Test drawing"><title>Test drawing<\/title>/);
    expect(svg).not.toMatch(/NaN|Infinity/);
  });

  it("places vertices exactly where the shared projection puts them at zero exaggeration", () => {
    const line = contours.lines[0]!;
    const [px, py] = projectToViewport(projection, line.pointsM[0]!, line.pointsM[1]!, line.levelM, 0);
    const svg = toSvg(contours, { projection, decimals: 3 });
    expect(svg).toContain(`M${px.toFixed(3)} ${py.toFixed(3)}`);
  });

  it("closes rings and can omit the boundary", () => {
    const svg = toSvg(contours, { projection, boundary: false });
    const closedCount = contours.lines.filter((l) => l.closed).length;
    expect(closedCount).toBeGreaterThan(0);
    expect((svg.match(/Z"/g) ?? []).length).toBe(closedCount);
    expect(svg).not.toContain('class="boundary"');
  });

  it("escapes page text and refuses a projection from another grid", () => {
    const svg = toSvg(contours, { projection, title: 'A <b>"map"</b> & key', description: "x < y" });
    expect(svg).toContain("A &lt;b&gt;&quot;map&quot;&lt;/b&gt; &amp; key");
    expect(svg).toContain("<desc>x &lt; y</desc>");
    const other = createProjection(
      { gridSize: 12, metresPerCell: 10, datumM: 0, reliefM: 1 },
      {},
      { widthPx: 10, heightPx: 10 },
    );
    expect(() => toSvg(contours, { projection: other })).toThrow();
  });
});
