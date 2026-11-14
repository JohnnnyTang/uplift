# 5N · Acceptance ledger: _From V to U_ on the default book

**Run:** 2026-11-14, commit `b82dae5` (s1/w5/integration after 5M2) plus this session's fixes, on Windows 11
Home 10.0.26300, Intel Core Ultra 7 258V, Intel Arc 140V GPU (driver 32.0.101.8860). Browser evidence: the
Playwright suite in its bundled Chromium (no WebGPU adapter, so the app runs the **labelled CPU worker**)
and installed Chrome 157 with **WebGPU** for the captures and the GPU protocol run. Decision record:
DECISIONS.md, D-W5-5N.

Statuses: **pass** (automated evidence on the default app), **fail → fixed** (found here, fixed here, evidence
now passes), **partial** (some registered parts fail; the failures are recorded and not taught),
**at risk** (mechanics pass; a reviewer finding needs an owner decision), **pending-human**,
**pending-hardware**. An automated pass never closes a human, expert or hardware check.

## Ledger

| Row | Required result (abridged)                                                                                                                      | Status                                                                           | Evidence                                                                                                                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PB1 | Recognisable book; spread fits 1366×768 and 1440×900; illustration primary; no shrunk text                                                      | **at risk** (mechanics pass) · pending-human (owner)                             | `glacial-acceptance.spec.ts` › "PB1 … fit 1366×768 / 1440×900" (no page scroll; Play, flap, bar on screen; `view-metrics`); finding [O1](owner-scene-review.md); captures 02, 14                                                                 |
| PB2 | Phone single page; 200 % zoom / 320 px reflow readable                                                                                          | pass · pending-human (legibility, real zoom)                                     | "PB2 GV6: phone …"; `book-acceptance.spec.ts` (390, 320, 683×384); captures 15–17 (`reflow320: true`)                                                                                                                                            |
| PB3 | Drawing → artistic transition → complete 3D scene; keyboard and reduced motion equivalent                                                       | pass · pending-human (spatial reading)                                           | "PB3 GV4: drawing → ink → colour …", "PB3 GV6: reduced motion …"; capture 01; 5H video `docs/review/glacial/stage/open-transition-run-front-face.webm`                                                                                           |
| PB4 | Immediate play, no answer/setup/logging gate                                                                                                    | pass · pending-human (first-time reader finds Play, [O3](owner-scene-review.md)) | journey: Play enabled at model time 0, invite shown, no prediction chosen                                                                                                                                                                        |
| PB5 | One claim, one gesture; gauges from scene state; checks match render                                                                            | pass · pending (expert sign-off)                                                 | journey reads R4 off the live notes at i = 74, 100 y (shale 30 m vs granite 10 m); [protocol rerun](../../../science/validation/glacial-valley/README.md); [expert packet](expert-review.md)                                                     |
| PB6 | Question skippable; answer immediate; nothing gates                                                                                             | pass                                                                             | "PB6: the question can be skipped …"                                                                                                                                                                                                             |
| PB7 | Two spreads, real page turn, keyboard, preserved state, focus                                                                                   | pass · pending-human (listening, gestures)                                       | journey: bar turn and PageUp back with run, kept run, time unchanged; phone turn; `book-shell`, `book-acceptance` specs                                                                                                                          |
| PB8 | Owner review, first-time readers, listening, science, hardware explicit                                                                         | **pending-human**                                                                | [owner packet](owner-scene-review.md), [expert packet](expert-review.md) prepared; no participants, owner approval or expert sign-off recorded                                                                                                   |
| PB9 | Rock choice → separate runs; watch, pause/step, scrub, compare at matched time; view-only level/cut/ice/camera; values identify run/time/config | pass                                                                             | journey (whole test)                                                                                                                                                                                                                             |
| GV1 | Rock by page selector or specimen drop starts a new run reflecting that rock                                                                    | pass                                                                             | journey: shale by keyboard radio, granite by pointer drop; new run id, model time 0, shale kept; R4 ordering on the page                                                                                                                         |
| GV2 | Play/pause/step, scrub past, return to live, compare kept runs at matched time                                                                  | pass                                                                             | journey: Space play/pause, Step at university level, scrub to 20 y "Earlier moment", back to live, compare note "… shale, at 100 model years", lens ghost                                                                                        |
| GV3 | U-trough from ice flow and erosion; rock differences confirmed by the registered protocol                                                       | **partial**                                                                      | [protocol rerun](../../../science/validation/glacial-valley/README.md): 18/18 arms bitwise = record, 39/39 verdicts identical; taught claims pass (R1, R4, S1, E-R1, E-R3, K1, K2, N1); T1 fails 8/9, R2, R3, E-T1, E-R2, E-R4 fail (not taught) |
| GV4 | Drawing → ink → colour into a naturally coloured diorama on a tilted book page                                                                  | pass · pending-human (owner scene review)                                        | "PB3 GV4 …" (block projected over the figure page, replayable, model time untouched); captures 01–11                                                                                                                                             |
| GV5 | Notes, caption, face, ghost, explanation: same run, time, config                                                                                | pass · **fail → fixed** (deeper-level grid line)                                 | journey `expectOneRunOneTime` at every step; compare note and ghost at the viewed time; same-rock replay gives identical notes; deeper panel bound grid line fixed (below)                                                                       |
| GV6 | Keyboard for every gesture, text alternatives, reduced motion, lithology patterns, reflow                                                       | pass · pending-human (screen-reader listening, colour-vision check)              | journey is keyboard-first (radios, Space, sliders, PageUp); reduced-motion test (no running animations, a pattern on every specimen); `glacial-book.spec.ts` axe audit; phone                                                                    |
| GV7 | Default book, water spread, research route, privacy retained                                                                                    | pass                                                                             | "GV7 PB7 …": research route opens, no non-local requests, no observation keys stored; `instrumentation`, `science`, `university`, `smoke` specs in the full suite                                                                                |
| GV8 | Sources, failed attempts, human/expert/hardware status, owner references explicit                                                               | pass                                                                             | this ledger; every arm incl. attempts in `cpu/runs/`; [expert packet](expert-review.md); `docs/references/owner-2026-11-09/` unchanged                                                                                                           |
| GV9 | CPU and GPU agree within registered tolerances for every shipped rock, or the gap is recorded                                                   | pass (one adapter) · **pending-hardware** (other devices)                        | `gpu/results-local.json`: G1–G7 pass, 39/39 verdicts identical, worst bed 8.3 mm; app picks WebGPU on this device (capture 13 "Solver: webgpu")                                                                                                  |

