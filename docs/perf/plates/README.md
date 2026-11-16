# Bounded performance check: lesson 2 and the page turn (session 7F)

Same target laptop and method as 6A / 6A2 (`docs/perf/README.md`): ASUS Zenbook S 14, Intel Core Ultra 7 258V,
Intel Arc 140V (driver 32.0.101.8860), visible (headed) Google Chrome 157.0.8103.78 through Playwright
`channel: "chrome"`, window maximised (viewport 1440 × 709, device pixel ratio 2), AC power, production build
served by `vite preview`, a fresh browser and profile per repetition, page-clock times. Commit `ebe4d86`
(the 7F code; only these result files were added after it). 2026-11-16 01:57–02:15 UTC.

## 1 · Lesson 1's journey against the 6A2 baseline: no regression

6A2's own harness, unchanged except a `--root` option:
`node docs/perf/batch-latency.mjs --root=docs/perf/plates/6a2-harness --label=lesson1 --backend=both --reps=3`.
Raw files and `summary.json` in `6a2-harness/`. Baseline: `docs/perf/results/6a2/summary.json`, `after/`
(5 repetitions per path, the current per-backend batch defaults). Median / p90 / max, pooled.

| Measure                                 | WebGPU 6A2 after | WebGPU 7F     | CPU 6A2 after   | CPU 7F          |
| --------------------------------------- | ---------------- | ------------- | --------------- | --------------- |
| Model years per second, 1×              | 9.95 / 9.98      | 9.92 / 9.95   | 3.53 / 3.82     | 3.59 / 3.75     |
| Model years per second, 4×              | 37.05 / 41.1     | 39.41 / 40.74 | 3.14 / 3.34     | 3.04 / 3.34     |
| Playback 1×: fps; p95 interval (ms)     | 117.8; 8.4       | 119.0; 8.5    | 118.7; 8.5      | 119.2; 8.5      |
| Playback 1×: longest frame (ms)         | 25.1 / 34.3      | 25 / 25       | 16.7 / 33.2     | 16.6 / 25       |
| Playback 4×: longest frame (ms)         | 16.7 / 41.6      | 16.5 / 25.2   | 25 / 49.9       | 16.7 / 16.7     |
| Playback 1×: main thread busy (%)       | 49 / 57          | 54 / 56       | 19 / 20         | 18 / 18         |
| Pause → final live frame (ms)           | 35 / 43 / 57     | 26 / 37 / 46  | 57 / 75 / 96    | 56 / 76 / 81    |
| Scrub right after Pause, kept run (ms)  | 25 / 30 / 33     | 23 / 35 / 42  | 39 / 67 / 96    | 37 / 64 / 73    |
| Scrub 1.5 s after Pause (ms)            | 26 / 33 / 38     | 23 / 29 / 30  | 25 / 38 / 48    | 23 / 32 / 33    |
| Research departure while playing, first | 159 / 247        | 173 / 177     | 176 / 222       | 178 / 205       |
| Research departure, repeat (ms)         | 44 / 63 / 67     | 44 / 66 / 83  | 177 / 265 / 317 | 203 / 247 / 293 |
| Run kept after every return             | yes              | yes           | yes             | yes             |

Every difference lies within the spread of 6A2's own repetitions; no window was throttled and no sample dropped.

## 2 · Lesson 2 and the page turn (new)

`node docs/perf/plates/turn.mjs --reps=5` (raw in `turn/`, pooled in `turn-summary.json`). Each repetition:
lesson 1 playing on WebGPU → turn to lesson 2 → convergent → play 6 s → scrub (End, then 6 × ←) → divergent →
transform by the arrow key on the left plate's handle → turn back; then three more turn cycles while lesson 1
plays. One repetition whose window was occluded (every frame about 1,008 ms, Chrome's background throttling)
was dropped and rerun (`turn-dropped/`), as 6A drops interrupted windows.

| Step (median / p90 / max)                          | First turn                                       | Repeat turns (n 15) |
| -------------------------------------------------- | ------------------------------------------------ | ------------------- |
| Click → lesson 2's drawing painted                 | 456 / 466 ms                                     | 470 / 486 / 494 ms  |
| Click → 3D stage ready (transition starts)         | 737 / 771 ms                                     | 712 / 744 / 747 ms  |
| Click → transition done (usable)                   | 3,389 / 3,432 ms                                 | 1,127 / 1,152 ms    |
| Turn back: click → lesson 1 live and usable        | 1,079 / 1,091 ms                                 | 1,099 / 1,137 ms    |
| First transition: fps; p95 interval; longest frame | 115; 8.5 ms; 108 / 125 ms (one frame over 50 ms) |                     |

| Lesson 2 interaction (median / p90 / max)      | Visible answer                              |
| ---------------------------------------------- | ------------------------------------------- |
| Choose convergent (picker click → frame shown) | 103 / 108 ms                                |
| Choose divergent                               | 84 / 90 ms                                  |
| Arrow key on a plate handle → transform shown  | 84 / 89 ms                                  |
| Play → playing                                 | 16 / 27 ms                                  |
| Scrub to late (End)                            | 40 / 47 ms                                  |
| Scrub one step (←), n 30                       | 35 / 44 / 46 ms                             |
| Playing 6 s: fps; p95 interval; longest frame  | 101; 25 ms; 33.5 / 41.7 ms; none over 50 ms |
| Paused with two ghosts: fps; longest frame     | 120; 8.6 / 10.7 ms                          |

**Lesson 1 across the turns.** In 20 of 20 returns the run was the same (`data-run-id`) and lesson 1 was playing
again. Model years on return minus at leave: 4.2 median, 6.2 max. That is the play resumed on return (the
reader's play intent, 5J) during the about 1.1 s return, at 10 model years per second; the 5–15 s spent on
lesson 2 would have added 50–150 model years had it run on. Nothing advanced while away.

**Memory.** DOM nodes 620 → 622–625 over four turn cycles (stable). JS heap 18 MB with lesson 1 playing, then
42–68 MB after turn cycles, rising and falling between cycles rather than growing: lesson 2 keeps a bounded
cache of authored frames (7D: LRU of 48 quantised frames) and the retained scenes stay alive by design (5A).

**Reading.** Turning to lesson 2 shows its drawing in under half a second and the 3D stage in under 0.8 s; the
first transition runs at 115 fps with one frame over 50 ms (the stage's first build), like lesson 1's cold start
(6A finding 5). Lesson 2 answers every gesture within about 100 ms. Playing lesson 2 runs at about 100 fps
with 25 ms intervals while the block rebuilds each frame step (7D: about 26 ms per rebuild), well inside 6A's
playback targets (≥ 30 fps, p95 ≤ 33.4 ms, no frame over 100 ms). Turning back to lesson 1 takes about 1.1 s,
in line with 6A's return from the research route (887 ms median on WebGPU, finding 3: a new stage renderer per
mount plus the return crossfade).

**Not measured here (bounded check).** The CPU glacier path across the turn (only WebGPU in section 2; section 1
covers the CPU path of lesson 1), cold network loads, other hardware.
