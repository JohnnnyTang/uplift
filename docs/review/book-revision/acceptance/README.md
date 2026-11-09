# Integrated book review packet · 5F

2026-11-09. Baseline `d01f631` includes 5E on `s1/w5/5bcd-lead`.
The owner's request authorizes 5F from this review stack and merging back into it;
this is an explicit continuation of the local-review exception, not a main merge.
[Acceptance ledger](../../../plan/stage-1-acceptance.md).

## Preview and evidence

From this checkout, run `pnpm install --frozen-lockfile`, then `pnpm --filter @uplift/book dev --host
127.0.0.1 --port 5185`. Open the printed local URL. `/` is the book;
`?view=research` is the labelled erosion/rain example. Backend overrides remain
`auto`, `webgpu`, `cpu-worker`, `cpu-64`, `flat`. See [5E routes and provenance](../migration.md).

Watch [the short actual-app journey](reader-journey.webm). It shows a flat drawing,
direct attached-ring lift, immediate explanation, a real page turn, source placement
on the solver surface, and preserved return. It is browser automation, not a learner
observation. The viewport PNGs cover both lessons, normal desktop sizes, tablet,
phone, 320 CSS px and a 683×384 effective viewport corresponding to a 1366×768
window at 200%. Device pixel ratio is not used as a substitute for browser zoom.
Actual browser UI zoom/listening remains a human 6B check.

`flat-desktop.png`, `raised-desktop.png`, `water-desktop.png` show direct gestures.
`contours-*` and `water-*` show the composed production pages, rather than the
isolated shell/scene fixtures in the earlier packets. Normal page-turn animation
is recorded; reduced-motion states are checked separately.

## Claim / source / evidence register

All shipped lesson science remains draft expert-review content.

| Lesson                   | Action and visible outcome                                                                          | Source and evidence                                                                                                                                                                                                           | Limits / review                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Lift a map               | Drag ring upward; same extracted contour rises on the heightfield. Keyboard range reaches same lift | [Sourced teacher note](../../../../uplift/spreads/cartography.contours/teacher.md); geometry/projection checks in `uplift/book/src/scenes`; flat/raised captures                                                              | Static geometry, exaggerated height disclosed; no hydraulic clock. Expert sign-off pending                                                  |
| Where will the water go? | Place/move spring; solver-derived wet marks and depth respond on prepared terrain                   | [Teacher note](../../../../uplift/spreads/hydrology.water-path/teacher.md); [prospective protocol and all outcomes](../../../science/validation/playable-book/README.md); source replacement/reset CPU/Worker/GPU comparisons | Only prepared surfaces supported; no universal watershed/outlet inference, erosion or calibrated field rates/years. Expert sign-off pending |
| Research rain comparison | Inspect labelled recorded rain arms; exact original gross-erosion samples                           | [Existing research evidence](../../../science/validation/rain-comparison/README.md); `e2e/comparison.spec.ts` all seeds/samples/axes                                                                                          | Recorded results separate from live terrain. Failed morphology remains failed, waterfall challenge remains pending and cannot stamp         |

If no live capability exists, the illustration says flat diagram/no live water;
explanation and navigation remain available. Graphics loss has the same honest
fallback. Contour lessons do not initialize a hydraulic solver. Hidden scenes settle
and retain actual instances; reading depth does not reset models. Research collection
is opt-in, bounded, local, schema v1 and confined to recorded rain.

## Verification record

Checks ran on Windows with installed headless Chrome 156.0.8078.80, against
baseline `d01f631` plus this session's patch. The standard app suite uses SwiftShader;
the native authored transport and GPU numerical suite use their existing WebGPU
launch configuration. These are correctness checks, not controlled hardware measurements.

- `pnpm check`: 58 files / 503 unit tests pass; typecheck, lint and format pass.
- `pnpm build`: passes; existing large-chunk advisory remains.
- `pnpm --filter @hachure/terrain test:gpu`: 3 files / 68 tests pass.
- `pnpm check:bundle`: 2,466,888 / 10,000,000 bytes, all files uncompressed.
- New integrated acceptance suite: 8 tests pass after the responsive fix.
- Complete browser suite: **52 passed**, zero skipped, in the final sequential run (4.6 minutes), including native WebGPU authored transport.
- Runnable production preview: `http://127.0.0.1:5185/` returned HTTP 200.

Reproduce in PowerShell on this host (installed Chrome; standard CI retains Chromium):

```powershell
$env:UPLIFT_E2E_CHANNEL = 'chrome'
$env:UPLIFT_E2E_PORT = '5183'
$env:UPLIFT_FIXTURE_PORT = '5184'
$env:READER_FIXTURE_ORIGIN = 'http://127.0.0.1:5184'
$env:PLAYABLE_FIXTURE_URL = 'http://127.0.0.1:5184'
$env:BOOK_SHELL_FIXTURE_ORIGIN = 'http://127.0.0.1:5184'
pnpm check
pnpm build
pnpm test:e2e
pnpm --filter @hachure/terrain test:gpu
pnpm check:bundle
```

