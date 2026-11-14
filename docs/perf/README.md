# Performance of the complete reader journey (session 6A)

Stage 1, Wave 6, session 6A. Visible (headed) installed Chrome on the target integrated-GPU laptop, the
production build, both supported paths. Mapping, method and targets were recorded in `DECISIONS.md` **D-W6-6A**
(commit `22ef5f1`) before the measured runs; results and their reading are in **D-W6-6A-RESULTS**.

## Setup of every measured run

| Item              | Value                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Commit            | `32d45c8` (application code identical to main `c50cbd9`; only `DECISIONS.md` and `docs/perf/` differ) |
| Device            | ASUS Zenbook S 14 UX5406SA, Intel Core Ultra 7 258V (8 cores), 32 GB, Windows 11 (10.0.26300)         |
| GPU and driver    | Intel Arc 140V (integrated, WebGPU adapter `intel` / `xe-2lpg`), driver 32.0.101.8860 (2026-06-24)    |
| Display           | 2880 × 1800 at 120 Hz; Chrome window maximised: viewport 1440 × 709 CSS px, device pixel ratio 2      |
| Browser           | Google Chrome 157.0.8103.78, visible (headed), through Playwright 1.65 `channel: "chrome"`            |
| Power             | AC power, battery 100 %; Windows "Balanced" scheme with the "Best performance" power mode             |
| Thermal           | Thermal zone `_TZ.THRM` 79–90 °C and `_TZ.THZ0` 58–66 °C at the start and end of every repetition     |
| Repetitions       | 5 per path, alternating WebGPU and CPU, 2026-11-14 22:00–22:41 UTC; network 9 loads, 22:41–22:44 UTC  |
| Windows minimised | 7 times during 3 repetitions (by activity on the machine); 12 overlapping samples/windows dropped     |
| Other load        | One 3-second diagnostic build during WebGPU repetition 3 (`results/external-load.json`); dropped      |

Every repetition read back the backends it actually used: WebGPU path, glacier solver `webgpu`, stage renderer
`webgpu`, research terrain `webgpu` at 256²; CPU path, glacier solver `cpu`, stage renderer `webgpu`, research
terrain `cpu-worker` at 128². No repetition had a page error, a console error or a failed step.

## Headline

