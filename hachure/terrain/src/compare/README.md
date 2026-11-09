# GPU water stage and CPU comparison

Session 3C implements water only. Import `createGpuWaterSolver` from `@hachure/terrain/gpu`;
the normal terrain entry stays Worker-safe and does not load Three.js. The stage is deliberately
not registered as a complete `TerrainSolver`: erosion, deposition, sediment transport, slumping,
evaporation, full budget counters and GPU brushes remain 4A. Active configuration for those omitted
processes is rejected. Configuration is frozen for the run; reset/configure orchestration is also 4A.

## Ordering and guards

<!-- expert-review -->

The kernels port the corrected CPU update from [hydraulic-resistance.md](../../../../docs/science/hydraulic-resistance.md)
without changing its scientific status. Rain/source addition, positive quadratic Manning resistance,
donor limiting, water gather and donor-area face velocity have distinct single-writer pass boundaries.
Closed edges and the outlet corner priority match the CPU reference. The same public CPU dry-depth,
unit-conversion, admissible-range and wave-safety constants are imported into WGSL literals.

Three r187 manages storage and ordered dispatch, with explicit arithmetic in `wgslFn`. A deterministic
max tree reduces the wave guard and invalid-stock flag. A single invocation latches failure before
commit. Every cell then either copies its complete candidate water/flux state or retains its previous
state. Further queued steps after a failure cannot mutate the accepted state. Batches read only a small
status buffer, and errors identify the first uncommitted step. Uncaptured GPU validation errors and
device loss become rejected operations. A wave violation cannot be accepted by a report-only option.

## Precision and snapshots

Initial elevation is stored relative to a fixed local datum. Subsequent elevation changes have a
separate compensated float32 lane. Pressure differences subtract base, change and water lanes
separately, so a tiny change is not lost by adding it to an absolute elevation before subtraction.
`addElevationChange` is a diagnostic/4A primitive, not an erosion animation or a reader tool.

The precision test accumulates sub-ulp negative changes against a copied CPU float64 reference. The
ordinary absolute float32 representation loses each increment; the separate lane preserves their sum.
This validates storage arithmetic, not the full erosion rule that 4A still has to implement.

`snapshot()` returns water, flux, velocity, split elevation reconstruction and a common version/step.
Mutations and snapshots serialize; concurrent snapshot requests coalesce. `sample(nowMs)` allows at
most two logical full snapshots per second and skips requests while one is in flight. A logical
snapshot copies several attribute buffers atomically with respect to mutations. The caller must use
that one snapshot for both mesh and contours. Full reads are for this bounded view cadence or explicit
diagnostics, never each animation frame. The frame camera/lift loop can remain independent.

## Run and interpret the comparison

```sh
pnpm install
pnpm --filter @hachure/terrain test:gpu
pnpm check
pnpm build
```

The browser suite uses Vitest browser mode with Playwright Chromium, installed Chrome by default and
`--enable-unsafe-webgpu`. Set `GPU_CHROMIUM_BUNDLED=1` after installing Playwright Chromium to use its
bundled browser. `GPU_SOFTWARE=1` requests a software/Vulkan attempt for CI. The dedicated workflow runs
on PRs and main, removes committed local evidence before setup, prints the capability and result JSON, and explicitly skips tagged browser tests only
when `navigator.gpu.requestAdapter` returns no adapter. A skip is not CPU–GPU agreement: the lead must
run the suite on a GPU machine at wave close. Shader/dispatch failures on an available adapter fail.

The comparison checks water against CPU float64 authority and flux/velocity against the public CPU
snapshot. Each value must meet `absolute + relative × abs(reference)`:

| Field                 | Absolute floor | Relative tolerance |
| --------------------- | -------------: | -----------------: |
| Water depth (m)       |           2e-7 |               5e-4 |
| Pipe discharge (m³/s) |           2e-6 |               5e-4 |
| Velocity (m/s)        |           2e-5 |               5e-4 |

These bounds are declared in `fields.ts`, not inferred from each test result. Cases cover the shared dry,
wet and wet-front fixtures, both timestep refinements and all roughness endpoints/default, a persistent
spring, an odd grid, all outlet directions/corner priority and a preset edited by the real raise, dig
and harden brushes. The real seeded tilted-plateau preset at 128² with its declared spring is compared
for 80 water-only steps under the same tolerances, independently of performance timing. Accepted step counts prevent a no-op GPU dispatch from passing a still fixture.
Same-device bitwise replay, guarded rejection without commit, compensated precision and atomic sampling
are independent tests.

`results-local.json` is generated by the browser run, including adapter identity, cases, precision and
performance. `environment-local.json` records the OS-reported Intel Arc 140V driver 32.0.101.8860 and
CPU; the browser does not expose that driver version. Timings include dispatch, guard reductions, GPU
completion and the batch's small status read, after compilation warmup. Snapshot timing is separate.
These are headless development-machine samples, not classroom frame-rate evidence or full-solver cost.

## Sources and handover

- [Three.js WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html) and installed pinned
  r187 renderer/storage/WGSL source; the implementation follows the 1B managed-dispatch decision.
- [Vitest browser mode](https://vitest.dev/guide/browser/) and [browser commands](https://vitest.dev/api/browser/commands).
- Hydraulic scientific derivation and provisional sources remain in the prerequisite science document.

4A must implement the remaining process stages and budgets, integrate tool/config/reset operations,
prove full-step CPU–GPU parity and mass closure, and connect backend selection. Reuse split elevation,
fixed-order reduction and same-version readback semantics. The float32 exact step counter is bounded
before its integer precision limit; a later full backend can replace it with integer metadata. Do not
ship this partial stage as a full terrain simulation.
