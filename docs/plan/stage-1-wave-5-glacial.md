# Wave 5 extension · U-shaped valley formation · sessions 5G–5N

Status: planned, not started. Owner authorized this plan on 2026-11-09 after
reviewing 5B–5F and choosing both condition changes and observation over time.
This extends the current Wave 5; it does not restart A–F or create another wave.
Read [the parent wave](stage-1-wave-5.md), [product gate](product-realignment.md),
[science policy](../science/education-policy.md), [branch audit](../review/book-revision/current-direction-review.md)
and [saved owner references](../references/owner-2026-11-09/README.md).

## Settled product contract — do not reopen as implementation questions

- Opening subject: **formation of U-shaped valleys by glacial processes**.
- Interaction: **change a condition → watch formation → pause/inspect/replay → compare**.
  Observation and intervention are required parts of the same lesson, not alternatives.
- Deliver one prominent physical-condition control with a keyboard-operable UI and
  a discoverable equivalent handle/object gesture in the 3D scene. Both submit the
  same validated command. Camera movement or ice visibility is not the physical control.
- A textbook drawing becomes a complete, naturally coloured 3D valley/ice scene.
  The entrance is an artistic effect; no exact mapping or contour correspondence.
  Contours are optional. Simple book furniture does not impose a scene colour limit.
- One teaching idea: how glacial action reshapes a valley, and how the chosen condition
  changes that evolution. Timeline/inspection tools serve that idea, not new lessons.
- Preserve optional questions, immediate explanation, both reading levels on one model,
  page turning, keyboard/reduced-motion access, and honest research/fallback routes.
- Real evolving bed/ice state drives the scene and explanation. No target-U interpolation,
  scripted erosion mask, hydraulic water renamed ice, or progress-driven shape tween.

The first scene is one compact valley reach. Show rock/soil and ice as recognizable
surfaces, with a transverse section and a show/hide-ice inspection mode. Hiding ice
is an X-ray-style view, not melting. A reduced transverse model may be visualized as
an explicitly idealized reach, but must not invent longitudinal erosion or flow.

No full glacier/climate simulator, moraines, fjords, tributary network, real DEM,
vegetation dynamics, new analytics or reward system is implied. The existing water
lesson may remain the second independent spread for paging; do not invent a second
glacial concept to satisfy the two-spread gate. The contour lesson can remain an
optional example, never the default opening or a compulsory prerequisite.

## Condition and time semantics

5G chooses and freezes one sourced, useful control, its units/range, gesture and
expected comparison before dependent work. First evaluate ice supply if the selected
model actually accounts for ice mass; otherwise evaluate a supported rock-resistance
or basal-sliding condition. This is a bounded technical choice, not another request
to decide between interaction and observation. Do not present numerical speed, elapsed
time, visibility or direct terrain sculpting as the physical condition. Do not equate
an imposed ice boundary with a climate simulation. Add a second condition only if it
supports the same claim and the ordinary page stays simple.

| Reader action                          | Required meaning                                                                                                                                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Change the condition while playing     | Clamp/validate and apply at a named fixed-step boundary; show the accepted value. Existing terrain and history remain; no hidden restart or retroactive change.                                                                                                   |
| Change while paused                    | Accept the command for the next step, show that it is pending, apply once on advance.                                                                                                                                                                             |
| Pause / step / play                    | Control actual model advancement. Playback speed changes scheduling only, not fixed dt, forcing, erosion strength or results at the same step.                                                                                                                    |
| Inspect past time                      | Pause first; show a retained authentic state or deterministically replay to it. Mark the view as past/recorded and preserve the current live head.                                                                                                                |
| Resume from inspection                 | Return explicitly to the live head before advancing. No implicit historical branch. Physical controls in past inspection offer Return to live; they cannot edit the past.                                                                                         |
| Compare another condition              | Explicitly keep run A, start B from the same authored initial state/config/seed except the named intervention; inspect matched model times with shared spatial scales. Live intervention history is labelled separately from a controlled fresh-start comparison. |
| Reset / new run                        | Explicit action. Reset restores documented authored defaults; starting comparison B uses the newly selected condition. Never erase A silently.                                                                                                                    |
| Inspect bed / section / camera / level | View-only; no physical state or timeline mutation. Ice hiding does not remove ice mass.                                                                                                                                                                           |
| Leave / return                         | Settle in-flight work, retain exact current state, accepted command history, selected time and comparison. No hidden advance or wall-clock catch-up.                                                                                                              |