| Journey step (median / p90 of pooled samples)                | WebGPU path                                | CPU path                      | Target (D-W6-6A)         | Met?                  |
| ------------------------------------------------------------ | ------------------------------------------ | ----------------------------- | ------------------------ | --------------------- |
| Readable drawing painted, cold                               | 1 227 / 1 335 ms                           | 435 / 794 ms                  | ≤ 1 800 ms               | yes / yes             |
| 3D stage ready (transition starts), cold                     | 1 762 / 1 802 ms                           | 848 / 1 748 ms                | ≤ 2 500 ms               | yes / yes             |
| First usable interaction (after the 2.7 s transition)        | 4 432 / 4 478 ms                           | 3 541 / 4 417 ms              | stage + 2 700 ms         | yes / yes             |
| Transition frames (median fps; p95 interval)                 | 80 fps; 12.1 / 14.1 ms                     | 97 fps; 8.5 / 13.9 ms         | ≥ 30 fps; p95 ≤ 33.4 ms  | yes / yes             |
| Rock by page selector, before the run advances               | 80 / **204** ms                            | 39 / 94 ms                    | p90 ≤ 200 ms             | **marginal no** / yes |
| Rock by specimen drop, before / after the run advances       | 67 / 71; 99 / 130 ms                       | 23 / 45; 49 / 74 ms           | p90 ≤ 200 ms             | yes / yes             |
| Rock by page selector after advance (new run, kept run)      | 86 / 102 ms                                | 39 / 54 ms                    | p90 ≤ 200 ms             | yes / yes             |
| Front face (keyboard) / camera orbit drag longest frame      | 25 / 30 ms; 16.7 ms                        | 18 / 33 ms; 16.7 ms           | p90 ≤ 100 ms             | yes / yes             |
| Play → playing; → first advanced landform                    | 18 / 20; 62 / 86 ms                        | 16 / 25; 100 / 192 ms         | p90 ≤ 200 ms             | yes / yes             |
| Playback 1×: fps; p95 interval; longest frame                | 112; 11.3 / 15.5; 44.6 ms                  | 117; 8.5 / 11.9; 66.7 ms      | ≥ 30; ≤ 33.4; none > 100 | yes / yes             |
| Playback 4×: fps; p95 interval; longest frame                | 105; 12.6 / 16.6; 25.4 ms                  | 119; 8.4 / 10.7; 19.5 ms      | ≥ 30; ≤ 33.4; none > 100 | yes / yes             |
| Glacier model years per real second at 1×                    | 10.0 / 10.0                                | 3.3 / 4.1                     | 10 on WebGPU             | yes / known shortfall |
| Scrub one recorded step (keyboard)                           | 25 / 39 ms                                 | 18 / 23 ms                    | p90 ≤ 100 ms             | yes / yes             |
| Scrub with a kept run at matched time                        | 24 / 33 ms                                 | 20 / **185** ms (max 452)     | p90 ≤ 100 ms             | yes / **no**          |
| Ghost (kept-run comparison) on / off                         | 12 / 17 ms                                 | 10 / 12 ms                    | p90 ≤ 200 ms             | yes / yes             |
| Research: first departure while playing (page / terrain)     | 157 / 214; 1 638 / 1 723                   | 312 / 574; 558 / 977          | ≤ 2 500 ms               | yes / yes             |
| Research: repeat departure                                   | 30 / 63 ms                                 | 384 / 502 ms                  | ≤ 1 000 ms               | yes / yes             |
| Research: return, lesson usable (repeat legs)                | 887 / **1 051** ms                         | 730 / 831 ms                  | ≤ 1 000 ms               | **marginal no** / yes |
| Run, rock, kept run, ghost and model time after every return | identical (35 of 35)                       | identical (35 of 35)          | identical                | yes / yes             |
| Research terrain playing (AC1)                               | 112 fps at 256²                            | 120 fps at 128²               | ≥ 30 fps                 | yes / yes             |
| JS heap after startup → last of repeated runs                | 8.6 → 11.0 MB (6 runs)                     | 8.6 → 11.2 MB (4 runs)        | ≤ 1.1 × earlier maximum  | yes / yes             |
| Kept runs after repeated runs                                | 2                                          | 2                             | live + 2 kept (D-W5-5J)  | yes / yes             |
| JS heap / DOM nodes, first → last of 7 navigation cycles     | 13.3 → 13.9 MB; 2 403 → 2 334              | 12.8 → 13.5 MB; 2 320 → 2 324 | within 10 %              | yes / yes             |
| Production bundle                                            | 6 663 058 bytes (one build for both paths) |                               | < 10 000 000 bytes       | yes                   |

**In short:** on this laptop the whole journey is smooth on both paths: no steady-playback frame over 100 ms,
and every manipulation answers within a few frames. Three declared targets are missed, each narrowly and each
outside 6A's owned code (D-W6-6A-RESULTS). No fix was made.

## Findings

1. **Scrubbing immediately after Pause on the CPU path waits for the in-flight batch.** Only the first scrub
   after pausing is slow (134, 185, 245, 343, 452 ms in the five repetitions; the other 25 samples are 13–25 ms).
   Pause settles the accepted batch before the scrub command runs. A CPU batch is up to 1 model year
   (`maxBatchModelYears`), about 300 ms of CPU here. The repeat research departure on the CPU path (144–754 ms,
   against 15–77 ms on WebGPU) waits on the same settle. Smaller CPU batches would bound both. That is a
   scheduling change in `hachure/runtime/src/runs`/`glacial-host`, outside 6A's owned paths, and is left as a
   recommendation (fixed-step results do not depend on batching, D-W5-5J item 4).
2. **The first rock choices on WebGPU are slower than later ones.** The first two new GPU runs answer in
   135–226 ms; later runs in 43–106 ms. The pooled p90 is 204 ms, against 200. This is consistent with
   first-use GPU run creation in the worker; it was not profiled further.
3. **Returning to the lesson on WebGPU takes 0.7–1.1 s** (median 887 ms). That includes the authored 450 ms
   return crossfade and a new WebGPU stage renderer per mount. 5M chose to dispose the stage on departure and
   mount a new one on return. Keeping the renderer would shorten the return, but it is a design change to the
   ink stage, not a tuning.
