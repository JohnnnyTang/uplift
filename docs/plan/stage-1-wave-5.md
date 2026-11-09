# Stage 1 · Wave 5: make Uplift a playable book

Planned 2026-11-09 at the owner's request, after product-direction commit
`46fefe6` was merged into local and remote `main`.
**Status: planned; implementation sessions have not started.**
This wave replaces the coarse P1/P2 sequence. Original hardening sessions 5A–5D
are now **6A–6D**, not completed or cancelled.

Read [the product story](../product-story.md), [handoff principles](../handoff.md#pedagogical-design-principles),
[science policy](../science/education-policy.md) and
[PB1–PB8](product-realignment.md#product-acceptance-gate).
The owner requested planning here, not execution of the implementation wave.

## Outcome

The default app opens an inviting, bounded book with two small playable discoveries.
Ink drawings lift into real 3D. A reader can manipulate the illustration, see its
consequence, optionally reveal a short explanation and turn to the next spread.
The existing erosion work is revised and retained as an explicitly labelled research
example. Hachure's numerical integrity and historical evidence are preserved.

This wave is successful only when the **existing runtime and app are migrated** and
the new example uses shared public capabilities. A polished standalone demo beside
an unchanged default app does not close it.

**In scope:** lifecycle/schema revision; book composition and page turns; reusable
scene interaction; a new two-spread example; migration of legacy mounting, widgets,
tests and research disclosures; accessibility and regression evidence; unfinished
roadmap cleanup.

**Out of scope:** new physics families, solver rewrites, a general-purpose editor,
accounts/catalogue, real DEM ingestion, new analytics, mandatory scoring/stamps,
and calibrating field rates or geological years that the new lessons do not claim.
A necessary numerical bug fix gets a separate bounded decision, relevant CPU/GPU
comparison and revalidation; it is never hidden inside a visual redesign.

## What the code audit found

| Existing implementation                                                                              | Required disposition                                                                                                           | Owner                          |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `runtime/src/core/lifecycle.ts`: prediction drives flat → lifting; explanation follows interaction   | Separate readiness/lift, optional prediction and reveal state; no pedagogical lock                                             | 5A contract, 5B implementation |
| `runtime/src/schema/spread.ts`: prediction and challenge are mandatory                               | Represent an absent question/challenge without dummy content; retain binding validation and explicit model scope               | 5A / 5B                        |
| `runtime/src/widgets/learning.ts`: commit-to-unlock text and disabled flap                           | Optional unanswered state, immediate reveal, calm copy and evidence-aware feedback                                             | 5B                             |
| `runtime/src/sim-host/host.ts`: pause does not await an in-flight batch                              | Define and implement quiescence before page departure; retain actual solver state, not a lossy visible-snapshot reconstruction | 5A / 5B                        |
| `ink/src/view/ink-view.ts`: real contours, view exaggeration, camera and snapshot APIs already exist | Reuse them for direct lift/selection, legible page framing and a same-state diagram                                            | 5D                             |
| `terrain/src/contract/tools.ts`: spring/rain sources and remove-source already exist                 | Use existing typed source tools; test source replacement/reset across real backends                                            | 5A feasibility / 5B / 5D       |
| `uplift/book/src/main.ts`: mounts only the valley lesson                                             | Default to the new book sequence; keep a deliberate research entry                                                             | 5E                             |
| `uplift/book/src/app/book.ts`: combines model host, learning, render, diagnostics and chart          | Extract reusable mounting; make the live scene primary and recorded comparison a labelled research disclosure                  | 5E                             |
| `book.css` and `app/lesson.css`: content-height columns and small fixed terrain area                 | Bounded readable spread, dominant illustration, phone pages and zoom reflow                                                    | 5C / 5E                        |
| University/tools/challenge/instrumentation panels                                                    | Keep capabilities; disclose depth, hide pending challenges from normal reading, keep instrumentation research-only and opt-in  | 5B / 5E                        |
| Existing e2e tests assume one route and mandatory gates                                              | Migrate assertions to the new contract; keep backend, state, science and privacy checks                                        | 5E / 5F                        |

Paths prefixed with `runtime/`, `ink/` or `terrain/` above are under `hachure/`.
This is source inspection, not a fresh usability or scientific validation result.

## New example: two discoveries in one small book

The first choice is the following sequence. 5A establishes feasibility with the actual
renderer/model; 5D supplies final sourced copy and scientific checks.

| Spread                                            | One idea                                                             | Primary gesture                                                            | Visible consequence                                                                                               | Optional reflection                                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Lift a map · `cartography.contours`               | Relate a contour in a flat drawing to that same contour on a surface | Drag a lift handle attached to the illustration; keyboard equivalent       | The actual contour geometry rises with the same heightfield; one selected line connects both views                | A small question about the selected contour, answer available immediately                                                   |
| Where will the water go? · `hydrology.water-path` | Relate source location to water routing on this prepared landscape   | Place or move a source marker directly on the terrain; keyboard equivalent | Water from the real solver becomes visible along its route; a small state-derived cue may clarify the destination | A question about the observed destination, without claiming erosion, field rates or a general law unsupported by this model |

These are editorial briefs, not approved scientific assertions or ready-to-publish copy.
5D must choose the precise claim, source it, mark it `<!-- expert-review -->`, and
validate it. No typed simulated measurements or scripted water trails.
The contour lift is a presentation transform, never a change to the terrain model.

**Bounded alternative:** if 5A cannot make the live water interaction readable with
existing mechanisms and a small adapter, record that result and substitute a distinct
second cartography spread about contour spacing and slope, using the same geometry.
It needs its own gesture, claim, evidence and sources. Do not split one contour lesson
into two empty pages, ship an inert second page, or broaden into a solver project.
The new example still requires two interactive spreads. The choice is fixed at the
5A exit and recorded in the decision log before dependent work starts.

## Scheduling, dependencies and merge order

This is one revision wave delivered in **gated groups**, an explicit narrow exception
to the framework's usual earlier-wave-contract rule. Sessions only consume contracts
already merged into `main); no session depends on another session's unmerged branch.

1. **5A alone:** inspect, prove feasibility and merge backward-compatible contracts.
2. **5B, 5C and 5D may run concurrently** from that main. Their implementation paths
   are disjoint. Merge in the deterministic order **5B → 5C → 5D**; rebase/check each.
3. **5E alone:** start from all three merged results and migrate the actual app.
4. **5F alone:** validate the integrated reader journey, repair bounded integration
   gaps, assemble review evidence and reconcile remaining plans.

**Total merge order:** 5A → 5B → 5C → 5D → 5E → 5F.
Suggested branches: `s1/w5/5a-contracts`, `5b-runtime`, `5c-book-shell`,
`5d-playable-example`, `5e-migration`, `5f-acceptance`, each with its own sibling
worktree and the full `s1/w5/` prefix.

The lead owns shared barrel exports, package/lockfile glue, the wave tracker and
cross-session test harness changes. Coordinate those minimal changes at integration;
do not give every parallel session ownership of `book.ts`, `main.ts` or all tests.
Do not remove/rewrite old science evidence or weaken tests to make a migration pass.

<a id="5a"></a>

## 5A · Feasibility, reader contracts and design constraints — RT/INK · M

**Depends on:** direction merged to main. **Launch:** first, alone.

**Owned paths:** `docs/review/book-revision/contracts.md`,
`docs/review/book-revision/feasibility/**`, `spikes/playable-book/**`,
`hachure/runtime/src/schema/**`, new `hachure/runtime/src/reader/contracts.ts`,
new `uplift/book/src/reader/contracts.ts` and `reader/fixtures/**`.
Existing consumers receive only minimal backward-compatible type glue if necessary,
documented in the PR. No production visual rewrite in this session.

**Deliverables:**

- A small real-renderer feasibility recording for the contour gesture and candidate
  second lesson. Inspect readability at the target spread size and an explicit
  keyboard/reduced-motion alternative. Label exploratory trials as exploratory;
  they are not prospective science validation or learner evidence.
- Fix the two-spread sequence using the bounded alternative rule above. Document the
  intended claim, action, visible cue and truthfulness risk for each.
- Define a thin scene-controller contract for mount/readiness, presentation state,
  explicit reset, pause-and-settle, resume and disposal. Distinguish a static geometry
  scene from a live simulation: static scenes must not fabricate a hydraulic clock.
- Define lesson presentation state separately from model state: optional prediction,
  independent explanation visibility, level, selected contour/source and navigation.
  Specify what reset affects and what leaving/revisiting preserves.
- Plan backward-compatible optional question/challenge fields and adapter migration;
  no dummy question, fake success or blanket loss of binding checks. Existing app/tests
  must still compile and run while consumers migrate.
- Define page-turn ownership, gesture arbitration, focus restoration and the two-scene
  resource policy. Retain paused solver instances for return; a visible HostSample is
  not a full precision-preserving checkpoint. Context loss has an honest fallback.
- Fix reader routes (`/` default book, `?view=research` legacy research entry), how
  existing backend/debug parameters apply, and fixture-only routes for development.
- Provide a concise composition spec: page aspect, illustration allocation, typography,
  short copy budget, control/disclosure placement, phone behavior and zoom exceptions.
  Use the owner's reference as a quality bar, not an asset source.

**Exit:** contracts and usable test adapters are merged, old behavior remains runnable,
missing primitives and second-lesson choice are recorded, and 5B/5C/5D can start without
guessing shared interfaces. A fixture may test wiring; it cannot be delivered as science.

<a id="5b"></a>

## 5B · Revise the shared runtime and interaction lifecycle — RT · L

**Depends on:** 5A. **Parallel with:** 5C, 5D.

**Owned paths:** `hachure/runtime/src/core/**`, `hachure/runtime/src/reader/**`
except the frozen 5A contract without coordinated revision,
`hachure/runtime/src/widgets/**`, `hachure/runtime/src/sim-host/**`,
`hachure/runtime/src/tools-ui/**`, `hachure/runtime/src/a11y/**`;
new `e2e/reader-runtime.spec.ts` and `e2e/fixtures/reader-runtime*`.
No production book mounting or new spread files.

**Deliverables:**

- Implement independent scene readiness, lift, prediction, reveal and optional
  challenge state. Questions can be absent, unanswered or answered; no correct choice,
  recorded endpoint or stamp gates play, reveal or navigation.
- Revise shared learning widgets and messages, including reset behavior and focus.
  Keep feedback truthful: a freely available general answer may cite known evidence;
  feedback claiming what a reader just observed needs the actual relevant state.
- Keep advanced settings and university diagnostics usable through disclosure without
  resetting the host. Preserve non-default hidden-parameter notices and explicit restore.
  Numeric clamping, labels and keyboard equivalents remain intact.
- Add pause-and-settle semantics that wait for any in-flight advance/tool/configuration
  and publish a final consistent sample before detaching. On return, preserve the actual
  solver and fixed-step state; do not integrate the wall-clock gap or run hidden loops.
- Use existing source operations if the water lesson is selected. Confirm replacement
  by stable id, clamp reporting and explicit reset to the authored source arrangement.
  Do not assume valley-specific source/profile baselines describe a newly placed source.
- Preserve legacy callers with a temporary adapter until 5E. Mark its removal path;
  do not force callers to fake a prediction merely to enter the interactive state.
- Keep pending challenges incapable of awarding stamps, calibrated-time restrictions
  intact, and static/read-only capability differences explicit.

**Exit evidence:** meaningful transition/state tests (reveal before play; play with no
answer; skipped question; reset; level change), quiescence races (navigation during
step/configure/source placement), source reset/replacement, keyboard/focus and
reduced-motion fixtures. Compare model state on view changes **after quiescence**, not
across independently advancing samples. Existing host/backend and science tests remain
green. Any solver behavior change triggers CPU/GPU comparison; no such change is planned.

<a id="5c"></a>

## 5C · Book composition, paging and responsive reading — RT/design · L

**Depends on:** 5A. **Parallel with:** 5B, 5D.

**Owned paths:** `uplift/book/src/reader/**` excluding 5A contracts/fixtures,
`uplift/book/src/book-shell.ts`, `uplift/book/src/book.css`;
new `e2e/book-shell.spec.ts`, `e2e/fixtures/book-shell*`,
`docs/review/book-revision/shell/**`.
Existing production `app/book.ts` and global e2e helpers belong to 5E.

**Deliverables:**

- Build the open-book composition around a dominant 3D page region, accessible DOM
  text, short editorial content, gutter/edges/page numbers and quiet navigation.
  Keep old research styling scoped so changes do not break the existing app mid-wave.
- Implement actual page turning between mounted adapters. The outgoing scene remains
  visually attached to its page, freezes only after quiescence, then yields resources
  according to 5A. No floating overlay detached from the book and no blank-page proof.
- Deliver previous/next controls and keyboard navigation; guard turns during object
  drag, ignore navigation shortcuts in fields, coalesce repeated turn requests and
  manage focus. Wheel/swipe are optional and must respect browser scroll/zoom.
- Phone: readable single-page sequence with explicit explanation/scene navigation.
  Desktop: bounded full spreads. Large text/zoom: reflow instead of clipping.
- Integrate a quiet depth/source/research entry without making it a toolbar of
  technical controls. Answer-flap expansion must stay readable without breaking the
  ordinary spread into a long worksheet.
- Reduced motion uses an immediate change or brief fade. Hidden pages are not
  keyboard/screen-reader targets. Resize, back/forward and interrupted turns leave
  one coherent active page and no duplicated animation loops.

**Exit:** PB1/PB2/PB7 mechanics demonstrated with contract fixtures; save viewport
screenshots at desktop, tablet, phone and zoom/reflow settings plus a paging recording.
Test keyboard and motion alternatives. Final acceptance requires the real scenes in
5E/5F; fixtures alone do not satisfy the wave.

<a id="5d"></a>

## 5D · New playable example and shared scene primitives — INK/SCI · L

**Depends on:** 5A's fixed lesson choice and contracts. **Parallel with:** 5B, 5C.

**Owned paths:** `hachure/ink/src/**`, new
`uplift/book/src/scenes/**`, `uplift/spreads/cartography.contours/**`,
`uplift/spreads/hydrology.water-path/**` or the explicitly selected
`uplift/spreads/cartography.slope/**`;
new `e2e/playable-spreads.spec.ts`, `e2e/fixtures/playable-spreads*`,
`docs/science/validation/playable-book/**`,
`docs/review/book-revision/example/**`.
No runtime internals, shell files or old valley content.

**Deliverables:**

- Two real interactive spreads with a primary gesture, visible consequence, short
  optional question/flap, level-aware depth, sources, teacher note and honest scope.
  Write final scientific text only with a source and expert-review marker.
- Reuse real heightfield contours, projection, hatching, picking and view exaggeration.
  Lift/selection/camera behavior belongs in shared Ink/runtime primitives; authored
  spread data must not grow an independent renderer or scripted process.
- A constrained direct lift gesture must connect the flat drawing and raised geometry.
  Bind selected-contour indicators to actual geometry; disclose any vertical exaggeration.
- For water: use genuine source tools and solver snapshots. Make water legible through
  honest quantity encodings and appropriate presentation choices, not a precomputed
  route animation. Hide unrelated erosion controls and use a justified fixed setup.
- If the cartography alternative was selected, demonstrate a distinct second spatial
  idea with its own interaction and exact geometry checks; do not silently switch
  choices after content or evidence fails.
- Validate exactly the taught claim. For a process lesson, register its intervention,
  seeds/initial states, fixed horizon and intended view before the acceptance run;
  keep all outcomes. Geometry claims need mathematical/geometry checks and rendered
  consistency, not an unrelated long erosion experiment.
- Preserve a meaningful, labelled flat fallback with explanation. Static fallback
  cannot claim that the reader ran a live process. Include colour-independent cues,
  keyboard equivalents and useful text descriptions.

**Exit:** both lessons work against the merged 5A contract, in actual rendered fixtures
with real data/model behavior; sources, draft review status and relevant evidence are
attached. Integration of 5B's implementation occurs after merge, not by importing its
unmerged branch. Expert sign-off may remain pending, but scientific checks may not be
replaced by an attractive screenshot.

<a id="5e"></a>

## 5E · Migrate the built app and existing research example — lead/RT · L

**Depends on:** 5B, 5C and 5D merged. **Launch:** alone.

**Owned paths:** `uplift/book/src/main.ts`, `uplift/book/src/app/**`,
`uplift/book/src/mock-spread.ts`, existing fixture adapters/smoke scripts and their tests,
`uplift/spreads/geomorph.v-valley/**`, `uplift/spreads/index.ts`;
existing `e2e/*.spec.ts`, `e2e/helpers.ts`, legacy `e2e/fixtures/**`;
`hachure/runtime/src/instrumentation/**` only for compatibility/documentation
(no new collection scope); `docs/review/book-revision/migration.md`.
Shared exports/registry glue is lead-owned. Other session files get only bounded fixes
with the reason in the PR.

**Deliverables:**

- Make the new two-spread book the default route using the shared shell/runtime and
  scene adapters. Keep `?view=research` reachable through an explicit entry. Document
  route/backend/debug behavior; no silent removal of scientific reproducibility paths.
- Refactor the valley mounting rather than leaving a parallel obsolete product.
  Remove prediction/endpoint locks on interaction and general answer reveal.
  Keep endpoint-conditioned _observed-result feedback_ accurate and recorded/live
  provenance unambiguous. Do not claim an unreached result belongs to the live scene.
- Move the recorded chart, full parameter palette, budgets, profile, experiment history,
  pending challenge and instrumentation into appropriately labelled research/depth
  surfaces. No default pending-waterfall banner or disabled reward as lesson furniture.
- Preserve teacher notes, original comparison samples, historical science statuses,
  all forced backend routes, hidden-setting restoration and existing opt-in privacy.
- Keep event schema v1 limited to its existing recorded-rain research scope. Do not log
  contour/water actions as rain predictions, create fake commitments on reveal, or
  silently expand collection. New reader lessons need no analytics to work.
- Update existing tests that encoded superseded gating/route behavior. Preserve
  numerical/state, no-pending-stamp, no-false-years, recorded-value, privacy and fallback
  assertions. Remove temporary migration adapters only after all callers are migrated.
- Verify rapid page changes, disposal/context loss, return state, explicit resets,
  source replacement, level switches and research entry/return on the real app.

**Exit:** the default route passes the actual two-spread journey; the revised research
route remains functional with its evidence intact; compatibility debt is removed or
listed with a narrow reason. `pnpm check`, `pnpm build`, full browser suite and bundle
budget pass. A separate demo entry with the old default app unchanged is a failure.

<a id="5f"></a>

## 5F · Integrated acceptance, review packet and drift audit — QA/lead · M

**Depends on:** 5E merged. **Launch:** alone.

**Owned paths:** `e2e/**`, `playwright.config.ts`, `.github/workflows/**`
only for relevant coverage, `docs/review/book-revision/**`,
`docs/plan/stage-1-acceptance.md`, `docs/plan/stage-1-wave-5.md`,
`docs/plan/README.md`, `docs/plan/stage-1.md`, `docs/plan/product-realignment.md`,
`README.md`; bounded implementation fixes with explicit justification.

**Deliverables:**

- Run PB1–PB8 against the integrated app. Capture full viewport composition, actual
  object manipulation and page turning, keyboard/motion alternatives, phone/reflow,
  direct answer reveal and model state preservation.
- Check modern GPU, forced CPU fallback and no-live-capability paths. Keep CPU/GPU
  comparisons green; run existing GPU browser comparisons if relevant host/transport,
  source handling or model initialization changed. Do not claim target-hardware
  performance from a headless test.
- Keep regression suites for the labelled research route and event schema; add the
  reader journey without deleting safeguards that made the old example truthful.
- Prepare one short recording and a runnable preview. Use the new reader listening
  protocol: enter → play without answering → reveal without a run → turn → return →
  change depth → reset explicitly. The historical W4 listening procedure remains an
  archival record, not the acceptance script for the new default flow.
- Record actual human observations when available: find the action, describe what
  changed, explain the small idea and decide whether to continue. No invented feedback,
  inferred learning gains or automated "human pass".
- Reconcile Wave 6 and Stage 2–4 briefs with implementation findings. Every proposed
  addition names its reader action, visible consequence, evidence and reusable
  primitive. Reject unmotivated engine/features or new quizzes that gate navigation.

**Exit:** an evidence-linked acceptance ledger and handover covering done/not done,
surprises and plan-changing findings. All automated/code criteria must pass to mark
implementation integrated. Mark product review, human listening, science sign-off and
hardware measurement independently; missing human evidence remains **pending**.
Wave 6 can finish those human/hardware gates, but cannot treat them as passed or turn
an unresolved product defect into mere hardening.

## Verification and ownership matrix

| Check                                                 | First owner                                | Integrated evidence / consequence                                               |
| ----------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| Optional question/challenge; independent reveal/play  | 5B                                         | 5E migrates callers; 5F tests no-answer and pre-play reveal on both new spreads |
| Bounded book; mobile and zoom                         | 5C                                         | 5F PB1/PB2 full viewport captures; reject tiny text and overflow-hidden passes  |
| Real 2D-to-3D relation and primary gesture            | 5D                                         | 5F PB3/PB5 actual render, keyboard and state-derived visual cue                 |
| Live source placement and reset, if selected          | 5B + 5D                                    | 5E/5F real-backend tests, science evidence and no scripted flow                 |
| Page turn, off-page quiescence and return             | 5B + 5C                                    | 5E/5F rapid-turn/in-flight tests; no hidden advance or reset                    |
| Research evidence, backend fallbacks and privacy      | 5E                                         | Existing regression coverage retained and run by 5F                             |
| Human discoverability/listening and scientific review | 5F prepares; people perform                | Explicit pass/fail/pending in the ledger, carried to 6B/6C                      |
| Classroom hardware, startup and response latency      | 5F records diagnostic results; 6A measures | Visible rendering on target hardware; headless results do not close the gate    |
| No unfinished-plan drift                              | Planning session now + 5F reconciliation   | Wave 6 / later-stage changes below and in the main framework                    |

## Carry-over ledger and definition of complete

- **Keep open:** expert sign-off, human listening, classroom/projector review and visible
  target-hardware results until actually performed. Owners: 5F packet, then 6A–6C.
- **Retain as failed/pending historical research:** original valley morphology and
  waterfall challenge experiments. They cannot enable a successful claim or stamp.
  They do not block unrelated, independently supported lessons.
- **Conditional only:** geological years/field calibration, a waterfall challenge,
  stamps, real DEMs and additional engine families. None is a hidden prerequisite for
  this wave's selected lessons.
- **Finish now:** update future scope and identifiers so incoming sessions read the
  new priorities rather than an old "page turning later" or "solver-first" brief.
- **Close implementation:** all six sessions integrated, checks green, actual default
  book and revised research example demonstrated, evidence packet linked.
- **Close product acceptance / release:** owner/product review plus required scientific,
  human accessibility and hardware gates passed. Integration alone is not release.

## Planning-session ownership

This planning session owns `README.md`, `docs/handoff.md`, `docs/product-story.md`,
`docs/plan/**` and append-only `DECISIONS.md` on `s1/w5/revision-wave-plan`.
It does not edit implementation, archived evidence or scientific experiment outcomes.

## Handover for this planning change

The direction commit is on main. This document plans the full revision wave; it does
not execute 5A–5F. The former P1/P2 outline is superseded and hardening is renumbered,
with its unfinished scope revised rather than discarded. Next launch is **5A alone**.
