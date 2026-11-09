# 5A actual-renderer feasibility

**Selection: `cartography.contours` → `hydrology.water-path`.**
The bounded cartography-slope alternative is not selected. This is an exploratory
implementation finding, not scientific acceptance, human listening, a performance
benchmark, or completion of Wave 5.

## Run and replay

From the repository root:

```sh
pnpm exec vite --config spikes/playable-book/vite.config.ts
pnpm exec tsc -p spikes/playable-book/tsconfig.json
node spikes/playable-book/capture.mjs
```

Open the Vite URL (normally http://127.0.0.1:5188). The entry is development-only;
the production app and its default route are unchanged. Chrome must be installed
for capture. No workspace package or lockfile change is needed. Aliases in the
local Vite/TypeScript configs point to the existing public source entry points.

[Recording](interaction-1366.webm) shows direct contour-ring dragging, then actual
terrain picking and fixed-step water advances. [Results](results.json) contains
the full resolved solver config, source locations, all captured numeric outcomes,
wall durations and stability diagnostics. The headless renderer is forced WebGL2;
this does not establish WebGPU compatibility or target-hardware performance.

## Inspected visual evidence

The exploratory composition is a bounded 1080 × 620 CSS-pixel spread, containing a
480 × 420 illustration, at the PB1 viewport of 1366 × 768. A second contour
capture uses 1440 × 900. This proves that the illustrations can occupy the proposed
book allocation; the spike is not the production shell or final editorial design.

- [Flat contour](contour-flat-1366.png) → [lifted contour](contour-lifted-1366.png):
  the dashed selected isoline and attached ring remain identifiable while the
  underlying actual heightfield/contours lift. The fixed camera makes the rise
  legible but modest; 5D should improve framing/hatching with this same geometry,
  then inspect it again. There is no simulation clock for this static scene.
- [Water at step 500](water-500-1366.png): the wet patch already extends south
  from the left source. [At step 2000](water-left-2000-1366.png), a longer wet
  route is visible, supported by 65 cells at/above the display threshold.
- [Moved source, step 4000](water-moved-4000-1366.png): actual picking places the
  spring in the right trough. A distinct right route appears while the old left
  water persists and drains. The ring alone moves immediately; the wet response
  comes only from the solver. This distinction must remain clear in the lesson.
- [Keyboard/reduced-motion lift](keyboard-reduced-motion-1366.png) and
  [keyboard source](water-keyboard-reduced-motion-1366.png) use native slider keys,
  arrow-key source movement and Enter on the advance button. The slider changes
  immediately, with no automatic lift animation. The trial never auto-advances
  in either motion preference; a fixed-step advance is explicit.
- [1440 × 900](contour-lifted-1440.png): illustration and caption fit at the same
  allocation. Phone/reflow and final page turning remain 5C/5F work.

I inspected these PNGs at their saved viewport size. The first water ramp
(full colour at 0.08 m with default maximum opacity) was visible but too pale.
Its complete screenshots, results and recording remain in
[initial-pale-ramp](initial-pale-ramp/). The second exploratory pass changed only
presentation: full colour at 0.025 m, maximum opacity 0.7, plus an ink dot at
each actual sample whose water depth meets the 0.002 m display threshold.
The caption and live legend explain these encodings. Dots are projected from
sample positions and terrain heights, not animated along an authored route.
The initial caption incorrectly referred to dotted texture even though its water shader
was solid; the final caption accurately names the added snapshot-derived dots.
Both passes retain identical solver/source outcomes; no failed outcome was hidden.

The second run's eight 250-step click batches took 30–63 ms each including
Playwright/UI overhead. This supports a prompt response in this local trial;
it is not device benchmarking. All recorded runs have zero wave-guard violation
steps under the default halt policy. Numerical correctness, paired comparisons,
additional initial states and acceptance at classroom playback speed remain 5D/5F.

## Fixed lesson briefs for dependent sessions

| Lesson     | Intended claim                                                                          | Action                                                                              | Visible cue                                                                                    | Truthfulness risk                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contours   | The selected equal-height line in the map is the same line on the raised surface.       | Constrained lift handle; native slider keyboard equivalent.                         | Same dashed contour and attached ring, projected from the real isoline vertices at every lift. | View exaggeration is not terrain change; bind its scale and line elevation. An authored test hill is not a simulated landform.                                     |
| Water path | Changing source position changes which part of this prepared fixed surface becomes wet. | Place/move one stable-id spring by picking or keyboard; advance actual fixed steps. | Real water-depth colour and actual wet-sample dots, with a state-derived text alternative.     | Previous water persists. Wet extent is not velocity, an individual parcel, a guaranteed outlet, erosion, or a general watershed law. No invented geological years. |

<!-- expert-review -->

These are proposed teaching claims, not approved final scientific copy. For
contours, the exact geometric implementation is documented in
[the marching-triangle extractor](../../../../hachure/ink/src/contours.ts) and
[shared projection](../../../../hachure/ink/src/projection.ts); 5D must add its
external cartographic source and mathematical checks. For water, use
[the actual model and boundary description](../../../science/model.md) and its
[inspected source record](../../../science/sources.md), preserving their review
status. This trial uses the public CPU solver, source tools and Ink view without
changing kernels. The twin-channel bed is authored initial test geometry.
Erosion, sediment transport, thermal change, rainfall and evaporation are disabled.
The one authored outlet lies at the left downstream edge; therefore the trial
does not support a symmetric two-outlet destination claim.

## Shared primitives still required

1. **5B/5D: authored model initialization.** Existing transport initialization
   accepts config/calibration and is valley-specific; backend config assumes the
   existing 1280 m domain. It cannot simply host this 64 m trial. Add a small,
   explicit preset/config initialization path shared by worker/GPU hosts, with
   source-aware observations, rather than duplicating a solver in production.
2. **5D Ink: selected-contour projection and constrained handle.** The spike's
   dashed SVG path projects actual `ContourLine.pointsM` using the public
   `projectToViewport`; extract this and drag arbitration into a reusable
   primitive. Camera/lift/resize must keep selection aligned; no independent
   renderer or manual contour animation belongs in spread data.
3. **5D Ink/runtime: source marker and truthful wet-region cue.** Public
   `pickHeightfield`, `rayFromViewport`, source tools and snapshots suffice,
   but reusable marker/keyboard positioning and snapshot-derived non-colour
   marks/text are missing. The tiny wet-dot overlay is a proof of encoding,
   not a second hydraulic solver or a precomputed route.
4. **5B: settle, retained state and reset.** This local synchronous CPU trial
   does not prove worker/GPU races. Source replacement uses the same id;
   reset restores the authored source. Real book departure must drain pending
   mutations and preserve solver instances. A visible snapshot is not a precise
   checkpoint. Keep presentation changes independent of model state.
5. **5D/5F: fallback and validation.** Production context loss needs a labelled
   static contour alternative, honest inability to run the process, and final
   keyboard/focus/large-text review. No static fallback may claim a live run.

## Verification and remaining work

Standalone TypeScript, ESLint and Prettier checks pass for the spike. Capture
reports no page errors. The parent session runs repository `pnpm check`.
No solver behavior changed, so no CPU/GPU comparison test was changed.

The trial separates source placement and explicit step advances. This establishes
model/render feasibility, not the finished one-gesture reader interaction. 5D must
connect source placement to a bounded live response, with an immediate settled
snapshot equivalent for reduced motion. Do not ship an obligatory second gesture
as the default water consequence. That bounded adapter uses existing solver steps;
it must obey 5B mutation ordering and departure quiescence.

5D must register the actual paired source intervention, complete geometry and
process checks, write cited expert-review draft copy, and verify both backends.
5B must supply retained/quiescent hosts; 5C the production book; 5E integration;
5F actual acceptance. Human discoverability, learning, projector contrast,
expert sign-off and physical hardware remain pending.