4. **WebGPU playback keeps the main thread about 58 % busy** (CPU path: 10 %), but frames stay smooth. A trace
   attributes it mainly to page layout (15 % of wall time), paint (10 %) and style (4 %) after each host publish:
   about 10 per second at 10 model years per second, against about 3 per second on CPU. A JS profile of an
   unminified build shows the scene's `describe` at 5 % and number formatting at 3 %
   (`results/profile-playback-webgpu.json`). This is headroom used, not a miss here. It matters for weaker
   hardware, which is pending.
5. **The cold-start transition has one or two long frames (163–333 ms) on both paths.** The trace
   (`results/diagnostics/trace-startup-gaps.json`) shows Chrome's delayed shutdown of the _previous_ document's
   compositor (`WidgetBase::Shutdown`, posted with a 1 s delay after the navigation commit). It waits for the GPU
   to finish (`RasterImplementation::Finish`, ~290 ms) while the stage and solver initialise. There is also a
   90 ms WebGPU flush in the GPU process. Neither is app script. A reader arriving from a page in the same renderer
   (for example a reload) sees it too; one arriving from another site may not.
6. **The landform visibly updates about 5 times per second at 1× on WebGPU** (3.2 on CPU), by design:
   `frameIntervalSeconds: 0.2` (D-W5-5J). The page itself renders at the display rate.
7. **Unreproduced trial observation.** One trial repetition (before the measured runs, commit `22ef5f1`) showed
   five 280–300 ms frames during WebGPU playback at 1×, with no script attribution
   (`results/diagnostics/trial-webgpu-playback-stalls.json`). None of the 5 measured repetitions, a trace and 12
   targeted A/B runs reproduced it (`results/playback-ab-*.json`). The A/B runs varied the harness's DevTools
   polling, the seven preceding rock choices, and the preceding front-face/camera manipulation. In those files,
   runs with frames near 1 008 ms are minimised-window throttling, not app stalls. The observation is recorded,
   not explained.
8. **Memory is bounded.** After the first run the heap grows about 0.1 MB per run or cycle, at least partly the
   instrument's own logs. The GPU process holds 0.6–0.7 GB with the lesson and 1.3–1.5 GB after the research
   route has been opened (that route keeps its 256² terrain and view while hidden, by design). These figures are
   integrated-GPU shared memory as Windows reports it.
9. **Network.** Startup is 16 requests and 442 KB transferred (gzip from `vite preview`); the three recorded
   captures (3.9 MB) are not fetched by the default route. Medians of 3 cold loads each:

   | Profile                         | FCP      | Readable drawing | Stage ready | Usable   |
   | ------------------------------- | -------- | ---------------- | ----------- | -------- |
   | local (no throttling)           | 256 ms   | 772 ms           | 1 490 ms    | 3 738 ms |
   | emulated 10 Mbit/s, 40 ms RTT   | 424 ms   | 1 181 ms         | 1 468 ms    | 4 165 ms |
   | emulated 1.6 Mbit/s, 150 ms RTT | 1 324 ms | 3 724 ms         | 4 161 ms    | 6 848 ms |

   Bundle: 6 663 058 bytes raw, 3 396 178 gzip, 2 346 702 Brotli (`results/bundle.json`). The largest startup
   chunk is `three.webgpu` (816 KB raw, 219 KB transferred).

10. **Startup varies with machine state.** The readable drawing came later in the early repetitions (WebGPU
    1.23–1.34 s in repetitions 1–3, CPU 0.75–0.79 s in repetitions 1–2) than in the later ones (WebGPU 0.64–0.80 s,
    CPU 0.34–0.44 s). Paired by repetition, the WebGPU path paints the drawing 0.3–0.8 s later than the CPU path. The drawing is inserted
    before any backend work. The cause was not isolated, and both paths meet target 1.

## Pending (not inferred)

- Any other hardware: discrete GPUs, other integrated GPUs, low-end Chromebooks and classroom machines, mobile and
  tablets, battery power, other browsers (Firefox, Safari). Findings 1–4 are most likely to matter there.
- Projector and classroom-network conditions measured in place; the network rows above are emulations.
- A human judgement of whether the measured hitches (finding 5) and the 5 Hz landform update (finding 6) read as
  smooth to a reader.

## Full results

Pooled over repetitions; `n` counts samples. Generated by `summarize.mjs` from `results/raw/`.

