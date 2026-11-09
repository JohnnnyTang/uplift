# Playable book contracts — session 5A

Status: 5A feasibility and executable adapter review complete; frozen for dependent implementation after merge. This specifies
shared boundaries for 5B/5C/5D; it does not claim the default app is migrated.
The authoritative product gate remains PB1–PB8 in the realignment plan.

## Composition

The characteristic object is the contour drawing rising from a paper page. Keep
all chrome subordinate to that object. Use the existing Ink palette: paper
`#FAF8F2`, ink `#292B2C`, water `#0072B2`, sediment `#B57900`. Water and sediment
appear only when they represent the named quantity, with a legend and non-colour
cue. Selected contours use heavier ink plus a bound label, not another colour.
A neutral desk and restrained page contact shadow distinguish paper edges;
no decorative gradients, glow, cards or dashboard framing.

Use Georgia for readable book text and headings, system sans-serif for controls.
Body text starts at 18 CSS px with 1.5 line height; supporting text at 16 px.
Use a modest 28–36 px title, left aligned. Do not shrink typography to pass a
viewport test. Keep paragraphs around 35–55 characters wide.

At 1366×768 and 1440×900, compose a centred open spread with page width:height
near 0.9:1, a narrow visible gutter, outer edges and quiet folios. Budget roughly
1100–1200 px total width and 600–660 px height, adjusted to the available reading
area. These are layout targets, not minimum sizes or simulated measurements.
The right page is dominated by a roughly 480×420 px scene, at least two thirds
of its usable area. The left page holds the invitation and reflection. A flat
drawing must be readable in the same scene region before renderer readiness.

```text
┌────────────────────────┬─────────────────────────┐
│ Short title            │                         │
│ One invitation         │   Actual illustration   │
│                        │   with object handle    │
│ Optional question      │                         │
│ Reveal explanation     │   Quantity / scope      │
│ Sources • Go deeper    │   Pause • Reset         │
└────────────────────────┴─────────────────────────┘
             Previous    page position    Next
```

Initial copy budget per spread: title up to six words, invitation up to thirty,
optional question up to twenty, answer up to sixty. These are editorial limits,
not reasons to remove a necessary limitation. Put tier, applicable scale and
uncalibrated scope beside the scene; do not introduce a clock for static geometry.
Keep one primary gesture and at most one optional condition control visible.
Teacher notes, equations, parameters and diagnostics belong in disclosures.

A short answer opens within the reserved left-page space. Long depth/source
content opens a clearly labelled reading surface with a return control and
restored focus; it must remain available with keyboard and at large text sizes.
Never hide overflow to conceal an overlong answer.

Below the width needed for readable paired pages, use a single-page sequence:
explanation → scene → next spread's explanation. Label controls with destination,
not only arrows. Keep a scene shortcut available from the explanation and a
return-to-explanation action on the scene. At 390 px, 200% zoom and 320 CSS px
reflow, allow vertical scrolling and natural height; remove fixed aspect/height
constraints. The text must not require horizontal scrolling. Preserve scene and
presentation state across responsive layout changes.

## Navigation and ownership

The shell owns active spread/page, browser history, transition, focus and input
arbitration. The controller owns the real model, source mutations, object gesture
and scene presentation. A level change is presentation-only. Navigation and
reveal never inspect answer correctness, simulation endpoints or rewards.

On a turn, stop accepting scene mutations, await pause-and-settle, then animate
the outgoing page while its settled scene is still attached. Detach after the
transition, mount the retained destination and resume its previous play intent.
Initial static geometry needs no scheduler. Retain at most the two lesson
instances; hidden instances never step. Retain solver precision and fixed-step
state, not only HostSample. Do not accumulate a wall-clock gap on return.
Research entry first settles the book; returning within the app preserves book
state. A full reload starts authored defaults and makes no persistence promise.

One turn runs at a time. Coalesce repeated requests to the latest destination;
never enqueue multiple animations or recreate controllers for repeated clicks.
Use a transition generation token so stale completion cannot activate a page.
Disposal settles/cancels work before destroying resources. Context/device loss
leaves a labelled meaningful flat drawing and explanation; it must not silently
restart the model or report a live process in a static fallback.

Previous/next buttons always work by keyboard. PageUp/PageDown may navigate only
when the target is outside fields, editable text, controls and the scene gesture
surface. Object drag/pointer capture owns its gesture until pointerup/cancel;
a turn request during it waits or is ignored, never steals the drag. Wheel/swipe
navigation is omitted initially: preserve native scrolling and zoom.

