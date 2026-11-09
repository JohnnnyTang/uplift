## Session

S1 · W4 · 4A — GPU solver part 2 and backend selection

## What changed

Complete the managed WebGPU terrain solver with conservative erosion/deposition,
sediment transport, thermal slumping, evaporation, tools and deterministic
budgets. Guard every candidate stock/counter before resident commit, preserve
small bedrock/loose changes, and publish serialized atomic samples. Select
WebGPU256 → CPU Worker128/WebGL2 → CPU64 → static ink over the same domain.

The runtime backend API includes immediate real flat samples, a read-only flat
transport and explicit diagnostic tier flags. Book mounting and book-level forced
tier browser coverage are coordinated by the lead before the 4A PR is opened.

## Checklist

- [x] Stayed inside owned paths except the minimal runtime sim-host barrel export and required append-only decision log.
- [x] `pnpm check` passes locally: typecheck, lint, format and 448 tests in 47 files.
- [x] Production build passes.
- [x] Simulation is process-based: no scripted landform animation.
- [x] No reader numbers were authored; existing model-bound pages are untouched.
- [x] CPU/GPU comparison updated and passes on an actual WebGPU adapter: 65 browser tests across three files, including the shared public contract.
- [x] Scientific implementation documentation retains expert-review markers and existing model/derivation sources; no new scientific claim or approval.
- [x] Decisions/open boundaries recorded in DECISIONS.md.

## Evidence

See [the full solver report](full-solver.md), [browser evidence](full-results-local.json)
and [OS driver metadata](full-environment-local.json). Tests cover full256 plus
real Worker128/CPU64/flat transports, zero-throughput and sampled conservation,
real sub-ULP erosion, precision across configuration, every shared tool/source,
hidden-lane/budget replay, atomic rejected batches and queued-read ordering.
The original 3C water evidence and all historical science records are preserved.

## Handover

**Done:** complete GPU solver/contract, deterministic resident budgets, split
precision for bedrock and loose material, matching host transport and all fallback
APIs. `createFlatTerrainTransport` is available for the lead's immediate flat page.

**Not done:** shared book mounting is owned by the lead. Visible classroom frame
rate, controlled thermal/power measurements, expert science approval and human
accessibility remain Stage 1/5A gates. Nothing enables the pending waterfall
challenge or geological years.

**Surprises:** full finalization exceeded WebGPU's portable buffer-binding limit;
separate ledger/finalization passes retain portability. Loose sediment needs its
own compensated change lane. Float32 drawing-volume subtraction cannot resolve
tiny transfers at a large datum; authoritative split lanes must serve conservation
and baseline-aware probes. The shared GPU contract uses the CPU contract's same
catchment fixture without changing its tests or tolerances.

**Plan implications:** full compute cost is now measured locally, while rendered
frame performance is still an independent 5A measurement. Rebuilding pipelines on
parameter events preserves state but should be coalesced by control interfaces.
CI must clear and collect both water and full-process evidence files. Mesh and
contours must consume one HostSample; use its config for scale/tool bindings after
tier selection.
