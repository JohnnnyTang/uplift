/**
 * Captured-run fixtures: where they are and how to load them (browser-safe; no Node APIs).
 *
 * Files: `@hachure/glacier/captures/<rock>.json` (manifest) and `<rock>.bin` (payload), one per rock, all
 * from the registered reference config with seed {@link CAPTURE_SEED}. Format: see
 * `../contract/capture.ts` and `captured-runs/README.md`. These are real model output, labelled as
 * recorded runs; they are fixtures for 5H/5K development and fixture tests, not live simulation.
 */
import { type CapturedRun, type CapturedRunManifest, decodeCapturedRun } from "../contract/capture";
import { ROCK_IDS, type RockId } from "../contract/rocks";

/** Seed of the authored start used by every captured run. */
export const CAPTURE_SEED = 1;
/** Identifier of the authored starting valley recorded in each manifest. */
export const START_PRESET_ID = "v-valley/1";
/** Rocks with a captured run, in teaching order (soft → hard). */
export const CAPTURED_ROCKS: readonly RockId[] = ROCK_IDS;

/**
 * Fetches and decodes a capture. `manifestUrl` points at `<rock>.json`; the payload is fetched from the
 * manifest's `binFile`, resolved against the manifest URL. With Vite:
 * `loadCapturedRun(new URL("@hachure/glacier/captures/granite.json", import.meta.url).href)` or an
 * `?url` import.
 */
export async function loadCapturedRun(
  manifestUrl: string,
  fetchImpl: (url: string) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
    arrayBuffer(): Promise<ArrayBuffer>;
  }> = (u) => fetch(u),
): Promise<CapturedRun> {
  const res = await fetchImpl(manifestUrl);
  if (!res.ok) throw new Error(`capture manifest ${manifestUrl}: HTTP ${res.status}`);
  const manifest = (await res.json()) as CapturedRunManifest;
  const binUrl = new URL(manifest.binFile, new URL(manifestUrl, "http://capture.invalid/")).href.replace(
    /^http:\/\/capture\.invalid/,
    "",
  );
  const bin = await fetchImpl(binUrl);
  if (!bin.ok) throw new Error(`capture payload ${binUrl}: HTTP ${bin.status}`);
  return decodeCapturedRun(manifest, await bin.arrayBuffer());
}
