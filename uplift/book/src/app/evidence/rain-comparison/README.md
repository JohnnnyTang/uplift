# Recorded rain comparison: browser evidence

Chrome 156, local Windows development machine, headless. Six endpoint screenshots
cover seeds 1, 17 and 101 at 1366×900 and 390×844. Each was inspected for readable
labels, a shared zero/scale and a clear bar-length difference. Full-spread and
normal-speed video evidence show the matching prediction and explanation.

`results.json` records the exact values, measured CSS widths and checks:
prediction gating; keyboard commit and End-key scrubbing; correct/incorrect
choice feedback; all seeds; no horizontal overflow; paused level changes preserve
both the live state hash and recorded values; reset restores the gate; reduced
motion starts paused; replay and pause work; no geological years or pending stamp.

This is a recorded controlled experiment, not a live two-solver comparison.
Free exploration remains a separate live CPU run. The render uses measured
counter samples and never fabricates or interpolates terrain. Performance here
describes playback, not full-solver target-hardware performance. Human
screen-reader listening, classroom review and expert scientific approval are
still required at Stage 1 release.

Run `node uplift/book/src/app/comparison-smoke.mjs` against the development server.
The earlier integration smoke was also rerun for lift, keyboard/pointer tools,
reset and reduced motion; its updated evidence remains one directory above.
