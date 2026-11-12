# GPU glacier: declared comparison tolerances (session 5I)

**Status: declared before the registered CPU/GPU comparison was run.** This file was committed
before any registered-horizon GPU run existed (see the git history of this path). Results go in
[README.md](README.md) and `results-local.json`. Every result is kept, including failures. A
tolerance in this file is never loosened after a result. If one proves wrong, the failure stays
recorded and any new tolerance is registered as a new, dated deviation below the original.

## What is compared

The GPU solver (`@hachure/glacier/gpu`, WebGPU compute) implements the frozen 5G/5G2 model: the same
config, start, fixed step, pass order and the D-W5-5G2 edge-mean stress discretisation (the 2Δx fix). The
reference is the CPU solver (`createCpuGlacier`, Float64), unchanged.

- **Registered horizon:** 300 model years, snapshots every 20 model years, matched times 100 / 200 /
  300 (`PROTOCOL_*` in `hachure/glacier/src/testing/protocol.ts`).
- **Rocks:** every shipped rock (shale, sandstone, granite).
- **Arms run on the GPU:** the nine rock arms (three rocks × seeds 1–3), `control-no-ice`,
  `control-no-erosion` and `check-half-step`. Recorded attempts are not product runs and are not compared.
- **CPU reference:** a live CPU run in the same browser for seed 1 of each rock, used for the full-field
  comparison. For seeds 2–3 and the controls, the committed registered CPU records
  (`docs/review/glacial/model/runs/<arm>.json`, measures rounded to 0.001) are the reference. The live seed-1
  CPU runs must reproduce the committed `finalHash` of their records, which shows that the records still
  describe the current CPU code.

## Float precision (analysis behind the numbers)

<!-- expert-review -->

- **Magnitudes.** The bed is 1000–2600 m above sea level and 0–1600 m above the run's local datum (the lowest
  starting bed). The float32 ulp is 1.2e-4 m at 1024–2048 m. Erosion per step is
  `erosionSpeedup · ε_ref · erodibility · (u_b/u_ref)² · dt` ≈ 3e-3 · erodibility · (u_b/100)² m. For
  typical sliding that is 1e-7 to 6e-3 m. Plain float32 absolute elevation loses most of this to rounding,
  as D-2A-1 already found. Ice is 0–500 m (ulp ≤ 6.1e-5 m). Per-step mass-balance increments are
  ≤ 7.5e-3 m.
- **Representation.** Bed and ice are each stored as **two float32 lanes (hi + lo) relative to a local
  datum**, updated with error-free two-sum additions. That gives about 48 significand bits, or ~1e-11 m,
  for state that changes by sub-ulp amounts each step. This is a split representation in the sense of
  D-2A-1/D-S1-W3-3C. Surface differences subtract lane by lane, so neighbouring absolute elevations
  never cancel in float32. Per-cell budget ledgers (applied mass balance, edge outflow) use the same
  compensated lanes and are summed in Float64 on the host. Counters are per-cell u32, and the step counter
  is a host integer (never float32).
- **Rates stay float32.** Gradients, diffusivity (the expression `cDef (fH)³ H |∇s|²` plus the sliding term,
  about 15 operations), stresses, velocities, the shape-factor geometry and the erosion rate are float32.
  Their relative error is of order 1e-6. WGSL's `sqrt`, `pow` and division are not correctly rounded
  (several ulp are allowed), so results are **not bitwise equal to the CPU and not bitwise equal across
  devices**. Same-device replay must be bitwise identical.
- **Where differences grow beyond rounding.** The model contains discrete decisions: the shape factor's
  ray walk and Voronoi test, the minimum-ice inclusion test, the explicit-stability cap and the outflow
  limiter (both continuous but kinked), the thin-ice sliding ramp, the wall-failure threshold, and in the
  measures the thalweg arg-min and the depth-band sample selection. Over 120 000 steps, float32 noise can
  flip these at isolated cells. Bed and ice then differ by more than rounding. The tolerances below are
  set from **what the registered protocol and the page can resolve**, not from what float32 might reach.

## Tolerances

A value passes when `|GPU − CPU| ≤ bound`. "Rel" means `|GPU − CPU| ≤ rel · |CPU|`. Field percentiles are
over all cells.

### G1 · Registered section measures (gate)

At each matched time (100, 200, 300) and the start, for every rock arm (seeds 1–3), and for the under-ice,
below-snout and upper sections:

| Measure                      | Bound                    | Basis                                               |
| ---------------------------- | ------------------------ | --------------------------------------------------- |
| floorWidthM                  | 2.5 m                    | half the registered rock step R2 (5 m)              |
| floorElevationM (→ lowering) | 2.5 m                    | half R4 (5 m)                                       |
| depthM                       | 2.5 m                    | half R4 (5 m)                                       |
| maxWallSlopeDeg              | 1.0°                     | half R3 (2°)                                        |
| wallSlopeDeg                 | 1.0°                     | half R3 (2°)                                        |
| shapeExponent                | 0.1                      | half the T1 rise (0.2)                              |
| erodedAreaM2                 | max(2.5 % · CPU, 500 m²) | half the N1 bound (5 %); half the R1 step (1000 m²) |

