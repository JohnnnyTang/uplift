# Product story and threads

A reading of `docs/handoff.md` for builders: what Uplift is, why each rule exists, the threads that run
through every stage, and the tensions inside the brief that the plan has to resolve. Where this document
and the handoff disagree, the handoff wins. Raise the disagreement in `DECISIONS.md`.

## The story in one paragraph

A student opens a book on a desk. The right-hand page shows a hatched contour drawing of a plateau, and it
is a real map they could read on its own. The left-hand page asks them a question and makes them commit to
an answer. Then the contours lift off the paper and become terrain. Rain falls, blue water finds the low
ground, ochre sediment moves, and a valley cuts down over simulated millennia while a clock and a scale bar
keep time and distance honest. The student can paint a band of hard rock and watch a waterfall form. They
lift a flap to read why, tied to what they just saw, and then the book sets a challenge that the simulation
itself checks. A university student opens the same page, flips a toggle, and the same running model shows
the stream power law with a live parameter, a long profile and a sediment budget. Nothing about the model
changed; they now see more of it.

## Who it is for

| Reader                     | What they need                                       | What the spread gives them                                                                        |
| -------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| High-school student        | The phenomenon, vocabulary, one clear cause → effect | Predict → watch → flap; simple controls (rain, rock, slope)                                       |
| University student         | Mechanism, governing relations, real units           | Same model, the hood open: equations, live graphs, expanded "ignores" box, later real DEMs        |
| Teacher                    | Something reliable to project and replay in class    | Teacher note, sources, seeded replay, keyboard control, works on school laptops                   |
| Research group / reviewers | Credibility and a publishable engine                 | Tier badges, qualitative tests, mass conservation, expert sign-off, a standalone engine (Hachure) |

## The three bets of Demo 1

The current goal is to prove three things with one spread. Each is a bet that could fail, and each stage-1
wave is arranged to find out early.

1. **One shared terrain engine.** A process model (virtual-pipe water, capacity-based erosion and
   deposition, slumping) that is fast enough on a school laptop, correct enough to pass qualitative tests,
   and general enough that the next spreads (deltas, dams, knickpoints) are mostly data.
2. **The ink-line-to-3D look.** Contours and hatching generated from the heightfield, so the flat drawing
   and the 3D model cannot disagree. The lift is the signature moment.
3. **The two-level page.** High school and university on one simulation, switched without a reset.

## Threads that run through every stage

These cross-cutting concerns don't belong to one session. Every session brief names the threads it touches,
and every stage gate checks them.

1. **Rigour.** Process-based, never scripted. Tier badge, "What this model ignores", clamps, sources,
   qualitative tests, expert sign-off. _Every predict answer and every flap claim must be backed by a
   qualitative test that shows the model actually behaves that way._ Otherwise the page can claim something
   the simulation does not show.
2. **Page ↔ model agreement.** Every number on the page comes from a binding. This includes the time-scale
   label, the scale bar and durations in question text (see tension 3 below). It needs a mechanical check
   (a lint or test that scans page text for bare digits), not reviewer vigilance.
3. **Two levels, one model.** The toggle is a view change. A test asserts that the simulation state hash is
   unchanged across toggles.
4. **Determinism and replay.** Fixed step, seeded RNG, reproducible runs, so a teacher can replay a run in
   class. Later this can include shareable replay links (seed plus input log).
5. **Classroom performance.** Integrated GPUs and Chromebooks. Degrade grid size before frame rate. The flat
   drawing is the fallback that still teaches.
6. **Accessibility.** Keyboard, text alternatives for the key visual change, reduced motion, colour-blind
   palette. This is designed in, not audited in at the end.
7. **Engine ↔ book separation.** Hachure never imports Uplift. Spreads are data. Heavy spread code is a
   signal that the engine lacks a primitive.
8. **Restraint.** One idea, one model, one challenge per spread. Ink and paper plus one or two
   meaning-bearing colours. This restraint is why Every Joule feels finished.

## Tensions in the brief, and how the plan resolves them