Before hiding a page, save focus by semantic control id. On first entry, focus
the destination heading; on return restore a still-visible prior control, else
the heading. Never restore focus into a closed disclosure. Hidden pages are
inert and absent from the accessibility tree. Announce the destination once in
a polite live region. Reduced motion uses immediate page replacement after
settlement and direct lift updates without automatic interpolation. It does not
alter the numerical model or require an answer.

## Reset and presentation

Presentation stores level, absent/unanswered/answered prediction, explanation
visibility, lift and selected object independently from model state. Navigation
is shell state. A selected source is not an instruction to move the model source.

An explicit reset restores authored model/config/source defaults and pauses.
Restore authored lift/selection, clear a supplied question to unanswered (or
retain absent), and close the explanation. Keep the reading level and current
page. Announce reset without moving focus off the reset button. Returning to a
spread preserves all these states; changing level preserves the exact settled
model. If an advanced non-default setting becomes hidden, disclose it with an
explicit restore action rather than resetting behind the reader's back.

## Routes and compatibility

- `/` becomes the new book in 5E; 5A does not change production mounting.
- `?view=research` mounts the retained valley research example, with a visible
  return-to-book control. Unknown `view` values fall back to the book.
- Preserve `backend=webgpu|cpu-worker|cpu-64|flat` and `debug` across route changes.
  Research keeps the current selection/fallback behavior. Static geometry ignores
  hydraulic backend choice except `flat`, which forces the labelled flat fallback;
  do not launch a solver to honour a static-scene backend parameter. Live water,
  if selected, uses the shared selector. Debug is explicit and off by default.
- Development fixtures live under `e2e/fixtures/` or the standalone
  `spikes/playable-book/` Vite entry. They are not default routes or scientific
  examples and must not be exposed through a production fixture query parameter.
- New reader lessons do not extend instrumentation event schema v1. Research
  logging remains opt-in and confined to its actual recorded-rain scope.

Existing mandatory schema/callers remain runnable during migration. The optional
reader schema must validate every supplied text/binding, control and challenge;
absence must not be implemented with dummy content or by disabling validation.
5B implements the new lifecycle and quiescence. 5C consumes the shell contract.
5D supplies real scenes and sourced, expert-review draft claims. 5E migrates all
production callers and removes or inventories temporary compatibility adapters.

## Acceptance responsibilities

5A's recording is exploratory capability/readability evidence only. 5D must
register and validate the precise taught claim. 5F must test the actual integrated
routes, phone/zoom layouts, context loss, rapid navigation, keyboard, motion and
settled state preservation. Human discoverability, listening, scientific review
and target hardware performance remain separately pending until performed.

## Executable interface map

The public `@hachure/runtime` entry exports `ReaderSpread`,
`validateReaderSpread` and `ReaderSceneController`. Legacy `Spread` and
`validateSpread` retain their strict existing shape until migration. A static
`ReaderSceneSpec` has no step rate or geological durations; a live process
explicitly declares calibrated or uncalibrated time. Binding checks remain active.

`ReaderSceneController.status()` and its immediate `subscribe` notification expose
readiness, active object gesture, activity and attachment. The shell listens for
these changes instead of inferring readiness from a prediction or polling canvas
pixels. An error is distinct from loading and from a labelled flat fallback.
`ReaderSelection` uses terrain-plane `xM/yM`; Ink maps plane y to world z.

The book contract has `ReaderEntry` (spread plus scene factory),
`ReaderShellController`, `ReaderNavigation` and `ReaderTurnRequest`.
`READER_SCENE_LIMIT` fixes the retained lesson count. Navigation page values
`spread`, `text` and `illustration` represent paired versus phone composition;
resizing remaps the visible page without replacing the retained scene instance.
Fixture controllers under `uplift/book/src/reader/fixtures` are wiring tools only,
not science and never a production fallback.

## Authored terrain initialization boundary

The water trial uses a prepared small domain, not the valley host's fixed domain.
`AuthoredTerrainInitial` is a terrain-specific public contract, kept outside the
engine-agnostic spread schema. It carries id, exact grid/cell size, outlet, initial
bedrock/sediment/hardness arrays and authored spring/rain sources. It is initial
condition data, not an ongoing simulation checkpoint or a scripted water route.

