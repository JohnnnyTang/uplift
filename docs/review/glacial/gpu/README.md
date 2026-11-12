# GPU glacier and CPU/GPU parity (session 5I)

**Result: the GPU glacier passed every registered comparison gate on the device tested, and it runs about
38× faster than the CPU. Recommended default backend: WebGPU, with the CPU as the labelled fallback.**
The only device tested is an Intel Arc 140V (xe-2lpg) in headless Chrome. No other adapter was observed.
Automatic selection therefore runs a per-device kernel check before it trusts an adapter (see
[Fallback](#fallback-and-selection)).

| File                       | What                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `tolerances.md`            | Tolerances and gates, **committed before any registered run** (commit `ba8b399`)                         |
| `results-local.json`       | Registered-horizon comparison: gates, every check per arm and snapshot, verdict parity, speed, adapter   |
| `results-quick-local.json` | Default suite: early interval per rock, determinism, on-device precision, device check, forced fallbacks |
| `runs/<arm>.json`          | GPU arm records in the 5G review-runner format (`evaluateProtocol` reads them like the CPU records)      |

## What was built

`@hachure/glacier/gpu` (`hachure/glacier/src/gpu/`) contains the following.

- **`createGpuGlacier`**: the frozen 5G/5G2 model as eight WebGPU compute kernels: shape factor (raw and
  smoothed), rates, edge flux, limiter ratio, transport with erosion, wall failure, and commit. Each kernel
  is in the CPU pass order, uses the D-W5-5G2 edge-mean stress discretisation (the 2Δx fix), and has the
  same config, start, fixed step and frame. It uses raw WebGPU, not Three.js. One small status read is made
  per batch, and full reads happen only on request. There are no float atomics. Every kernel has one writer
  per output word, so the solver is deterministic on a device.
- **`AsyncGlacierSolver`**: the frozen `GlacierSolver` interface, method for method, made asynchronous.
  `asyncCpuGlacier` wraps the unchanged CPU reference in it, so the runtime (5J) holds one interface and a
  `backend` label.
- **`selectGlacierBackend`**, **`restartOnCpu`**, **`checkGlacierGpuDevice`** and **`GLACIER_GPU_PARITY`**:
  backend selection with labelled fallback (below).
- **`compare.ts`**: the declared tolerances as code and the comparison measures, unit-tested in Node.

The CPU solver and the frozen config, state, probe and capture contracts are unchanged.

## Float precision

<!-- expert-review -->

- **Bed and ice are two float32 lanes (hi + lo) relative to the run's local datum** (the lowest starting
  bed). Updates use error-free two-sum. Surface and bed differences subtract lane by lane. This is the split
  representation D-2A-1 asked for. On this device, 100 000 increments of −1e-6 m on a 2000 m lane ended
  3.9e-8 m from the Float64 sum, where plain float32 lost the whole 0.1 m (`results-quick-local.json` →
  `precision`). The lanes hold each increment to about 1e-11 m. The cumulative error grows with the number
  of steps, about 4e-13 m per step here.
- **Rates are float32.** These are gradients, diffusivity, stresses, velocities, the shape-factor geometry
  and erosion. Constants are computed in Float64 on the host, exactly as the CPU computes them, and rounded
  once. The fixed balance on the starting bed is computed in Float64 and rounded once per cell.
- **Budgets** are per-cell compensated ledgers summed in Float64 on the host. Counters are per-cell u32. The
  step counter is a host integer. The worst GPU budget closure over every arm and snapshot was 9.5e-10 of
  the gross flux.
- **Not bitwise.** GPU results are not bitwise equal to the CPU, and WGSL `sqrt`, `pow` and division allow
  several ulp, so they are not bitwise equal across devices. The GPU state hash differs from the CPU hash.
  Same-device replay is bitwise identical, including with different submit chunking.

## Registered comparison (300 model years)

Arms run on the GPU: the nine rock arms (three rocks × seeds 1–3), `control-no-ice`, `control-no-erosion` and
`check-half-step`. The seed-1 rock arms ran a live CPU in lockstep in the same browser, which gave full-field
comparisons at every 20-year snapshot. Those live CPU runs reproduced the committed 5G2 record hashes bitwise,
so the CPU records used for seeds 2–3 and the controls describe the current CPU code.

| Gate                                            | Bound (declared)                                        | Worst observed                                                                        | Pass |
| ----------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---- |
| G1 section measures (all arms, sections, times) | 2.5 m · 1° · b 0.1 · eroded area max(2.5 %, 500 m²)     | live arms ≤ 0.6 mm, 1e-4°, b 1e-6, 0.14 m²; record arms ≤ 0.0014 (record rounding)    | yes  |
| G2 verdict parity                               | identical, except borderline                            | **39 / 39 identical** (3 borderline, all identical anyway)                            | yes  |
| G3 probes                                       | rel 1–5 %, snout 1 cell                                 | rel ≤ 2.1e-6; snout identical                                                         | yes  |
| G4 budget                                       | rel 1 % / 2.5 %; closure 1e-5                           | rel ≤ 3e-7; closure ≤ 9.5e-10                                                         | yes  |
| G5 fields, every snapshot (seed 1)              | bed RMS 0.5 / p99 2.5 m; ice 1 / 5 m; speed 2 / 10 m/yr | bed RMS 0.48 mm, p99 2.0 mm, max 8.3 mm (shale); ice max 8.6 mm; speed max 0.011 m/yr | yes  |
| G6 section profiles (100/200/300)               | 2.5 m                                                   | 0.8 mm                                                                                | yes  |
| G7 early interval (20 years)                    | one tenth of G5                                         | bed max 2.8e-6 m, ice max 5.5e-5 m                                                    | yes  |
| G8 determinism, precision                       | bitwise replay; lane error ≤ 1e-6 · sum                 | bitwise; 3.9e-8 m against a 1e-7 m bound                                              | yes  |
| G9 forced fallbacks                             | labelled, latched, no silent switch                     | all paths pass (below)                                                                | yes  |

Per rock (seed 1, worst over all snapshots, |GPU − CPU|): shale bed 8.3 mm, sandstone 0.94 mm, granite
0.30 mm. Shale is the largest because its fast, threshold-rich erosion amplifies float32 noise most. Even
there the differences are about 300 times smaller than the declared p99 bounds. The borderline verdicts
are T1-sandstone-s1 (b +0.21 against +0.2), E-R3 and E-R4. Each came out the same on both backends.

## Speed (diagnostic: this machine, headless Chrome)

| Run                                     | GPU ms / model year | CPU ms / model year (same browser) | CPU (Node, 5G2 record, loaded machine) |
| --------------------------------------- | ------------------- | ---------------------------------- | -------------------------------------- |
| shale / sandstone / granite seed 1      | 9.4 / 9.4 / 9.5     | 308 / 292 / 284                    | 437 / 443 / 415                        |
| other rock arms (no CPU running beside) | 7.6–7.7             | —                                  | 415–444                                |
| half-step check (dt 0.00125)            | 14.8                | —                                  | 785                                    |

The figures are medians from the first registered run, which ran alone. GPU 7.7 ms against CPU 292 ms per
model year is **38×**. A 300-year run takes about 2.3 s on the GPU and about 90 s on the CPU. The second run
(quick and registered suites in parallel) measured 7.7 against 352 ms, 46×. GPU time covers dispatch, GPU
completion and the 16-byte status read for each 20-year batch, after pipeline creation. It excludes rendering
and full-state reads. The per-device check costs about 0.1–0.15 s at selection. **These are numbers for this
development machine, not classroom hardware.**

## Fallback and selection

- `prefer: "cpu"` gives the CPU reference.
- `prefer: "webgpu"` gives the GPU, or a rejected `GlacierGpuError` with its reason. An explicit request is
  never served by the CPU.
- `prefer: "auto"` gives WebGPU only when `GLACIER_GPU_PARITY` says passed, the adapter and device come up,
  and the **per-device kernel check** passes. That check runs 80 steps from the authored start under a uniform
  150 m ice slab, which exercises every kernel. GPU and CPU must agree within 1 cm. On this device, all three
  rocks agreed to 6e-7 m (bed) and 9e-6 m (ice). With erosion deliberately doubled in the shader, the check
  saw 1.2 m and failed. If any step fails, `auto` runs the CPU with `fallbackReason` and `failure`, for
  example `WebGPU not used, running on CPU: [device-check-failed] …`. The 1 cm bound was written into
  `device-check.ts` before the check first ran. It was committed with the results, not separately.
- **Mid-run failure** (device lost, validation error, non-finite state) rejects the call and latches the
  solver. The step count is not advanced past the failure, and no further step runs. The run never continues
  on the CPU. `restartOnCpu` starts a **new** CPU run from the authored start, labelled
  `WebGPU run halted at step N (reason); new CPU run from the authored start`. After a non-finite halt the
  state stays readable, as on the CPU.
- Tested paths: in Node with stubs, missing WebGPU, a null or throwing adapter, too few storage buffers, a
  failing device request, and `auto` gated by the parity record. In real Chrome, missing WebGPU, an invalid
  shader (`pipeline-failed`), a device lost mid-run, non-finite state, a skewed kernel caught by the device
  check, and `auto` selecting WebGPU from the recorded parity.

## Run it

```sh
pnpm --filter @hachure/glacier test:gpu                       # default suite, ~20 s (real WebGPU)
GLACIER_GPU_FULL=1 pnpm --filter @hachure/glacier test:gpu    # + registered horizon, ~5–6 min
```

The harness is the water comparison's: Vitest browser mode with Playwright and installed Chrome, plus
`--enable-unsafe-webgpu`. `GPU_CHROMIUM_BUNDLED=1` and `GPU_SOFTWARE=1` work as in
`hachure/terrain/src/compare/README.md`. Without an adapter, the GPU tests skip explicitly and record
`SKIPPED`, which never counts as parity. CI does not run this suite yet. Adding a job to
`.github/workflows/gpu-water.yml` is lead-owned glue, and a software adapter would make the default suite slow
but feasible.

## Limits of this evidence

- One adapter (Intel Arc 140V, Windows, Chrome headless). Other GPUs, mobile, Safari and Firefox are untested.
  The device check is the guard there, not proof.
- The comparison covers the product arms (rocks × seeds, controls, half step). The recorded failed attempts
  (A0, A2a, 5G open head) were not re-run on the GPU. They are not product runs.
- Browser timings are headless and do not include rendering cost or thermal and power control.
