# S1 · W5 · 5E — Default book and research migration

## What changed

The default app opens **Lift a map**, then **Where will the water go?**, using
5C's retained reader shell, 5D's actual Ink scenes and 5B's authored host. Questions
and explanations are optional. Contour actions change presentation; spring actions
use the real process model. The public spread registry now separates these two
lessons from the retained valley research example.

The header's **Research example** opens `?view=research`. Its recorded rain chart,
parameters/tools, budgets/profile, pending challenge, teacher notes and anonymous
local export remain available. **Lift the drawing** is independent of prediction;
the explanation and recorded replay are immediately available, including after reset.
Only feedback about the reader's prediction requires a committed answer and the
recorded endpoint. Recorded gross erosion is never attributed to the live terrain.

## Routes and retained state

- `/`: contour lesson, with a real page turn to the prepared water lesson.
- `?spread=hydrology.water-path&page=illustration`: direct water illustration;
  on phones, `page=text` and `page=illustration` are separate readable pages.
- `?view=research`: retained rain/erosion research. The return control restores the
  book's page, selection, question, explanation and model rather than recreating it.
- `backend=auto|webgpu|cpu-worker|cpu-64|flat` remains supported. The water lesson
  uses its authored grid through the shared host; it does not start the valley
  simulation. Contours need no hydraulic solver. A forced flat/unavailable renderer
  shows a labelled diagram with no fabricated live water. Graphics loss also falls
  back to the readable diagram.
- `?view=research&debug`: the original measured backend/grid/seed/timing overlay.
  `?debug` on the ordinary book does not add research diagnostics to its pages.

Route switches settle the departing host/scene before detaching its DOM. Hidden
research playback and its frame scheduler stop; hidden lesson responses stop at a
settled batch and resume their remaining bounded response on return. Explicit
reset is the only action that restores the model. Browser history retains routes.
Inactive route controls are detached and cannot receive focus or duplicate labels.

The instrumentation schema remains v1, exclusively the existing recorded-rain
research scope, opt-in and off on first mount. The default book creates no collector.
Revealing research without answering does not manufacture a prediction event.
A retained research log observes no actions on the other lessons.

## Compatibility and bounded changes outside owned paths

Removed the temporary `SpreadLifecycle` implementation, its public export and six
obsolete gate tests after migrating its last caller to `ReaderLifecycle`. The shared
host README now records its removal; existing reader lifecycle tests remain.
Removed the water driver's temporary 5B casts/runtime feature detection now that the
merged host supplies the typed API. These are bounded compatibility cleanup in
`hachure/runtime/src/core/**`, `hachure/runtime/src/sim-host/README.md` and
`uplift/book/src/scenes/water-driver.ts`, required by the 5E migration brief.

`playwright.config.ts` has optional port/channel overrides because this machine
reserves TCP 4102–4201 and lacks the pinned Chromium download. Default CI settings
are preserved. The legacy fake widget shell/adapter remains only as a labelled
historical widget fixture with unit checks; neither production route imports it.
Archived scientific records and screenshots are not rewritten by this session.

## Verification

Verified on 2026-11-09 using installed headless Chrome:

- `pnpm check`: 58 files / 503 tests pass. Six obsolete prediction-gate tests
  were removed with their unused adapter; numerical/reader tests remain.
- `pnpm build`: passes, with the existing large-chunk advisory.
- Full browser suite: 44 pass.
- After the final scoped desktop CSS adjustment, all eight app smoke/journey
  tests pass again, including the 1366 × 768 no-overflow assertion and phone flow.
- Bundle budget: 2,466,800 / 10,000,000 bytes, all files uncompressed.

The actual screenshot exposed vertical overflow when combining the real scene
with the shell. An app-owned desktop rule sizes the illustration to available
height and reduces outer bottom spacing, preserving text size and natural mobile
reflow. This is composition of existing primitives, not new scientific rendering.

Reproduce browser checks on this machine in PowerShell:

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
pnpm check:bundle
```

Coverage retains all original exact recorded samples/seeds/axes, state hashes,
no false years/stamps, backend fallbacks, opt-out/opt-in privacy and university
hidden-default restoration. Actual default-app tests cover unanswered play/reveal,
page and research return, source replacement, explicit reset, reading levels,
phone reflow/in-flight departure and graphics-loss navigation. Shared tests cover
settlement/disposal races and authored CPU/Worker/GPU agreement.

## Review checklist

- [x] Owned paths respected, with bounded compatibility/config changes explained above.
- [x] Process-based simulation; no scripted landform or water route.
- [x] Computed quantities remain bound to scene/host state.
- [x] Neither solver changed; CPU/GPU comparison coverage retained.
- [x] Scientific content retains expert-review markers and cited sources.
- [x] Decisions recorded in the append-only decision log.
- [x] `pnpm check`, build, full browser suite and bundle budget pass (results above).

## Handover

**Done:** default-app integration, independent research play/reveal, retained route
state, regression migration and obsolete gate-adapter removal.
**Not done:** 5F product acceptance, expert sign-off, human screen-reader listening,
discoverability, classroom/projector review and target-hardware performance. Earlier
failed morphology/waterfall research remains failed/pending; no stamp is enabled.
**Surprises:** the local review stack has 5B–5D while main remains at 5A; Windows
reserves the historical test ports, and installed Chrome is available instead of
the pinned Chromium build.
**Plan-changing facts:** this owner's explicit request authorizes integration into
`s1/w5/5bcd-lead`, so 5E starts from that combined review stack and merges back there.
This is a local review integration, not a claim that main has the dependencies or
that Wave 5's product/human acceptance is complete. 5F should review the actual
new default and preserve the research route/evidence.