5B adds optional authored initialization to the shared host protocol, Worker
engine and solver transport. Validate matching array lengths, finite values,
nonnegative sediment, configured hardness range, a valid edge outlet, matching
grid/cell size and unique source ids. Clone accepted arrays so caller mutation
cannot change a later reset. Build a local TerrainPreset wrapper in each backend:
allocate fresh state, copy authored terrain, leave water/flux/velocity zero and
apply initial sources once. Functions never cross the Worker boundary. Existing
calls without authored initialization keep their current valley behavior.

For authored input, backend selection preserves its exact domain and physical
configuration across GPU/Worker/CPU tiers rather than substituting the legacy
1280-metre domain. A low-capability path may use the labelled static fallback;
it must not silently resample into a different lesson. Cache identity includes
initial data, not merely the backend/seed. 5D supplies the immutable input through
its scene adapter; it does not edit terrain solver code or build its own host.

Reset reconstructs these initial conditions and restores authored configuration
and source arrangement. Moving a stable-id source replaces it, reports clamps,
and preserves existing water. A selected new source is not an implicit reset.
Authored samples must not expose the valley's fixed-source long profile or
incision baseline as evidence about the moved source. 5B makes those diagnostics
explicitly unavailable in authored mode; 5D derives the lesson cue directly from
its water snapshot. 5E keeps the legacy research diagnostics unchanged.

These are bounded host/adapter changes assigned to 5B and 5D, not delivered host
behavior in 5A. Their integration tests must cover authored init/reset/source
replacement in Worker and CPU/GPU paths and verify matching numerical results.

Preserve authored `pipeAreaM2` as well as grid/cell size; replacing it during
backend selection changes the tested physics. Source-marker bindings publish
accepted/clamped positions, never merely the requested pointer coordinates.
Pure presentation changes remain available while detached, loading or in fallback;
only model actions depend on readiness. On a phone explanation page the hidden
illustration must settle too; returning resumes its previous play intent.

## Fixed lesson sequence

The exploratory real-renderer trial selects `cartography.contours` followed by
`hydrology.water-path`. See [feasibility evidence](feasibility/README.md), including
the pale first encoding retained beside the final clearer depth encoding.

| Lesson                   | Intended claim for 5D to source and validate                                       | Primary action                                                | Actual cue                                                                                 | Truthfulness risk                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Lift a map               | A selected contour belongs to the same elevation geometry in flat and lifted views | Drag the attached ring vertically; keyboard lift equivalent   | Same extracted contour, heavier/dashed ink, bound elevation and declared view exaggeration | Presentation exaggeration must not be mistaken for changed elevation                                         |
| Where will the water go? | Source location changes the wet route on this prepared fixed terrain               | Place/move the stable-id source; keyboard position equivalent | Real water-depth colour plus wet-cell ink marks; old water remains visible                 | This does not establish a general catchment/outlet rule, erosion, field time or a validated learning outcome |

The slope alternative is not selected. The water rendering is legible with a small
adapter and the authored initialization boundary above; no solver extension is
needed for the observed result. 5D still supplies prospective science checks and
final sourced expert-review draft copy. The trial's manual fixed-step advance is
an exploratory control, not a second required primary gesture for the production
lesson. 5B/5D should make ordinary placement start/resume visible flow, while
reduced motion keeps explicit advancement available without mandatory autoplay.

The additive 5B API signatures consumed by 5D are fixed as follows (implementation
is deferred to 5B):

```ts
// Existing parameters/calls remain valid.
BackendSelectionOptions.initial?: AuthoredTerrainInitial;
// Added to the existing kind: "init" HostCommand member:
initial?: AuthoredTerrainInitial;
SimHost.initialize(config, calibration?, initial?): Promise<void>;
backendConfig(backend, config?, initial?): TerrainConfig;
createFlatTerrainSample(config?, calibration?, initial?): Promise<HostSample>;
```

Use the existing parameter types and add `AuthoredTerrainInitial` for each new
`initial` parameter. The selector forwards the same initialization to every
transport and flat sample helper. Flat fallback draws this authored scene,
not an unrelated valley. 5B makes authored diagnostics unavailable explicitly
without requiring legacy consumers to pretend their values exist.

Page text uses the controller's readonly `bindings.render` and
`bindings.subscribeText` facade. Geometry quantities (selected elevation, contour
interval and vertical view scale) are declared scalar probes validated against
the scene's catalogue. 5D publishes values from its geometry/configuration; 5C
subscribes and unsubscribes with the page. `navigate(ReaderTarget)` handles absolute
history/content destinations and coalesces to the latest destination during a
turn or captured gesture. A superseded request resolves false. Relative `turn`
requests compute from the currently displayed page, never queue extra turns.