| Measure                                                             | webgpu: median / p90 / max  | cpu: median / p90 / max      |
| ------------------------------------------------------------------- | --------------------------- | ---------------------------- |
| Cold start: first contentful paint (ms)                             | 332 / 424 / 424 (n 5)       | 400 / 440 / 440 (n 5)        |
| Cold start: readable drawing painted (ms)                           | 1227 / 1335 / 1335 (n 5)    | 435 / 794 / 794 (n 5)        |
| Cold start: largest contentful paint (ms)                           | 1332 / 1432 / 1432 (n 5)    | 616 / 904 / 904 (n 5)        |
| Cold start: 3D stage and live run ready (ms)                        | 1762 / 1802 / 1802 (n 5)    | 848 / 1748 / 1748 (n 5)      |
| Cold start: first usable interaction (ms)                           | 4432 / 4478 / 4478 (n 5)    | 3541 / 4417 / 4417 (n 5)     |
| Cold start: longest frame before usable (ms)                        | 464.1 / 568.5 / 568.5 (n 5) | 374.8 / 553.8 / 553.8 (n 5)  |
| Transition: duration (ms)                                           | 2694 / 2699 / 2699 (n 5)    | 2698 / 2703 / 2703 (n 5)     |
| Transition: frames per second                                       | 80.2 / 111.1 / 111.1 (n 5)  | 96.6 / 110.1 / 110.1 (n 5)   |
| Transition: p95 frame interval (ms)                                 | 12.1 / 14.1 / 14.1 (n 5)    | 8.5 / 13.9 / 13.9 (n 5)      |
| Transition: longest frame (ms)                                      | 163.2 / 250.7 / 250.7 (n 5) | 181.2 / 333.4 / 333.4 (n 5)  |
| Transition: frames over 50 ms                                       | 2 / 2 / 2 (n 5)             | 2 / 3 / 3 (n 5)              |
| Warm start: readable drawing painted (ms)                           | 769 / 1206 / 1206 (n 5)     | 626 / 742 / 742 (n 5)        |
| Warm start: first usable interaction (ms)                           | 3703 / 4346 / 4346 (n 5)    | 3560 / 3777 / 3777 (n 5)     |
| Warm start: longest transition frame (ms)                           | 141.7 / 185.1 / 185.1 (n 5) | 150.1 / 176 / 176 (n 5)      |
| First interaction (rock, page selector): visible response (ms)      | 204 / 226 / 226 (n 5)       | 94 / 115 / 115 (n 5)         |
| Rock by page selector, before advance: visible response (ms)        | 80 / 204 / 226 (n 20)       | 39 / 94 / 115 (n 20)         |
| Rock by specimen drop, before advance: visible response (ms)        | 67 / 71 / 72 (n 15)         | 23 / 45 / 46 (n 15)          |
| Rock by specimen drop, new run (kept run): visible response (ms)    | 99 / 130 / 130 (n 5)        | 49 / 74 / 74 (n 5)           |
| Rock by page selector, new run (kept run): visible response (ms)    | 86 / 102 / 106 (n 34)       | 39 / 54 / 59 (n 25)          |
| Front face (keyboard): visible response (ms)                        | 25 / 30 / 34 (n 25)         | 18 / 33 / 33 (n 25)          |
| Camera orbit drag: frames per second                                | 117.6 / 120 / 120 (n 5)     | 119.2 / 120 / 120 (n 5)      |
| Camera orbit drag: longest frame (ms)                               | 12.7 / 16.7 / 16.7 (n 5)    | 12.8 / 16.7 / 16.7 (n 5)     |
| Play: button to playing state (ms)                                  | 18 / 20 / 20 (n 5)          | 16 / 25 / 25 (n 5)           |
| Play: button to first advanced landform (ms)                        | 62 / 86 / 86 (n 5)          | 100 / 192 / 192 (n 5)        |
| Playback 1x: frames per second                                      | 111.9 / 119.7 / 119.7 (n 5) | 117 / 119.5 / 119.5 (n 5)    |
| Playback 1x: p95 frame interval (ms)                                | 11.3 / 15.5 / 15.5 (n 5)    | 8.5 / 11.9 / 11.9 (n 5)      |
| Playback 1x: longest frame (ms)                                     | 41.6 / 44.6 / 44.6 (n 5)    | 25.1 / 66.7 / 66.7 (n 5)     |
| Playback 1x: frames over 50 ms per 10 s                             | 0 / 0 / 0 (n 5)             | 0 / 1 / 1 (n 5)              |
| Playback 1x: model years per second                                 | 10 / 10 / 10 (n 5)          | 3.3 / 4.1 / 4.1 (n 5)        |
| Playback 1x: landform updates per second                            | 4.8 / 4.8 / 4.8 (n 5)       | 3.2 / 4 / 4 (n 5)            |
| Playback 1x: main thread busy (%)                                   | 58 / 64 / 64 (n 5)          | 10 / 10 / 10 (n 5)           |
| Playback 1x: renderer CPU (% of one core)                           | 81 / 88 / 88 (n 5)          | 107 / 113 / 113 (n 5)        |
| Playback 1x: GPU process CPU (% of one core)                        | 53 / 57 / 57 (n 5)          | 6 / 7 / 7 (n 5)              |
| Playback 4x: frames per second                                      | 104.7 / 119.7 / 119.7 (n 4) | 119.1 / 120 / 120 (n 5)      |
| Playback 4x: p95 frame interval (ms)                                | 12.6 / 16.6 / 16.6 (n 4)    | 8.4 / 10.7 / 10.7 (n 5)      |
| Playback 4x: longest frame (ms)                                     | 17.1 / 25.4 / 25.4 (n 4)    | 16.8 / 19.5 / 19.5 (n 5)     |
| Playback 4x: model years per second                                 | 31.7 / 39.9 / 39.9 (n 4)    | 3.2 / 3.5 / 3.5 (n 5)        |
| Playback 4x: renderer CPU (% of one core)                           | 43 / 49 / 49 (n 4)          | 106 / 108 / 108 (n 5)        |
| Scrub (keyboard step): visible response (ms)                        | 25 / 39 / 43 (n 24)         | 18 / 23 / 29 (n 30)          |
| Scrub with kept run (matched time): visible response (ms)           | 24 / 33 / 47 (n 30)         | 20 / 185 / 452 (n 30)        |
| Scrub pointer sweep: frames per second                              | 102.6 / 120 / 120 (n 4)     | 117.2 / 120 / 120 (n 5)      |
| Scrub pointer sweep: longest frame (ms)                             | 23.3 / 25 / 25 (n 4)        | 16.7 / 20.8 / 20.8 (n 5)     |
| Back to latest moment: visible response (ms)                        | 25 / 40 / 40 (n 5)          | 16 / 26 / 26 (n 5)           |
| Comparison on/off (kept run): visible response (ms)                 | 12 / 17 / 18 (n 20)         | 10 / 12 / 13 (n 20)          |
| Research, first departure while playing: research page visible (ms) | 157 / 214 / 214 (n 4)       | 312 / 574 / 574 (n 5)        |
| Research, first departure: terrain backend ready (ms)               | 1638 / 1723 / 1723 (n 4)    | 558 / 977 / 977 (n 5)        |
| Research, first return: lesson usable (ms)                          | 805 / 1069 / 1069 (n 4)     | 722 / 823 / 823 (n 5)        |
| Research, repeat departure: research page visible (ms)              | 30 / 63 / 77 (n 29)         | 384 / 502 / 754 (n 30)       |
| Research, repeat return: lesson usable (ms)                         | 887 / 1051 / 1085 (n 29)    | 730 / 831 / 889 (n 30)       |
| Navigation legs: longest frame (ms)                                 | 83.3 / 166.2 / 273.5 (n 66) | 147.1 / 220.7 / 297.2 (n 70) |
| Research terrain playing: frames per second                         | 111.6 / 118.5 / 118.5 (n 4) | 119.5 / 119.9 / 119.9 (n 5)  |
| Research terrain playing: p95 frame interval (ms)                   | 8.5 / 10.9 / 10.9 (n 4)     | 8.5 / 9.5 / 9.5 (n 5)        |
| Research terrain playing: longest frame (ms)                        | 33.3 / 60.5 / 60.5 (n 4)    | 16.7 / 16.7 / 16.7 (n 5)     |
| Research terrain playing: solver steps per second                   | 29.1 / 30 / 30 (n 4)        | 29.2 / 29.2 / 29.2 (n 5)     |
| Research terrain: ms per step (last batch)                          | 4.4 / 4.8 / 4.8 (n 4)       | 2.1 / 2.8 / 2.8 (n 5)        |
| Idle (scene at rest): main thread busy (%)                          | 4 / 4 / 4 (n 5)             | 3 / 4 / 4 (n 5)              |
| Leave the page while playing (wall ms, diagnostic)                  | 32 / 41 / 41 (n 5)          | 23 / 41 / 41 (n 5)           |