Run Playwright suites sequentially: they share output directories and server ports.
The first baseline run had a trace-file ENOENT caused by an overlapping capture run;
it is retained as a harness failure, not reclassified as a product failure or pass.
Software-rendered headless screenshots and GPU correctness tests do not establish
classroom frame rates, startup performance, power/thermal behavior or projector contrast.

## Human listening protocol · pending, owner 6B

Record commit, OS, browser/version, screen reader/version, viewport, zoom, motion
setting, input device, observer and date. Do not reuse the archived prediction-gated
W4 procedure as an acceptance script.

1. Enter `/` fresh. Listen to title, invitation, model scope and controls. Play using
   only keyboard without choosing a question. Record focus order and announcements.
2. On a fresh water entry reveal the explanation without running the process or
   answering. Confirm it is understandable, labelled and reachable without a gate.
3. Turn using keyboard, move the spring, listen to the bound visible-change description.
   Turn back, then return. Confirm focus is restored and model/selection preserved.
4. Change reading depth, inspect sources/limitations and return. Confirm no model reset
   and no duplicated/hidden controls in the accessibility tree.
5. Reset explicitly. Confirm source/lift and answer state restore as described and
   focus stays usable. Repeat with reduced motion, phone and actual 200% browser zoom;
   at 320 CSS px check reflow and scroll without trapped content.
6. Record exact spoken output, confusing repetitions/omissions, failures and fixes.
   A structural or axe pass cannot substitute for this listening result.

## First-time reader and owner review · pending, owner 6C

Use the actual default preview and supplied reference intent. Do not coach the gesture.
Ask the participant to find something to touch, describe what changed, explain the one
small idea and decide whether to continue. Record actual actions, assistance, words,
interpretations and navigation, including failures. Obtain appropriate study consent
before collecting observations. Do not infer learning gains from completion or export.
Owner records a decision on bounded book composition, dominant illustration, readable
cause/effect and page-to-page rhythm. No owner/human result has been supplied here.

## Drift audit and handover

**Done:** integrated acceptance coverage, production-route recording/captures, regression
and numerical verification, review protocols and current-plan status reconciliation.
**Not done:** owner/product decision, first-time reader observations, human listening,
actual zoom/classroom/projector review, expert sign-off and target-hardware measurement.
**Surprises:** dependencies are integrated locally while main remains at 5A; competing
browser runs can erase trace files; host port reservations require known working ports.
**Plan-changing findings:** retain the real spring gesture and shared settlement path;
no new solver is needed to teach the selected prepared-surface claim. Pixel correctness
and successful source intervention cannot establish discoverability or comprehension.

| Next owner   | Concrete action / outcome / evidence / reuse                                                                                                                                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6A           | Measure actual lift, spring response and turns on visible target hardware; report startup/frame/response traces with commit/device; tune only demonstrated bottlenecks in existing Ink/host/shell                                                                                      |
| 6B           | Perform the protocol above, true zoom, colour/projector readability and fallback audit; fix observed access failures in existing controls, captions and page navigation                                                                                                                |
| 6C           | Obtain owner and expert decisions on these two actual lessons and observe readers; use sources/prospective results above, no invented feedback                                                                                                                                         |
| 6D / Stage 2 | Select one next action only after observations; state its visible consequence, supporting evidence and which contour/picking/source/settlement primitive is reused or missing. No automatic deltas/engine/catalogue scope                                                              |
| Stage 3      | Select one intervention or place: e.g. place a dam and observe a supported sediment contrast, or select a source on a sourced DEM and observe routing. Validate the chosen claim first; loading data alone is no lesson. Reuse existing source/host/render primitives where applicable |
| Stage 4      | Pilot these reviewed actions and page turns; record actual discovery, explanation and access problems. Reuse existing book; broader analytics requires an explicit new consent/privacy/schema design                                                                                   |

The only implementation change is the bounded app layout correction: at phone/reflow widths, scene content sets its height so legends and controls cannot overlap scope/footer. The acceptance suite compares their bounding boxes. No solver or renderer changed. Historical feasibility,
science failures and W4 listening records remain intact; fresh captures live here.

## Local merge review checklist

- [x] Owned paths respected; app CSS exception and append-only decision are explained.
- [x] `pnpm check` passes.
- [x] Process simulation preserved; no scripted landform or water route.
- [x] Model quantities remain bound; no new scientific prose in lesson pages.
- [x] No solver change; existing 68 CPU/GPU browser comparisons pass.
- [x] Existing scientific sources and expert-review markers preserved.
- [x] Decisions/open questions and done/not-done handover recorded above.
- [ ] Human/product/expert/hardware release decisions: pending with named owners.

This packet serves as the local merge handover requested by the owner. Remote PR
creation, publication and main integration are not asserted by this session.