## Defects found and fixed here

1. **Deeper level printed "Grid 160 cells by 64 cells cells of 40 m"** (GV5/content). The `gridRows` probe
   already carries its unit; the template added "cells" again. `uplift/spreads/geomorph.u-valley/deeper.uni.md`
   now reads "Grid {{probe.gridColumns}} by {{probe.gridRows}}, each {{probe.metresPerCell}} across." The journey
   asserts the bound line.
2. **Every load of the default route logged a console error** (favicon 404). `uplift/book/index.html` now
   carries an inline SVG icon (an open book in the cloth colour on paper). The acceptance spec fails on any
   console error.
3. **5I's GPU suite could only write over the 5I evidence.** `GLACIER_GPU_OUT` (test harness only,
   `hachure/glacier/test/browser/`) lets an acceptance rerun keep its own record; the default is unchanged.
   No solver code changed, so no comparison test changed.

## Not defects (checked)

- The text alternative is announced when play starts and stops, not every frame; while playing it
  describes the moment play started. This is the 5K design (polite live region), not stale state.
- During a pause the button reads Play for one settling batch before the final frame lands; every
  instant still shows one consistent time (the spec reads time, note and label in one frame).
- The time label (two decimals) and the time note (four significant figures) round the same bound value
  differently mid-run, e.g. "100.25" and "100.3". Both are bound.

## Pending — never inferred from this evidence

- **Owner scene review** (GV4, PB1 O1, O2): [packet](owner-scene-review.md).
- **Expert sign-off** (PB5, GV3, GV8): [packet](expert-review.md), eight questions.
- **First-time readers** (PB4/PB8, O3: does a new reader find Play?), **human listening** with a screen
  reader (GV6, PB7), colour-vision and projector checks.
- **Hardware**: other GPUs, mobile, Safari, Firefox; classroom-machine speed. WebGPU parity is shown on one
  adapter only.

## Files

| Path                                       | What                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `e2e/glacial-acceptance.spec.ts`           | The acceptance walk (8 tests), named by row                                |
| `capture.mjs`, `results.json`, `captures/` | Owner-packet captures from the production build (installed Chrome, WebGPU) |
| `owner-scene-review.md`                    | Owner scene-review packet and findings O1–O3                               |
| `expert-review.md`                         | Expert-review packet                                                       |
| `docs/science/validation/glacial-valley/`  | Registered protocol rerun (CPU, GPU), every arm and verdict                |

## Verification

See the PR for the command results (`pnpm check`, `pnpm build`, bundle budget, the full browser suite).