| Measure                                                     | webgpu: median / p90 / max     | cpu: median / p90 / max        |
| ----------------------------------------------------------- | ------------------------------ | ------------------------------ |
| JS heap after startup (MB)                                  | 8.6 / 8.6 / 8.6 (n 5)          | 8.6 / 8.6 / 8.6 (n 5)          |
| JS heap after last repeated run (MB)                        | 11 / 11 / 11 (n 5)             | 11.2 / 11.2 / 11.2 (n 5)       |
| JS heap, max over repeated runs (MB)                        | 11 / 11 / 11 (n 5)             | 11.2 / 11.2 / 11.2 (n 5)       |
| Kept runs after last repeated run                           | 2 / 2 / 2 (n 5)                | 2 / 2 / 2 (n 5)                |
| Renderer private memory after startup (MB)                  | 73.2 / 74.6 / 74.6 (n 5)       | 70.8 / 72 / 72 (n 5)           |
| Renderer private memory after last repeated run (MB)        | 109.4 / 115.4 / 115.4 (n 5)    | 103.9 / 105 / 105 (n 5)        |
| GPU process private memory after startup (MB)               | 619.1 / 621.8 / 621.8 (n 5)    | 579.6 / 581.4 / 581.4 (n 5)    |
| GPU process private memory after last repeated run (MB)     | 699.9 / 710.4 / 710.4 (n 5)    | 564.8 / 566.9 / 566.9 (n 5)    |
| JS heap after first navigation cycle (MB)                   | 13.3 / 13.7 / 13.7 (n 5)       | 12.8 / 12.9 / 12.9 (n 5)       |
| JS heap after last navigation cycle (MB)                    | 13.9 / 13.9 / 13.9 (n 5)       | 13.5 / 13.5 / 13.5 (n 5)       |
| DOM nodes after first navigation cycle                      | 2403 / 2403 / 2403 (n 5)       | 2320 / 2320 / 2320 (n 5)       |
| DOM nodes after last navigation cycle                       | 2334 / 2334 / 2334 (n 5)       | 2324 / 2324 / 2324 (n 5)       |
| Renderer private memory after last navigation cycle (MB)    | 194.2 / 198.4 / 198.4 (n 5)    | 140.6 / 144.6 / 144.6 (n 5)    |
| GPU process private memory after last navigation cycle (MB) | 1358.3 / 1390.8 / 1390.8 (n 5) | 1473.1 / 1547.7 / 1547.7 (n 5) |