N1 (halving the step) moved these by 0.3 m, 0.4 m, 0.01° and 0.6 %, so every bound is at least as large as
the model's own accepted discretisation sensitivity. A backend difference within half a registered rock step
cannot reverse a rock ordering that holds by its registered margin.

### G2 · Verdict parity (gate)

Every registered verdict (T1, T2, R1–R4, S1, E-T1, E-R1–E-R4, K1, K2, N1), evaluated by
`evaluateProtocol` on the GPU arms, equals the registered CPU verdict (`docs/review/glacial/model/summary.json`),
**except borderline verdicts**. A verdict is borderline when the CPU input that decides it lies within the G1
bound of its threshold. For an ordering (a step between two arms) the band is twice the G1 bound. For T2, the
verdict is borderline when the largest ice thickness seen at the below-snout section is under 1 m
(`minIceThicknessM`). Borderline flips are reported with their margins. They do not fail the gate, because the
CPU result itself is within its numerical resolution of the threshold there.

### G3 · Probes (gate)

At every 20-year snapshot of the seed-1 rock arms against the live CPU, and at the matched times of every
compared arm against its record:

| Probe                   | Bound                 |
| ----------------------- | --------------------- |
| iceVolumeM3             | rel 1 %               |
| iceAreaM2               | rel 1 % (or 2 cells)  |
| erodedVolumeM3          | rel 2.5 % (or 1e5 m³) |
| maxSlidingSpeedMPerYear | rel 5 % (or 1 m/yr)   |
| maxSurfaceSpeedMPerYear | rel 5 % (or 1 m/yr)   |
| snoutXM                 | 40 m (one cell)       |

The absolute floors (in brackets) apply while a quantity is still near zero early in a run.

### G4 · Ice budget (gate)

- surfaceMassBalanceM3: rel 1 %; edgeOutflowM3: rel 2.5 % or 1e6 m³.
- GPU closure: `|residualM3| ≤ 1e-5 · (|surfaceMassBalanceM3| + |edgeOutflowM3|) + 1 m³`. The CPU closes to
  Float64 round-off. The GPU must close its own budget at compensated-float32 level.

### G5 · Fields (gate), seed-1 rock arms vs live CPU, at every 20-year snapshot

| Field                                     | RMS ≤  | 99th percentile ≤ | Basis                                                      |
| ----------------------------------------- | ------ | ----------------- | ---------------------------------------------------------- |
| bedM                                      | 0.5 m  | 2.5 m             | p99 = half the smallest registered rock step (5 m)         |
| iceThicknessM                             | 1.0 m  | 5 m               | 1 m = `minIceThicknessM`; 5 m ≈ 2 % of the trunk thickness |
| surface speed \|v\| (from the two layers) | 2 m/yr | 10 m/yr           | ≈ 2 % / 9 % of the ~110 m/yr peak surface speed            |

The largest per-cell difference is reported as a diagnostic, not a gate. Isolated threshold flips are
expected (see above).

### G6 · Section profiles (gate)

The bed along the three registered section rows (i = 14, 74, 90), at 100 / 200 / 300 model years, seed-1 rock
arms vs live CPU: largest difference ≤ 2.5 m (half the R2/R4 step).

### G7 · Early interval (gate; porting-error detector)

At 20 model years (the first snapshot interval, the one the capture test reproduces), seed-1 rock arms vs live
CPU: one tenth of G5 (bed RMS ≤ 0.05 m, p99 ≤ 0.25 m; ice RMS ≤ 0.1 m, p99 ≤ 0.5 m; speed RMS ≤ 0.2 m/yr,
p99 ≤ 1 m/yr). A porting error makes O(1) differences long before chaotic growth could.

### G8 · Determinism and precision (gate)

- The same rock, config and backend on the same device: two GPU runs give bitwise-identical state (the hash
  of the Float64 reconstruction of the lanes) after 2000 steps and after 20 model years.
- The compensated lanes hold sub-ulp accumulation. 100 000 additions of −1e-6 m to a 2000 m bed lane must end
  within 1e-6 · |sum| of the Float64 sum, while plain float32 is shown to lose it.

### G9 · Fallback (gate)

Missing `navigator.gpu`, a null adapter, a failing device request, a failing pipeline (forced invalid shader),
a device lost mid-run (forced `destroy()`) and non-finite state each give a labelled outcome. Creation
failures under `auto` select the CPU with the reason recorded. A mid-run failure rejects the call and latches
the solver: no further step runs and no silent switch to the CPU continues the run. A CPU restart is a new,
labelled run from the authored start.

## Speed (reported; decides the default, not parity)

GPU and CPU milliseconds per model year on the reference grid (160 × 64, dt = 0.0025), measured in the same
headless browser on this machine. GPU time includes dispatch and the batch's status readback, after warm-up.
CPU time is the reference solver in the same browser, and the Node figure from the 5G2 records is quoted too.
These are **diagnostic numbers for this development machine**, not target classroom hardware.

**Recommended default backend.** WebGPU becomes the default only if G1–G9 all pass **and** the GPU is at least
2× faster per model year than the CPU in the same browser. Otherwise CPU stays the default. The GPU then stays
selectable only where it passed (owner decision 9) or is disabled.