These are places where two parts of the handoff pull against each other, or where a stated method won't meet
a stated criterion as written. Each one is assigned to a session in `docs/plan/stage-1.md`.

1. **The cited advection scheme versus the mass-conservation criterion.** Mei et al. (2007) advect suspended
   sediment semi-Lagrangianly (back-tracing), which does not conserve mass. The acceptance criterion
   requires rock plus sediment change to match exported sediment within 1%. _Resolution:_ use a
   conservative flux-form (upwind, finite-volume) sediment transport. Make evaporation deposit the sediment
   it strands rather than delete it, and keep explicit budget counters (eroded, suspended, deposited,
   exported). Session 2A owns this; the mass test is its exit criterion.
2. **"WebGL2 fallback at 128²" versus compute shaders.** WebGL2 has no real compute stage, so the WebGPU
   solver cannot simply run on the fallback. _Hypothesis to test (spike 1B):_ the fallback runs the CPU
   reference solver in a Web Worker at 128² and renders with WebGL2. That makes the CPU reference a shipped
   product feature, which raises the stakes on keeping it fast and in agreement with the GPU solver.
3. **Typed numbers inside question text.** The Demo 1 predict question says "for 10,000 years". That is a
   duration the time-scale config controls, so under the binding rule it should be
   `{{scene.durationLabel}}` or similar. _Resolution:_ scene and config values are bindable, not only probes
   (session 1A contract). The no-typed-numbers check treats question text like any other page text.
4. **A quantitative time label on a qualitative model.** "1 s ≈ 1,000 years" reads as a measurement, but the
   tier is _process model_ (magnitudes indicative). _Resolution:_ derive the label from a documented
   calibration (an erosion-rate range from the literature mapped to simulated incision). Keep the "≈". Have
   the "ignores" box say that rates are indicative. Session 1E drafts the calibration, and the expert signs
   it off.
5. **GPU determinism.** Bitwise reproducibility holds for the same device and driver only if the solver
   avoids order-dependent float reductions (atomics). _Resolution:_ the determinism criterion is bitwise on
   the CPU within one JavaScript engine and bitwise on the same device/driver for the GPU. Preset and
   brush transcendental functions do not promise cross-engine bitwise replay. Budget reductions use a fixed-order tree reduction or
   integer atomics on fixed-point values. CPU–GPU agreement is checked within a tolerance, not bitwise.
6. **The predict answer depends on the model.** "Deeper, wider, or both?" Whether harder rain widens the
   valley depends on slumping and the angle of repose in _our_ model. _Resolution:_ write the predict
   answer only after the qualitative test shows the behaviour (session 3B). The content session drafts
   options, and the answer is bound to the test result before expert review.
7. **Level toggle versus university-only parameters.** If a university reader changes erodibility K and then
   switches to high school, the model keeps the new K (the toggle must not change the model). The
   high-school page then has to stay truthful with a non-default parameter. _Resolution:_ high-school text
   binds to live values, and a "parameters changed — reset to defaults" affordance appears when hidden
   controls differ from their defaults.
8. **First meaningful page in 3 s versus WebGPU start-up.** Device creation and shader compilation take
   time. _Resolution:_ the flat contour drawing is computed on the CPU from the preset heightfield and
   painted first, as SVG or a canvas on the DOM page. The 3D renderer initialises behind it, and the lift
   starts only when it is ready. The 2D-first rule and the performance budget point the same way.
9. **"Build the spread first, extract the engine later" versus parallel sessions.** Parallel work needs
   agreed contracts. Agreeing contracts up front risks engine-first design. _Resolution:_ contracts in wave 1
   are deliberately thin. They are the state layout, the step/tool/probe interface and spread schema v0,
   all written _from the Demo 1 spread's needs_. Stage 2 is where the engine is properly extracted and the
   schema reaches v1.

## What "done" looks like for the project, not just Demo 1

By the end of roadmap phase 4: a catalogue of spreads filterable by course × level; three engines (terrain,
human/agent, special scenes) sharing one render layer and runtime; at least one spread on a real DEM; and a
classroom pilot with results reviewed by the group. The architecture test comes in Stage 2: a new terrain
spread built mostly as data.