Bound memory and compute: retain at most live run B plus reference A, a limited
checkpoint/sample cache and a deterministic command log. Register cache limits and
recompute policy in 5G; give visible loading/cancellation when reconstruction is needed.
Do not build a general experiment manager. All time/condition/probe values bind to
model/config data. Use model time with an uncalibrated label unless field time is
actually justified; literature times are not this app's calibration.

## Dependencies, ownership and merge order

**Canonical base and PR target: s1/w5/integration.** The owner explicitly requested
consolidation there for future sessions. It contains main's 5A (8069a7f), B–F review
(e7e7f0a), direction/references (3c4bb56), and this plan (7bf47d3), with integration
workflow updates. [Provenance](../review/wave-5-integration/README.md).
Main need not receive these changes before 5G: the integration branch is the
owner-authorized Wave 5 exception to the earlier main-only rule. Record its verified
base SHA at each session launch. Dependents consume only changes already merged to
this branch, never sibling WIP. The integration request does not launch 5G itself.

**Execution:** 5G → 5H → (5I, 5J, 5K, 5L) → 5M → 5N → Wave 6.
The middle group may be scheduled concurrently in separate worktrees after 5H merges;
this planning task does not launch agents. **Merge:** G → H → I → J → K → L → M → N.
Consumers use only contracts/CPU code already merged to s1/w5/integration; 5M joins their implementations.
Session sizes below are estimates, revised after feasibility, not performance promises.

| Session | Outcome                                                                          | Depends on                   | Size |
| ------- | -------------------------------------------------------------------------------- | ---------------------------- | ---- |
| 5G      | Scientific feasibility, selected condition and frozen scene/model/time contracts | Integrated reviewed baseline | L    |
| 5H      | Deterministic CPU glacial process and replayable state                           | 5G                           | L    |
| 5I      | GPU implementation and CPU/GPU agreement                                         | 5H                           | L    |
| 5J      | Condition commands, timeline, inspection and paired-run runtime                  | 5H                           | L    |
| 5K      | Complete coloured scene, artistic entrance and direct gesture                    | 5H                           | L    |
| 5L      | Focused lesson, sources, prose and claim protocol                                | 5H                           | M    |
| 5M      | Actual default-book integration and bounded composition                          | 5I–5L merged                 | L    |
| 5N      | Scientific comparison, integrated acceptance and drift audit                     | 5M                           | L    |

Branches use s1/w5/5g-glacial-contracts through s1/w5/5n-glacial-acceptance,
with descriptive session-specific slugs and sibling worktrees. Each session appends
decisions and hands over done/not done/surprises/plan-changing facts. The lead owns
shared exports, workspace configuration, lockfile and global harness glue. Specify
minimal cross-owned changes in the PR; no hand merging the lockfile. Rebase and run
pnpm check before each merge. Every PR also identifies its reader action and evidence.

<a id="5g"></a>

## 5G · Scientific feasibility and frozen contracts — SCI/ENG/lead

