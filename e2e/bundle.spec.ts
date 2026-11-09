import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { bundleBytes, BUNDLE_LIMIT_BYTES, enforceBundleBudget } from "./check-bundle.mjs";

test("size budget counts nested files and rejects the exact limit", async () => {
  const dir = await mkdtemp(join(tmpdir(), "uplift-bundle-"));
  try {
    await mkdir(join(dir, "assets"));
    await writeFile(join(dir, "index.html"), "hello");
    await writeFile(join(dir, "assets", "worker.js"), "world!");
    const url = pathToFileURL(dir + "/");
    expect(await bundleBytes(url)).toBe(11);
    expect(() => enforceBundleBudget(BUNDLE_LIMIT_BYTES - 1)).not.toThrow();
    expect(() => enforceBundleBudget(BUNDLE_LIMIT_BYTES)).toThrow(/must be </);
    expect(() => enforceBundleBudget(BUNDLE_LIMIT_BYTES + 1)).toThrow(/must be </);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
