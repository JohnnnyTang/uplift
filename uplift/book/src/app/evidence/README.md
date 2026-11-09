# Real CPU book flow

Run from the repository root:

```sh
pnpm --filter @uplift/book dev --host 127.0.0.1 --port 5183
node uplift/book/src/app/smoke.mjs
```

`results.json` records the browser version, assertions and measured host timings. `flat.png` and
`raised-uni.png` show the same real preset before and after the lift. `predict-lift-run-flap.webm` is the
short browser recording. These are implementation checks on the development machine, not scientific
validation or a classroom performance sign-off.

The smoke run checks a real CPU model at the fallback grid size: prediction gating, SVG-first drawing,
3D lift, play/pause, explanation, level-toggle hash preservation, reset, explicit uncalibrated time,
the supported comparison's endpoint-gated explanation and no pending challenge stamp. Reduced motion uses a crossfade and stays paused
until Play. The final integration also exercises the real Worker brush path by keyboard and picking.

Timings are separate: Worker step-batch computation, snapshot/probe calculation, Worker round trip less
processing (transfer plus event scheduling), and `InkView.setState` extraction. Publishing is bounded;
camera/lift animation does not trigger full-state readbacks. Headless Chrome and a short early run are
not target-classroom-hardware evidence for AC1. Human screen-reader listening remains a Wave 4 check.

The lesson remains a research draft. Its revised gross-erosion question is backed
by the [recorded comparison](rain-comparison/README.md), while the historical
deeper/wider question remains inconclusive. Geological years and persistent
slope-break stamps stay unavailable. This browser pass does not override those
results or substitute for expert review.

This evidence was refreshed for the Wave 3 comparison integration. The current
results file contains one short sample and must not be treated as steady-state
throughput. Earlier 3A results and recording are preserved in git history; the
original timing summary remains in the Wave 3 handover.
