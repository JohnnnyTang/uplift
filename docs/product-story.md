# Product story and threads

## Current owner direction · 2026-11-09

The pipeline is settled: **textbook illustration → visual transformation → complete
interactive 3D scene**. The illustration can be any suitable line drawing; contours
are optional and are not the product theme. The transition is art direction: morph,
fade, reveal and staged geometry are allowed, with no exact point correspondence,
projection reconstruction or spatial-calculation acceptance gate. Keep the scene
recognizable and the endpoint complete. Reduced motion can skip the effect.

Separate this entrance effect from the lesson's process: once the lesson claims to
show valley formation, the landform change must come from a supported process model,
not a shape tween presented as erosion. Artistic transition freedom does not require
relaxing scientific honesty about the actual lesson.

Keep the book chrome and typography simple. Illustrations and 3D scenes may be
colourful and use natural material colours: rock, soil, vegetation, snow, ice and
water need not share paper colour. The old one-or-two-quantity-colours restriction
is superseded. Data colours still need a legend and non-colour cues; natural material
colour need not pretend to encode a measured quantity. Preserve accessible contrast.

The owner's preferred first lesson is **formation of U-shaped valleys**. Rain/runoff
is no longer the proposed opening. Discuss the glacier scene and interaction before
writing its implementation plan or starting a demo. The prior contour/source lessons
are useful implementation examples, not the chosen opening sequence.

[Saved owner references](references/owner-2026-11-09/README.md) establish the intended
experience. The exact transformation is not an unresolved science requirement.

## Product direction — owner clarification, 2026-11-09

**Uplift is a book whose drawings come to life.** A reader opens a bounded paper spread,
touches an ink illustration, watches it rise into a manipulable 3D scene, discovers one
small idea through play, and turns the page because they want to try the next one.
The name describes that moment: line art lifting out of a book into a 3D world.

The owner's request and six supplied Every Joule screenshots are the design reference
for this correction. They establish the intended experience; they are not instructions
to copy assets, reproduce its physics lesson, or claim that our current app does this.
Geography remains the subject. Hachure remains the scientific and rendering foundation.