## What is measured

The book is one lesson, _From V to U_, plus the labelled research route (D-W5-5M2, D-W5-5N2). The brief's
journey maps onto the current app as follows (D-W6-6A):

| Brief step                                       | Measured here                                                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Initial readable drawing                         | Cold and warm start of the default route: FCP, LCP and the glacial line drawing painted                    |
| First usable interaction                         | Scene usable (transition done, live run attached); the first rock choice's visible response                |
| Transition                                       | The drawing → ink → colour → 3D entrance: duration and frame times                                         |
| Response to direct manipulation                  | Rock by page selector and by specimen drop (before and after the run advances); front face; camera orbit   |
| Playback, scrubbing, kept-run comparison         | Play at 1× and 4×; keyboard and pointer scrubbing; scrubbing and ghost on/off with a kept run at 100 years |
| Snapshot memory over repeated runs               | JS heap, DOM and process memory after each of 6 (WebGPU, to 300 years) or 4 (CPU, to 100 years) runs       |
| Page-turn frames, repeated navigation, departure | Research departure while the glacier plays, and return (state checked); 7 departure/return cycles          |
| Retained terrain backend                         | The research route's terrain solver while it plays (auto: WebGPU 256²; CPU worker 128²)                    |
| Page departure                                   | Departure to the research route (settle, dispose); leaving the page while a run plays (diagnostic)         |
| Network startup, bundle                          | Requests and bytes at startup, emulated slow links (`network.mjs`); `pnpm build` + `pnpm check:bundle`     |

