import { readdir, stat } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import console from "node:console";

export const BUNDLE_LIMIT_BYTES = 10_000_000;
export async function bundleBytes(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const sizes = await Promise.all(
    entries.map(async (entry) => {
      const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      if (entry.isSymbolicLink()) throw new Error("Unexpected symlink in production bundle");
      return entry.isDirectory() ? bundleBytes(path) : (await stat(path)).size;
    }),
  );
  return sizes.reduce((total, size) => total + size, 0);
}
export function enforceBundleBudget(bytes) {
  if (bytes >= BUNDLE_LIMIT_BYTES)
    throw new Error(`Production bundle ${bytes} bytes must be < ${BUNDLE_LIMIT_BYTES} bytes`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bytes = await bundleBytes(new URL("../uplift/book/dist/", import.meta.url));
  enforceBundleBudget(bytes);
  console.log(`Production bundle: ${bytes} / ${BUNDLE_LIMIT_BYTES} bytes (all files, uncompressed)`);
}
