/**
 * The solver must run in a Web Worker: no DOM, no Node built-ins, no `Math.random` in simulation code.
 * These tests already run in Vitest's `node` environment (no `window`/`document`); this file also scans the
 * solver sources so that a DOM reference behind an untested branch is still caught.
 */
import { describe, expect, it } from "vitest";

const sources = import.meta.glob(["./*.ts", "!./*.test.ts", "!./*.bench.ts", "!./test-fixtures.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Remove comments so documentation may mention the words below. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const FORBIDDEN: [string, RegExp][] = [
  ["Math.random", /Math\.random/],
  ["window", /\bwindow\b/],
  ["document", /\bdocument\b/],
  ["navigator", /\bnavigator\b/],
  ["localStorage", /\blocalStorage\b/],
  ["requestAnimationFrame", /\brequestAnimationFrame\b/],
  ["HTMLElement", /\bHTML\w*Element\b/],
  ["performance.now", /\bperformance\.now\b/],
  ["Date", /\bDate\b/],
  ["process", /\bprocess\./],
];

describe("worker-safe solver sources", () => {
  it("scans every solver source file", () => {
    expect(Object.keys(sources).sort()).toEqual(
      ["./constants.ts", "./guards.ts", "./index.ts", "./kernel.ts", "./solver.ts", "./tools.ts"].sort(),
    );
  });

  for (const [file, text] of Object.entries(sources)) {
    it(`${file} uses no DOM, Node, clock or Math.random`, () => {
      const body = code(text);
      for (const [name, pattern] of FORBIDDEN) expect(pattern.test(body), `${file} uses ${name}`).toBe(false);
    });

    it(`${file} imports only the contract and sibling solver modules`, () => {
      const imports = [...code(text).matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
      for (const specifier of imports) {
        expect(
          specifier === "../contract/index" || /^\.\/[\w-]+$/.test(specifier),
          `${file}: ${specifier}`,
        ).toBe(true);
      }
    });
  }

  it("runs without DOM globals", () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe("undefined");
  });
});