**Owned:** docs/science/glacial/**; docs/review/glacial/contracts.md;
docs/review/glacial/feasibility/**; spikes/glacial-valley/**;
hachure/glacier/package.json and src/contract/**; minimal reader contract/schema
extensions and public exports, enumerated before dependents start.

- Review full primary model sources, including lateral/sidewall mechanics and known
  deficiencies. Select the smallest process model capable of the taught cross-section
  evolution. A source citation alone is not evidence our implementation works.
- Run a bounded, labelled exploratory process prototype, with a plain actual-state
  surface/section view at page size. Show baseline evolution and at least two condition
  settings; include no-erosion/no-driving-process controls as applicable. Record all
  attempts and limitations; this is feasibility, not prospective acceptance.
- Freeze physical control, gesture, ranges, units, initialization/boundaries, fixed dt,
  flow/erosion coupling, numerical tolerances, model tier and omissions. Decide what
  ice supply/storage and eroded rock accounting mean; use explicit export/sink terms
  if transport or deposition is omitted. Do not imply conserved closed stocks otherwise.
- Define public typed configuration, state, probes, commands, full checkpoints and
  backend contract in @hachure/glacier (TypeScript source exports). Ice and bed fields,
  source/sink terms, step/time and accepted event ordering must be reproducible.
- Freeze presentation/gesture, timeline/live-head and reference-run contracts, cache
  budgets and latency measurement protocol. Preserve existing consumers. Fakes are
  wiring fixtures, clearly marked and never science evidence.
- Register the future acceptance protocol before acceptance runs: actual terrain
  variants (seeds only if used), condition arms, horizon, matched times, views, width/
  depth/profile measures, failure cases, model/backend tolerance and visual criteria.
  Distinguish widening from deepening and rates from different final shape classes.

**Exit:** a defensible process route, legible exploratory result and usable frozen
contracts. If the proposed model cannot produce supported valley reshaping, record
failure and revise the mechanism within this session; do not substitute contours,
rainfall or scripted morphing. If no bounded model is viable, report that specific
scientific constraint rather than launching dependent production work on a fiction.
This is a feasibility gate, not reopening the owner's subject or interaction choice.

<a id="5h"></a>

## 5H · CPU process implementation — ENG

**Owned:** hachure/glacier/src/cpu/**, src/state/**, src/testing/**;
docs/review/glacial/cpu/**. Contract edits require coordinated 5G revision.

Implement the chosen mechanism, state/checkpoint schema and commands. Evolving bed
must follow local model processes, not distance to a target profile. Reproduce the
5G exploratory cases with production code. Validate finite/nonnegative stocks where
applicable, boundary/source/sink budgets, bed-change accounting, stable dt, refinement
sensitivity, negative controls and exact same-backend checkpoint/replay determinism.
Capture actual state/probe histories for downstream renderer/host work. Preserve
existing hydraulic solver behavior and comparisons. No spread-local simulation.

**Exit:** bounded CPU run responds to the selected control, evolves the supported
cross-section and round-trips full state/events exactly. Fixtures and numerical
invariants pass; this is not yet integrated lesson or expert acceptance.

<a id="5i"></a>

## 5I · GPU parity and fallback — ENG

**Owned:** hachure/glacier/src/gpu/**; hachure/glacier/test/browser/**;
docs/review/glacial/gpu/**; package test-command glue coordinated with lead.

Implement the same frozen process, commands and checkpoint semantics on GPU. Compare
CPU/GPU fields, profile/probe outcomes and budgets over registered multi-step horizons,
condition changes and restore/replay, not one image or one timestep. Declare tolerances
from 5G and document precision; no assertion of cross-device bitwise equality. Retain
same-backend determinism and exact full-state retention. If execution tier changes,
never silently reinterpret a live checkpoint or reset; settle, report and use an
explicit validated restore path or a labelled restart/static fallback.

**Exit:** GPU and CPU comparison suite passes for every shipped control and scenario;
capability failure has tested CPU/static behavior. If GPU cannot meet parity, record
it as incomplete and explicitly revise the delivery scope; do not claim GPU support
because rendering uses a GPU. Existing water CPU/GPU checks remain green.

<a id="5j"></a>

## 5J · Intervention, time and comparison runtime — RT

**Owned:** hachure/runtime/src/glacial-host/**, src/timeline/**;
e2e/glacial-runtime.spec.ts and e2e/fixtures/glacial-runtime*;
docs/review/glacial/runtime/**. No scene renderer, content or book shell changes.

Implement the table above using 5G contracts and 5H CPU backend; consume only merged
GPU code when available. UI and 3D input share one validated command path. Coalesce
continuous drag previews and commit at defined step boundaries, preserving accepted
values and deterministic ordering. Build pause/step/scheduling, bounded checkpoint
history, explicit past/live state, cancellation and matched-time A/B comparison.
Comparison on a small page may use a toggle/onion-skin instead of two tiny canvases.

Test edits during in-flight advancement, pause/resume, seeking, leaving/returning,
reset, reference replacement, cache eviction and cancelled reconstruction. A view
sample is not a precision-complete checkpoint. Levels/inspection never reset physics.
Reduced motion removes autoplay/transition motion; explicit advance and inspection
still provide meaningful outcomes. Reuse the existing settlement lifecycle.

**Exit:** unit and browser contract tests demonstrate deterministic commands, replay,
matched-time provenance, memory bounds and preserved live head with keyboard access.

<a id="5k"></a>

## 5K · Coloured geographical scene and direct interaction — INK/design

**Owned:** hachure/ink/src/glacial/**; uplift/book/src/scenes/glacial/**;
e2e/glacial-scene.spec.ts and e2e/fixtures/glacial-scene*;
docs/review/glacial/scene/**. Shared material/view changes only as bounded additions
preserving old callers, with listed files in PR. No glacial physics or runtime internals.

Use real 5H states and frozen command contracts to render complete rock/ice surfaces,
natural colours, readable depth/occlusion and the transverse section. Supply an authored
textbook line illustration and brief entrance effect; do not spend the session proving
geometric correspondence. No mandatory contour layer, lift slider lesson or paper-only
terrain material. Flow cues must reflect modeled motion and distinguish ice flow from
long-term bed erosion; do not create parcels/longitudinal dynamics the model lacks.

Implement the selected scene handle and UI-equivalent adapter, accepted/clamped value
feedback, keyboard alternative, camera/bed visibility and section inspection. Calls
use the contract fixture until 5M integrates the actual runtime. Inspect real state
captures at actual page allocation on desktop/phone, with reduced motion and natural
colours. Static fallback is a useful labelled illustration, never a fake live glacier.

**Exit:** recognizable spatial terrain/ice, perceptible real morphology change, legible
condition manipulation and read-only inspection; no shader-only simulated erosion.

<a id="5l"></a>

## 5L · One focused lesson and scientific explanation — SCI

**Owned:** uplift/spreads/geomorph.u-valley/**;
docs/science/glacial/lesson/**; docs/review/glacial/content/**.

Author the short invitation, condition label/help, optional reflection, answer,
level-specific depth, sources, accessible state descriptions and teacher notes.
Bind all configured/measured values. Keep diagrams and prose about the same current
run/time; comparison text distinguishes fresh-start pairs from mid-run intervention.
Declare idealization, uncalibrated time, exclusions and any forced boundary/section
extrusion without placing a research checklist on the page. Mark scientific drafts
expert-review. Use 5G's registered claim; amendments precede new acceptance runs.
No promise that every glacier or setting produces an identical U-shaped endpoint.

**Exit:** schema/binding checks and complete claim/source/model-limit register; all
copy fits the agreed spread allocation. Expert approval remains separately tracked.

<a id="5m"></a>

## 5M · Integrate the actual first lesson — lead/RT

**Owned:** uplift/book/src/app/**, src/scenes/entries.ts, src/scenes/index.ts,
src/main.ts, src/reader/** (bounded composition fixes); uplift/spreads/index.ts;
e2e/glacial-book.spec.ts; docs/review/glacial/integration/**; shared exports/harness glue.

Make U-shaped valley formation the default first spread. Join real CPU/GPU selection,
timeline host, condition UI/3D gesture, scene and content; retain the research route
and existing water spread as a second independent lesson. Do not rename existing
scientific evidence or extend recorded-rain instrumentation to the glacier.

Compose one dominant scene with quiet play/pause, time inspection and one physical
condition; expand reference comparison without crushing the page. Consolidate duplicate
scope labels. Preserve small-screen/reflow and keyboard flow. Demonstrate a complete
reader run: enter → transform → change condition → evolve → inspect past → return
live → compare → change level → turn away/back → reset explicitly.

**Exit:** pnpm check/build, relevant full browser regression and bundle budget pass;
actual default route works on supported backends, including failures and navigation
while computing/seeking. A separate spike URL cannot close this session.

<a id="5n"></a>

## 5N · Prospective evidence, acceptance and drift audit — QA/SCI/lead

**Owned:** docs/science/validation/glacial-valley/**;
docs/review/glacial/acceptance/**; e2e/glacial-acceptance.spec.ts;
docs/plan/stage-1-acceptance.md and minimal current-plan/status reconciliation.

Execute the frozen protocol with production model and renderer. Preserve every arm,
variant and failed result. Verify formation and the condition's causal effect at matched
times, with profile/width/depth evidence and meaningful text alternatives; do not promote
only more eroded mass or a prettier image to proof of a U-shaped valley. Check numerical
and CPU/GPU requirements alongside rendered evidence at classroom playback speed.

Walk PB1–PB9 and GV1–GV8 below on the default app, including keyboard, reduced motion,
phone/reflow, cancelled seeking, return state, reference run and static fallback.
Record setup/SHA and separate live observation, deterministic replay and historical
data. Obtain owner scene review and expert review where available; human listening,
first-time-reader and hardware checks stay pending until actually performed.

**Exit:** evidence-linked ledger and review packet. All code/science failures resolved
before calling the extension implemented; actual product defects are not deferred as
hardening. Wave 6 can finish named human/hardware gates but cannot inherit a missing
process model, absent comparison or failed scene as a successful Wave 5.

## Traceability and drift gate

| ID  | Required result                                                                                                         | Owner / evidence                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| GV1 | One selected physical condition changes actual future evolution through UI and equivalent 3D input                      | 5G choice, 5J commands, 5K gesture, 5M/N real journey          |
| GV2 | Play/pause/step, historical inspection and matched-time comparison preserve provenance and live state                   | 5J tests, 5M/N full journey                                    |
| GV3 | Supported U-valley cross-section formation emerges from mechanisms with honest limits                                   | 5G feasibility, 5H/I invariants/parity, 5N registered outcomes |
| GV4 | Textbook illustration transitions into a complete naturally coloured scene, without mandatory contours or exact mapping | 5K/M actual-size captures, 5N owner review                     |
| GV5 | Page, scene, section, condition and explanation refer to the same run/time/configuration                                | 5J/L/M binding and provenance tests                            |
| GV6 | Accessible interaction and reduced-motion inspection work, including reflow and real text alternatives                  | 5J/K/M tests, 5N listening status                              |
| GV7 | Default book, next spread and research route retain state and old scientific/privacy safeguards                         | 5M/N regressions                                               |
| GV8 | Sources, failed runs, human/expert/hardware status and original owner references stay explicit                          | 5G/L/N evidence and decision log                               |

At session entry and in every PR, quote the relevant GV row, name the reader action,
visible outcome and evidence artifact, and record any deviation in DECISIONS.md.
Do not launch the next dependent session while its gate is unmet. Technical choices
inside this contract belong to the session; a change of subject, removal of condition
interaction/time inspection, scripted formation or mandatory contour focus needs an
explicit owner decision. Do not ask to reapprove already settled transition/colour rules.
Keep historical science records intact; link corrections rather than overwriting them.

## Primary research starting point and open technical decisions

<!-- expert-review -->

[Seddik et al., Numerical simulation of the evolution of glacial valley cross sections](https://arxiv.org/abs/0901.1177)
couples transverse ice flow and erosion, investigates lateral stresses and reports a
limitation in reproducing widening versus deepening. Its abstract is a useful warning
against assuming a simple model suffices; 5G must read the full work and alternatives.
No equation, parameter range, calibrated timescale or promised outcome is adopted here.

Remaining 5G decisions: mechanism/discretization, physical input and bounds, dimensional
accounting, geometry idealization, numerical/visual thresholds, budgets and command
contracts. These are assigned deliverables, not missing product direction. Planning
estimates may need revision if a scientifically adequate model proves larger than a
session; record the evidence before changing scope or splitting sessions.

## Planning handover

Done: current-wave extension with dependencies, owned paths, reader semantics,
acceptance and durable drift gates. Not done: none of 5G–5N has started or passed.
Surprise carried forward: A–F are implemented on a review stack while main is older.
Plan-changing fact: the owner requires intervention and time-based observation together;
a passive formation animation or an input widget without temporal inspection is incomplete.