This clarification is reflected in the [handoff](handoff.md#pedagogical-design-principles)
and supersedes the earlier mandatory prediction gate, required challenge/stamp loop,
and deferral of page turning. The complete [Wave 5 revision](plan/stage-1-wave-5.md)
revises existing implementations and delivers the new example before Wave 6 hardening.
[PB1–PB8](plan/product-realignment.md#product-acceptance-gate) remains the product contract.
Existing scientific evidence keeps its actual status.

## What the reference teaches us

In the supplied example, the reader drags a ball up a track and lets go. Its motion and
the changing energy bottles tell the same story at the same time. A friction switch
changes one understandable condition. A short question and an answer under a flap
invite reflection. The paper, gutter, page edges, illustration and small navigation bar
keep the experience recognizably a book.

The important design relationship is **gesture → visible consequence → understandable
meaning**. The bottles make an otherwise invisible quantity tangible. Uplift should find
equally readable visual representations for each lesson, rather than putting its engine
parameters in front of the reader. A sediment gauge, for example, must represent a
specific measured stock or flow; it cannot become a decorative jar with a scripted fill.

The reference also shows restraint: the illustration occupies a page, and the controls
belong to that illustration. Its equations are not a requirement for our opening view.
We take the book, spatial interaction and visual explanation as the reference, with
less text and optional depth.

## The reader's experience

1. **Notice.** A beautiful, readable drawing and a short invitation make the action obvious.
2. **Touch and play.** Lift, drag, place or turn something in the illustration. The scene is
   available without answering a question first.
3. **See.** The same scene visibly responds. One visual cue makes the consequence readable.
4. **Wonder and reveal.** An optional small prediction or question sits beside an answer
   flap. Reveal the answer immediately if wanted; explain kindly, without scoring pressure.
5. **Try again or turn the page.** Change one setting, repeat the action, or move on freely.

This is an editorial rhythm, not a sequence of locked states. A reader can open the
explanation before playing, skip a question, or revisit a spread. No quiz, correct answer,
simulation endpoint, stamp or assessment export is a prerequisite for play or navigation.

Every spread has one idea, one primary gesture and one visible outcome. An optional
"Try this" invitation can extend that same idea. A second concept needs another spread.
A free sandbox is a later invitation, not the reader's entrance exam.

## The book is the interface

On a normal desktop or landscape tablet, the whole open spread fits in the reading area:
two page-shaped surfaces, a gutter, outer edges, page numbers and a quiet navigation bar.
Text, the main illustration, its primary control and the answer flap belong to the pages.
The illustration is the visual centre of gravity; it must not sit below a dashboard.

Page turning is part of the first product proof. Use a restrained page-turn effect with
visible previous/next controls and keyboard access. A wheel or touch gesture may request
one turn at a time, but must not capture a drag intended for the scene or trap scrolling.
Reduced motion uses an immediate change or brief fade, with no forced lift animation.
A transition never changes simulated terrain or fabricates a scientific outcome.

Book size is a composition constraint, not permission to shrink text until it fits.
On a narrow screen, show one readable page at a time with explicit navigation between
the explanation and illustration and onward to the next spread. At large text sizes or
browser zoom, reflow and vertical scrolling take precedence over fixed dimensions.
No clipped content, nested scroll traps or tiny replica of a desktop book.

Use readable textbook illustration and restrained depth. Natural material colours
are welcome in scenes; data encodings carry a legend and a redundant non-colour cue. Paper edges, contact shadows and a
controlled camera establish depth; decorative glow and gradients do not teach anything.
Keep text as accessible DOM content even when the page surface and scene use 3D rendering.

## What is visible, and when

| Surface                          | Reader sees                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Opening spread                   | Short title, a brief invitation, dominant illustration, one primary action, at most one optional condition control, quiet pause/reset, optional question and answer flap |
| Beside the illustration          | Compact quantity legend, applicable scale and honest model-time/tier label; a concise limitation wherever omission would mislead                                         |
| "Go deeper" / university view    | Optional equations, live graphs, measured values, additional controls and expanded explanation, on the same model state                                                  |
| Sources and teacher notes        | Scientific references, fuller simplifications, replay guidance and teaching context, reachable from each spread                                                          |
| Explicit research/developer view | Validation packets, backend/grid/seed details, pending experiments, instrumentation controls and diagnostic budgets                                                      |

These are progressive levels of disclosure, not separate simulations. A level or detail
toggle must preserve model state. If a hidden advanced setting has changed, show a brief
plain-language notice and an explicit restore action; never reset behind the reader's back.
Instrumentation remains opt-in and off by default; ordinary reading does not require it.

Honesty stays close to the relevant claim. "Simplified model; time is not calibrated" is
useful reader context. A list of unfinished research tasks is not lesson content. A
pending waterfall challenge stays out of the ordinary book until it has a supported
outcome; its failed experiments remain available to researchers.

## Where the current implementation drifted

This assessment is grounded in source and the committed rain-comparison screenshot,
not a claim to have conducted a new user study.

| Current evidence                                                                                            | Effect on the experience                                                   | Direction                                                                                              |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `uplift/book/src/app/book.ts` commits prediction before lifting and unlocks the flap at a recorded endpoint | Exploration and explanation require prior compliance                       | Make play and answer reveal independently available                                                    |
| The right page mounts a recorded bar/trace comparison before a separate live terrain                        | The taught outcome and the reader's action belong to different experiments | One primary live scene and its own consequence; retain recorded evidence as labelled optional material |
| `book.css` uses content-height columns and `lesson.css` fixes a small terrain viewport                      | The saved spread is a long worksheet with a small illustration             | Compose within a book spread; make the illustration dominant                                           |
| Brush settings, numerical captions and pending research status occupy the normal lesson                     | Readers must learn the tool before discovering the idea                    | Put one understandable action on the page; disclose technical depth on request                         |
| Stage 1 excludes page turning and treats the solver chain as the critical path                              | The book experience can be deferred indefinitely                           | Require a short playable book sequence before hardening or adding engine scope                         |

The mismatch is not a reason to throw away the work. Solvers, conservation checks,
CPU/GPU comparison, bindings, contours, picking, accessibility and reproducibility are
assets. They must now serve the reader's next gesture and visible discovery.

## The first lesson after this correction

U-shaped valley formation is the preferred subject. The illustrative scene and
interaction are still for discussion, not an approved implementation brief.

<!-- expert-review -->

Valley glaciers can widen and deepen river-cut valleys into broad U-shaped troughs.
See [NPS: U-shaped valleys](https://www.nps.gov/articles/ushapedvalleysfjordshangingvalleys.htm)
and [Yosemite geology](https://www.nps.gov/yose/learn/nature/geology.htm).
These sources support the teaching topic; they do not validate a numerical model.

A discussion sketch: a textbook drawing becomes a naturally coloured valley with
ice moving through it. The reader can inspect how the valley profile changes and
reveal the land beneath the ice. An ice-visibility control is presentation only;
it must not imply instantaneous melting or reset the evolving terrain. Keep the
lesson on glacial valley reshaping rather than expanding to a whole glacial system.
The physical intervention/control and model law require a later agreed brief.

The current engine implements surface-water/hydraulic erosion, not glacier flow
and glacial erosion. Existing book/runtime work remains useful. A shared glacial
process capability and evidence are needed before claiming to simulate formation;
changing the water material to ice or interpolating a V into a U is insufficient.
The old prohibition on ice/new physics is reopened specifically for this owner-
selected subject, not permission for an unbounded new engine programme.

## Threads that run through every stage

1. **Learning through play.** One idea, primary gesture and visible consequence. Optional
   questions and explanations support curiosity; they never unlock the product.
2. **Scientific honesty.** Process-based landforms, truthful model scope, cited claims and
   expert review. A polished scene does not turn a failed experiment into a pass.
3. **Page ↔ model agreement.** Measurements, quantities, scale and time labels bind to the
   actual state/configuration. Visual gauges share that state. No independently authored
   animation or number may imply a result the model did not produce.
4. **Two levels, one model.** More depth changes presentation, not model state. University
   readers also deserve a legible book rather than a wall of diagnostics.
5. **Determinism and performance.** Fixed steps, seeded randomness, CPU/GPU comparison,
   responsive manipulation and appropriate fallbacks. A static fallback is identified
   honestly and still offers a readable explanation.
6. **Accessibility.** Keyboard equivalents to gestures, text alternatives to visual change,
   reduced motion, sufficient contrast, non-colour encodings and zoom/reflow.
7. **Engine ↔ book separation.** Hachure never imports Uplift; spreads use public primitives.
   Build a primitive because a lesson needs it, and prove it inside that lesson.
8. **Book craft.** Bounded composition, readable typography, meaningful ink and colour,
   real navigation, and a deliberate page-to-page rhythm.

## Tensions in the brief, and how the plan resolves them

Earlier T1–T9 references remain in historical Stage 1 briefs. Their technical decisions
are retained in the decision log and evidence; they are not the product's reading order.

- **T1 / T2 / T5:** conservative transport, CPU fallback and scoped determinism remain
  engineering obligations. This pivot does not change either solver.
- **T3 / T4:** bind displayed quantities; use the
  [education-first science policy](science/education-policy.md). Geological time or field
  rates require calibration only when those claims are made.
- **T6:** teach only what the model and its visual evidence support. Optional guesses may
  be informal, but revealed answers must still be justified.
- **T7:** changing reading depth preserves state and discloses non-default hidden settings.
- **T8:** a genuine flat diagram appears before the renderer is ready. Readiness may delay
  an unavailable action; prediction commitment may not.
- **T9:** thin contracts serve a complete playable spread. Engine completeness alone does
  not satisfy the product gate.

## What success means

The next milestone is a recognisable, inviting book with two small playable discoveries.
Later breadth—deltas, human geography, real data, more engine families and classroom
research—earns priority only after this experience works. Hachure's technical quality
supports Uplift's purpose: a reader plays, understands a little more, and turns the page.
