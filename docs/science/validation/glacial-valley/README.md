<!-- expert-review -->

# Registered protocol on production code: _From V to U_ (session 5N)

**Verdict.** The production glacier code reproduces the registered 5G2 record exactly: all **18 of 18** arms
end on the record's state hash, bitwise, and all **39 of 39** verdicts are identical. **16 verdicts pass and
23 fail**, as registered. The taught claims rest only on passing verdicts (R1, R4, S1, E-R1, E-R3, K1, K2,
N1, plus the shape component of E-T1). The registered trough criterion **T1 fails in 8 of 9 arms** and is
not taught. The **GPU passes every registered CPU/GPU gate** (G1–G7, 39/39 verdicts identical) on the one
adapter tested. GV3 is therefore met for the taught claims and recorded as failed for T1. GV9 passes on this
device.

Nothing here was tuned or re-registered after seeing results. The protocol, its code and its thresholds are
unchanged since the 5G2 registration (commit `c351c93`, numerical fix and final run `73f0d14`).

## Run record

| Field          | Value                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Commit         | `b82dae5a9be2e38b8c822f2754d699bfb284a8b4` (s1/w5/integration after 5M2); `hachure/glacier/src` unmodified                    |
| Date           | 2026-11-14 (UTC)                                                                                                              |
| Device         | Windows 11 Home (10.0.26300), Intel Core Ultra 7 258V (8 logical), 31 GiB, Intel Arc 140V GPU (16 GB), driver 32.0.101.8860   |
| CPU backend    | `createCpuGlacier` (the CPU reference the app's Worker runs), Node v24.12.0, six parallel processes                           |
| GPU backend    | `createGpuGlacier` (WebGPU) in headless Chrome 157 (installed channel), adapter `intel` / `xe-2lpg`, not a fallback adapter   |
| Protocol       | [acceptance-protocol.md](../../glacial/acceptance-protocol.md); code `hachure/glacier/src/testing/protocol.ts`, `evaluate.ts` |
| GPU tolerances | [docs/review/glacial/gpu/tolerances.md](../../../review/glacial/gpu/tolerances.md), declared before 5I's runs                 |

## The protocol, as registered (quoted, not changed)

> After the same model time, the valley in softer rock is wider and deeper, and in harder rock it keeps
> steeper walls and changes more slowly. In every rock, the V under the ice becomes a U-shaped trough,
> while below the snout it stays a V.

Arms: `shale-s1..3`, `sandstone-s1..3`, `granite-s1..3`, `control-no-ice`, `control-no-erosion`,
`check-half-step`, and the recorded attempts `attempt-a0-plain-sia(-shale)`, `attempt-a2a-surface-balance(-shale)`,
`attempt-5g-open-head-shale/-granite`. Horizon 300 model years, snapshots every 20, matched times 100/200/300,
sections i = 14 (below the snout), **74 (under the ice, registered)**, 90 (reported). Criteria T1, T2, R1–R4,
S1, K1, K2, E-T1, E-R1–E-R4, N1 as in the protocol table.

## Results (CPU, every arm)

| Verdict        | Result                 | Numbers (this run)                                                                                                                                      |
| -------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1 trough      | **fail** (8 of 9 arms) | Only sandstone s1 passes. Granite lowered 18 m (< 30 m) though floor +83 m, b +0.29–0.34, wall +19–20°; shale and sandstone s2–3 fail b (walls retreat) |
| T2 below snout | **fail** (2 of 9 arms) | Floor, width and b unchanged in every arm; shale s2–3 fail only because the growing glacier reached the section                                         |
| R1 rate        | pass                   | Smallest step between neighbouring rocks 4 001 m² (need ≥ 1 000)                                                                                        |
| R2 wider       | **fail**               | Smallest step −54.9 m; granite ends with the widest floor                                                                                               |
| R3 steeper     | **fail**               | Smallest step −8.9°; fails at 100 and 200 model years (granite barely worn), holds at 300                                                               |
| R4 deeper      | pass                   | Smallest step 10.2 m (need ≥ 5). Seed 1, 100 y: lowered 30.7 / 18.2 / 7.1 m                                                                             |
| S1 shape       | pass                   | Equal eroded area 13 725 m²: granite walls 45.9 / 46.7 / 46.4°, shale 34.6° (gap 11.3°, need ≥ 3)                                                       |
| E-T1           | **fail** (9 of 9 arms) | b +0.25 to +0.37 and walls +7.5 to +20° in every arm, but lowering 18–27 m (< 30 m)                                                                     |
| E-R1 rate      | pass                   | Time to equal erosion ≈ 85 / 151 / 300 model years (smallest step 65 y, need ≥ 20)                                                                      |
| E-R2 wider     | **fail**               | Hard rock widens more at equal erosion                                                                                                                  |
| E-R3 steeper   | pass                   | Smallest step 3.7° (need ≥ 2)                                                                                                                           |
| E-R4 deeper    | **fail**               | Smallest step 1.8 m (need ≥ 5)                                                                                                                          |
| K1, K2         | pass                   | 0 m³ eroded without ice; 0 m³ and floor width unchanged with erosion off (ice 0.56 km³)                                                                 |
| N1 half step   | pass                   |                                                                                                                                                         | Δ   | floor width 0.3 m, floor 0.4 m, wall 0.01°, eroded area 0.6 % |

The recorded attempts are measured, not judged: plain shallow ice (A0) keeps the V, the surface mass balance
(A2a) confounds the rock comparison, and the 5G open head leaks its shale glacier. Their full records are in
`cpu/runs/`.

CPU cost (diagnostic, six arms at once on this laptop): 312–341 ms per model year on 160 × 64; the half step
593 ms.

## GPU (5I's registered suite, rerun into `gpu/`)

All gates pass: G1 section measures, G2 verdict parity (39/39 identical, including the borderline
T1-sandstone-s1, E-R3 and E-R4), G3 probes, G4 budgets, G5 fields (worst bed 8.3 mm, ice 8.6 mm, surface speed
0.011 m/yr, all in shale), G6 profiles, G7 early interval. The live CPU beside the seed-1 GPU arms again
reproduced the record hashes. GPU 8.2 ms against CPU 361 ms per model year in the same browser (44×,
diagnostic). Recommended default stays **WebGPU**, with the labelled CPU fallback. The recorded attempts were
not run on the GPU; they are not product runs.

## Files

| Path                           | What                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `run.mjs`                      | The runner: `cpu`, `gpu`, `evaluate`, `all`                                                                                    |
| `evaluate.acceptance.ts`       | Gated evaluation (registered evaluator, record comparison, environment) → `results.json`                                       |
| `vitest.config.mjs`            | Config for the gated evaluation only (not part of `pnpm test`)                                                                 |
| `results.json`                 | Every verdict with its detail, the matched-time table, matched-erosion readings, hashes, GPU summary                           |
| `cpu/runs/<arm>.json`, `.png`  | Every arm, including attempts and failures: probes, budgets, diagnostics, sections every 20 years; plan views at 0/100/200/300 |
| `gpu/results-local.json`       | 5I gates, per-snapshot checks, verdict parity, speed, adapter                                                                  |
| `gpu/results-quick-local.json` | 5I default suite: determinism, precision, device check, forced fallbacks                                                       |
| `gpu/runs/<arm>.json`          | GPU arm records, same format                                                                                                   |

```sh
node docs/science/validation/glacial-valley/run.mjs all   # ~6 min CPU (6 jobs) + ~6 min GPU + evaluation
```

## What this does not show

- One machine and one GPU adapter. Other devices rely on the runtime's per-device check (pending hardware).
- The model is uncalibrated; model years compress erosion 120×. Expert review of the shape factor, the
  cold-based ramp, the 30 m threshold and the overdeepening note is pending
  ([expert packet](../../../review/glacial/acceptance/expert-review.md)).
