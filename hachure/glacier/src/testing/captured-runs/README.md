# Captured glacier runs (fixtures for 5H, 5K and the fixture tests)

Real output of the `@hachure/glacier` CPU reference model: one run per rock, recorded every 20 model
years from the authored starting V-valley to the registered horizon of 300 model years (16 snapshots).
They let the book stage, scene look and interaction (5H, 5K) develop on real valley formation before the
live runtime (5J) exists. They are **recorded runs**, not live simulation; label them as such anywhere a
reader could see them.

| File                               | What                               |
| ---------------------------------- | ---------------------------------- |
| `shale.json` / `shale.bin`         | soft rock run (manifest / payload) |
| `sandstone.json` / `sandstone.bin` | medium rock run                    |
| `granite.json` / `granite.bin`     | hard rock run                      |

All three use the registered reference config (`DEFAULT_GLACIER_CONFIG`) with seed 1 and differ only in
`rockId`. Regenerate with
`GLACIER_REVIEW=1 pnpm vitest run hachure/glacier/src/testing/review/capture.review.test.ts`; the fixture
test (`captures.test.ts`) checks that a fresh run reproduces the first recorded interval and that every
capture still satisfies the registered claim.

## Quick mapping (what 5H's `runs.ts` asked for)

| Needed                      | Where                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| columns, rows               | `snapshot.nx` (160, along the valley), `snapshot.ny` (64, across); also `manifest.grid`                                     |
| metresPerCell               | `snapshot.metresPerCell` (40)                                                                                               |
| bed elevation (m)           | `snapshot.bedM` (Float32Array, row-major `j * nx + i`)                                                                      |
| ice thickness (m)           | `snapshot.iceThicknessM`                                                                                                    |
| ice velocity x / y (m/yr)   | `snapshot.surfaceVelocityXMPerYear`, `snapshot.surfaceVelocityYMPerYear` (surface)                                          |
| model time (yr)             | `snapshot.modelYears` (model years, time compressed for erosion)                                                            |
| rock id                     | `snapshot.rockId` / `manifest.rockId`: one string for the whole run (`"shale"` …)                                           |
| valley orientation          | the valley runs along **columns i** (grid x). **Downstream = decreasing i**: i = 0 is the mouth, i = nx − 1 the valley head |
| snowline / ELA altitude (m) | `manifest.config.snowlineAltitudeM`                                                                                         |
| start + series per rock     | `run.snapshot(0)` is the start; `run.snapshot(k)`, `k < run.count`, the series                                              |

## Format `hachure-glacier-capture` version 1

Types and codec: `hachure/glacier/src/contract/capture.ts` (`CapturedRunManifest`, `decodeCapturedRun`,
`encodeCapturedRun`), exported from `@hachure/glacier`.

**Manifest (`<rock>.json`)**

- `format`, `version`: `"hachure-glacier-capture"`, `1`.
- `rockId`, `config`: the full `GlacierConfig` of the run (units in field names).
- `start`: `{ preset: "v-valley/2", options }`, the authored start and its options.
- `grid`: `{ nx: 160, ny: 64, metresPerCell: 40 }` (5G2; the 5G captures were 128 × 96). Field index `k = j * nx + i`; `i` runs **along** the
  valley (i = 0 is the downstream edge, the mouth; i = nx − 1 the valley head), `j` runs **across** it.
  World position of cell centre: x = i · metresPerCell, y = j · metresPerCell; elevations in metres.
- `layers`: quantization per layer, in snapshot order: `bedM`, `iceThicknessM`,
  `surfaceVelocityXMPerYear`, `surfaceVelocityYMPerYear`. Value = `offset + scale × u16`.
  Bed: 0.05 m steps; ice: 0.01 m; velocity: 0.05 m/yr over ±1638 m/yr. Error ≤ scale / 2.
- `snapshotIntervalYears` (20), `bytesPerSnapshot` (4 layers × nx × ny × 2 bytes = 81 920),
  `binFile`, `finalStateHash` (Float64 state hash at the last snapshot).
- `snapshots[]`: `{ index, step, modelYears, byteOffset, probes }`. `probes` are the whole-run
  `GlacierProbes` (ice volume and area, eroded volume, max sliding and surface speed, snout position),
  computed from the full-precision state.

**Payload (`<rock>.bin`)**: the snapshots back to back; each is the four layers in the order above, each
layer `nx × ny` little-endian `uint16`.

## Using a capture

```ts
import { decodeCapturedRun, measureSection } from "@hachure/glacier";
import { loadCapturedRun } from "@hachure/glacier/testing";
import manifestUrl from "@hachure/glacier/captures/granite.json?url";

const run = await loadCapturedRun(manifestUrl); // fetches granite.json and granite.bin
const snap = run.snapshot(run.nearestIndex(300)); // GlacierSnapshot: Float32 bed, ice, velocity
const start = run.snapshot(0); // the starting V (dashed line on the front face)
const cut = measureSection(snap.bedM, snap.iceThicknessM, run.manifest.grid, 74);
// cut.floorWidthM, cut.depthM, cut.wallSlopeDeg … are the bound numbers for the margin notes.
```

Snapshot 0 is the authored start (no ice). The ice surface is `bedM + iceThicknessM`. The snowline
altitude for snow dressing is `manifest.config.snowlineAltitudeM`. Surface velocity is zero where there
is no ice; flow marks should follow it. Everything a scene needs is in the snapshot plus the config; no
glacier physics belongs in Ink or the book.

## Memory budget (proposal for 5J)

A recorded snapshot in this format is 82 KB (Float32 in memory: 164 KB). At one snapshot per 20 model
years over 300 years, a run is 16 snapshots: about 1.31 MB quantized or 2.6 MB as Float32. The live run plus
two kept runs therefore fit in about 3.9 MB quantized (7.9 MB Float32), inside the ~32 MB budget of the
wave plan §4. Proposal: keep the 20-model-year interval; 5J enforces the budget.