**Paths.** _WebGPU_ is the default route `/` exactly as a reader opens it: auto selection runs the device check
and picks the WebGPU glacier, and the research route auto-selects its terrain backend. _CPU_ is
`/?glacier=cpu&backend=cpu-worker`: the CPU worker for both models. Each repetition reads back the backend it
actually used (the deeper level's "Solver" line, the research `.book[data-backend]`, the stage renderer).

## Method

- **Browser.** Installed Google Chrome through Playwright (`channel: "chrome"`, `headless: false`), started
  maximised with `viewport: null`, so the page has the real window size and device pixel ratio. Each repetition
  is a fresh browser process with an empty profile (cold HTTP and shader caches); the warm start is a reload in
  the same browser. Playwright's default Chrome switches apply (recorded per run in `commandLine`), including
  `--disable-backgrounding-occluded-windows` and `--disable-renderer-backgrounding`.
- **Clock.** Every time is taken by the page (`instrument.js`, injected before app code), never by the script's
  polling. _Visible response_ = from the reader's input event (`pointerup` for clicks and the specimen drop,
  `keydown` for keys) to the end of the first frame produced after the app wrote the new state into the DOM. The
  state is the app's own attributes on `.gs-desk` (`data-live-rock`, `data-model-years`, `data-ghost`,
  `data-view`, `data-cut-column`, `data-playing`, `data-transition`, `data-source`); the 3D stage renders the new
  snapshot in that same frame (`BookStage.requestRender`). Frame statistics come from one rAF loop; long frames
  from the Long Animation Frame API; main-thread busy time from the DevTools protocol (`TaskDuration`); CPU per
  process from `SystemInfo.getProcessInfo`; JS heap and DOM after a forced GC; process memory from Windows.
- **Visible window.** A minimised Chrome window is throttled to about one frame per second (seen in the first
  trials while the machine was in use). Before each phase `measure.mjs` brings the window to the front and checks
  the frame rate (`guards`); a watchdog restores a minimised window within 0.5 s and logs the interval
  (`interruptions`). `summarize.mjs` drops every sample and window that overlaps an interruption and reports how
  many were dropped. Nothing throttled is reported as a result.
- **Statistics.** Repetitions pooled per path: n, median, p90 (nearest rank) and max. With n = 5 starts, p90 is
  the worst start.
- **Cost of observing.** One rAF callback per frame keeps Chrome producing frames at the display rate (120 Hz
  here) even when the scene is at rest, so idle CPU is not a reader's idle cost. Polling for completion runs every
  25–200 ms in the page.

## Reproduce

```sh
pnpm install
pnpm build && pnpm check:bundle
node docs/perf/bundle.mjs                                           # results/bundle.json
pnpm --filter @uplift/book preview --host 127.0.0.1 --port 4190 --strictPort
# second terminal; keep the Chrome windows visible (do not minimise them) while it runs
node docs/perf/measure.mjs --backend=both --reps=5                  # results/raw/*.json
node docs/perf/network.mjs --reps=3                                 # results/network.json
node docs/perf/summarize.mjs                                        # results/summary.json + tables
pnpm exec prettier --write docs/perf/results/                       # the repository formats JSON
```

One WebGPU repetition takes about 3 minutes and one CPU repetition about 6.5; the ten took 41 minutes.
Diagnostics (not part of the tables): `trace-playback.mjs` (a Chrome trace and the events overlapping each long
frame), `playback-ab.mjs --mode=harness|runs|manip` (A/B playback runs), `profile-playback.mjs` (main-thread
JS profile of an unminified build; instructions in the file).

## Files

| File                                                            | What it is                                                                               |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `instrument.js`                                                 | Page-side observer: frames, long frames, inputs, state attributes, paint times           |
| `measure.mjs`                                                   | The journey, per path and repetition                                                     |
| `network.mjs`                                                   | Cold starts under emulated network conditions                                            |
| `bundle.mjs`                                                    | Raw, gzip and Brotli size of every production file                                       |
| `summarize.mjs`                                                 | Pooled statistics and the tables in this README                                          |
| `results/raw/*.json`                                            | One file per repetition: device, driver, Chrome, power, thermal, SHA, all data           |
| `results/summary.json`                                          | The pooled statistics                                                                    |
| `results/network.json`, `bundle.json`                           | Network and bundle results                                                               |
| `results/external-load.json`                                    | Known concurrent load during the runs, dropped like window interruptions                 |
| `trace-playback.mjs`, `playback-ab.mjs`, `profile-playback.mjs` | Diagnostics behind findings 4, 5 and 7                                                   |
| `results/playback-ab-*.json`, `profile-playback-webgpu.json`    | Their results                                                                            |
| `results/diagnostics/`                                          | The unreproduced trial repetition (finding 7) and the startup trace analysis (finding 5) |
