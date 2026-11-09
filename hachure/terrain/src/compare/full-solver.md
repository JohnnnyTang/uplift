# Full GPU solver and backend selection — session 4A

`createGpuTerrainSolver(config, preset)` from `@hachure/terrain/gpu` implements the
complete `TerrainSolver` contract. The ordinary terrain entry remains free of
Three.js, DOM and GPU imports for Workers. `createGpuWaterSolver` retains its
water-only default and historical comparison; full assembly opts into the new
process passes.

<!-- expert-review -->

The port preserves the stage order and mechanisms in
[model.md](../../../../docs/science/model.md),
[hydraulic-resistance.md](../../../../docs/science/hydraulic-resistance.md) and
`cpu/kernel.ts`: capacity exchange, donor-limited flux-form suspension transport,
loose-material thermal transfers, evaporation and dry-cell stranding. It changes
no process law, default scientific configuration, validation result, geological
clock approval or challenge status. Engineering fixtures exercise numerical
passes; their shapes are initial conditions, never scripted simulation outcomes.

## Resident state and rejection

The water/flux ping-pong buffers and split ground lanes stay resident between
steps. Every candidate process pass finishes before the deterministic max guard.
The same resident latched guard controls water, flux, bedrock changes, loose
material, suspension and all ledger commits. Rejected batches retain every
accepted stock and counter, even when more steps were already queued.

Passes use at most eight storage buffers per shader, matching the portable WebGPU
limit. Large finalization/ledger passes are deliberately split; no adapter-specific
increase in required limits is necessary. No floating-point atomics are used.

Budgets accumulate direct transfers per cell with compensated additions, then use
a fixed binary sum tree at snapshot time. The tree handles odd cell counts with a
zero missing child. Eroded/deposited/exported/rain/source/evaporation/outlet counters
are totals; suspended volume is the final stock. Reductions and hidden elevation
state are asserted deterministic on this device. Cross-device bitwise agreement
is not promised.

## Precision and mutation semantics

Initial bedrock uses a local datum. Bedrock and loose sediment each have separate
compensated change lanes. Water pressure subtracts initial and change lanes
separately. Loose transfers are accumulated directly, rather than subtracting
rounded thick sediment stocks. A donor may round infinitesimally below zero; its
loose lane clamps at zero, and sampled mass tests bound the resulting residual.

`referenceLayers()` reconstructs bedrock and loose sediment in Float64 for
conservation and baseline-aware probes. Rendering snapshots intentionally retain
the contract's Float32 layers. Subtracting two large absolute Float32 drawing
volumes is unsuitable for measuring tiny changes: the shared contract therefore
uses the same catchment fixture as the CPU contract, while precision/conservation
tests independently use the authoritative split lanes at high datum. No shared
contract or historical science threshold was changed.

Configuration changes serialize an atomic snapshot, preserve counters, time,
outlet level, sources and both elevation residuals, and rebuild managed pipelines.
This is an event operation, not a frame operation; repeated slider events should
be coalesced by the embedding interface. Shared CPU brush semantics determine the
mask, clamps and smoothing, then GPU uploads/compensated commits apply the edit.
Untouched elevation lanes are retained. This avoids a second, divergent brush
implementation. It is not CPU stepping or a CPU shadow simulation.

Snapshots coalesce only within the same queued mutation sequence. A read after a
queued step, configuration change, tool or reset observes that operation. The
sampler caps automatic full readback at two hertz. Mutations cannot interleave
multi-buffer copying; mesh and geometry contours must consume the same HostSample.
Manual host refresh remains bounded by the existing SimHost coalescer. `dispose`
is awaitable for embedding/test teardown; synchronous contract callers remain
supported.

## Backend API and embedding

`selectTerrainBackend` is exported through `@hachure/runtime`. It returns
`{ backend, config, transport, initialSample, measuredStepMs, failures }`.

| Tier                       |              Grid | Cell side | Domain |   Pipe area |
| -------------------------- | ----------------: | --------: | -----: | ----------: |
| `webgpu`                   |              256² |       5 m | 1280 m |        5 m² |
| `cpu-worker` + WebGL2 view |              128² |      10 m | 1280 m |       20 m² |
| `cpu-64` + WebGL2 view     |               64² |      20 m | 1280 m |       80 m² |
| `flat`                     | 64² static preset |      20 m | 1280 m | no stepping |

Pipe area is `0.2 × cellSide²`, an engineering scaling within the existing guards,
not a calibrated field parameter. Roughness and numerical dt are retained across
tiers. Automatic selection initializes each candidate, warms four steps, measures
four, and rejects compute slower than `1000/30` ms per step (overridable). It resets
the candidate before returning the genuine step-zero sample, including after an
optional admission callback. This compute-only admission is not the full rendered
AC1 gate. Grid resolution degrades before changing throughput or fixed dt.

The `?backend=webgpu|cpu-worker|cpu-64|flat` flag forces a diagnostic tier and
bypasses automatic timing admission; capability failures return flat with reasons.
`?backend=auto` uses the whole chain. Unknown values throw a descriptive error.
No WebGL2 compute backend is registered. An actual WebGL2 context check gates CPU
view tiers. GPU failure or Worker failure releases that candidate's resources.

Pass calibration metadata explicitly to selection and `SimHost.initialize`.
The cached initial reply is consumed only for matching configuration/calibration;
changed input initializes again. A supplied Worker transport can use the existing
book Worker entry or `runtime/src/sim-host/backend/worker.ts` as a module Worker.

`createFlatTerrainSample(config, calibration)` produces a real step-zero preset
sample immediately, before GPU initialization. `createFlatTerrainTransport(sample)`
returns a read-only host transport: init/sample/reset copy that same genuine
sample; advance/configure/tool reject. A selected flat backend has null transport,
so the embedding can choose this helper, disable live controls, retain the flat
ink and keep the recorded rain comparison available. Book mounting is coordinated
by the lead; 4A does not edit shared book integration files.

## Evidence and remaining gates

Run `pnpm --filter @hachure/terrain test:gpu`, `pnpm check`, and `pnpm build`.
Browser tests require a real adapter; unavailable adapters are skipped explicitly,
never counted as agreement. `full-results-local.json` is the generated full-process
record; `full-environment-local.json` records the separately queried OS driver.
Original 3C water results are retained separately.

The full suite covers each process, dry fronts, odd grids and outlet faces, real
128² and 256² presets (including the declared spring), all shared tools and source
replacement, configuration/reset/disposal, shared public contract, sampled mass
closure, same-device replay including hidden lanes and budgets, mutation/read
ordering, rejected-candidate preservation, zero throughput, stranded material and
cumulative real erosion below the absolute Float32 ULP. Comparison bounds are
explicit in the test and reuse the pre-existing water bounds; budget residuals use
`max(1e-6 m³, 1% of moved/input reference volume)` in the authoritative mass test.
No thresholds are relaxed per observed result.

Local hardware is Intel Arc 140V, driver 32.0.101.8860, Core Ultra 7 258V, installed
Chrome headless with WebGPU enabled. Power/thermal conditions are uncontrolled.
These tests and compute/readback timings do not close visible Chrome frame rate,
projector, classroom, human accessibility or expert science approval. Those remain
5A/the Stage 1 gate. Browser evidence files must be cleared before CI setup so a
failed setup cannot expose stale local results.
