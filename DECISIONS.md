# Decisions and open questions

The group reviews this file. Append new entries at the end of the relevant section, newest last. Each
decision gives its reason, so it can be revisited when the reason stops holding.

Format: `D-NNN · date · stage/session · title`, then **Decision**, **Why**, **Revisit if**.

## Decisions

### D-001 · 2026-11-06 · S0 bootstrap · One monorepo with pnpm workspaces

**Decision.** One repository, two top-level workspace folders: `hachure/` (engine packages
`@hachure/terrain`, `@hachure/ink`, `@hachure/runtime`) and `uplift/` (`@uplift/book`, `@uplift/spreads`).

**Why.** The handoff says to build the first spread end to end and extract the engine from it as it
stabilises. During extraction, most changes cut across the engine and the book; one repo makes those single
PRs. The "Hachure never imports Uplift" rule is enforced by ESLint (`no-restricted-imports`), so the engine
can still be split out and published later without untangling.

**Revisit if.** Hachure is published as components in the group's wider GIS platform, or a second consumer
of Hachure appears. Then move `hachure/` to its own repo with history (`git subtree split`).

### D-002 · 2026-11-06 · S0 bootstrap · Licences: MIT for code, CC BY 4.0 for content (provisional)

**Decision.** Code is MIT. Educational content (`uplift/spreads/`, `docs/`) is CC BY 4.0. The repository is
public.

**Why.** The project lead asked for a public repository with a proper licence. MIT matches Three.js and keeps
Hachure easy to reuse in research and in the group's GIS ecosystem. CC BY 4.0 is the standard open
educational resource licence: teachers can adapt and redistribute spreads with attribution.

**Revisit if.** The group chooses an institutional licence (handoff "Open decisions"). Relicensing is easy
while the group holds all copyright, and gets harder once outside contributions arrive, so settle it before
accepting external PRs.

### D-003 · 2026-11-06 · S0 bootstrap · Packages export TypeScript source; one root typecheck

**Decision.** Workspace packages point `exports` at `src/index.ts`. Vite and Vitest consume the source
directly; `pnpm typecheck` runs one `tsc --noEmit` over the whole repo.

**Why.** No library build step means faster iteration while the APIs are still moving. A publishable build
(`tsup` or `vite build --lib`) is added when Hachure is first published.

**Revisit if.** Typecheck becomes slow (then switch to project references with `tsc -b`) or a package is
published.

### D-004 · 2026-11-06 · S0 bootstrap · TypeScript 6.0, not 7.0

**Decision.** Pin `typescript@6.0.3`.

**Why.** `typescript-eslint@8.72` supports TypeScript `<6.1`. TypeScript 7 (the native compiler) is out, but
type-aware linting does not support it yet.

**Revisit if.** typescript-eslint supports 7.x.

### D-005 · 2026-11-06 · S0 bootstrap · Stage → wave → session work model

**Decision.** Work is planned as stages (each closed by a group-reviewed gate), waves (run in order within a
stage) and sessions (run in parallel on git worktrees within a wave). Only the current stage is planned in
detail. See `docs/plan/README.md`.

**Why.** The handoff warns against engine-first drift and expects facts to change after real implementation.
Parallel sessions with owned paths and contracts merged first keep agents from colliding.

### D-006 · 2026-11-06 · S0 bootstrap · `@hachure/human` is not created yet

**Decision.** No placeholder package for the human/agent engine.

**Why.** It is out of scope for Demo 1. An empty package invites engine-first design. It is created in the
stage that builds its first spread (Von Thünen, roadmap phase 4).

### D-007 · 2026-11-07 · S1/W1/1A · Terrain contract: config, state layout, solver interface

**Decision.**

- `TerrainConfig` (`hachure/terrain/src/contract/config.ts`) is the one typed config. Beyond the brief's
  list it adds `pipeAreaM2` (virtual pipes need it), `thermalRatePerS` (slumping rate),
  `morphAccelerationFactor`, and the reader brush clamps `brushMaxHeightM`, `brushMaxDepthM`,
  `brushMaxRadiusM` and `brushMaxSlopeDeg`. `simYearsPerStep(config) = dtSimSeconds ×
morphAccelerationFactor / year` is derived, never set, so the time label is bindable (T4).
- **All defaults and limits are placeholders tagged `TODO(1E)`.** They let tests run and are not science.
  1E (or a follow-up) replaces them with cited values, and may rename fields by recording it here.
- `TerrainState` is struct of arrays: one `Float32Array` per layer, all views into one `ArrayBuffer` (one
  transfer to a Worker, one GPU upload). Row-major, `x` east, `y` south. Layer names carry their unit
  (`bedrockM`, `fluxEastM3PerS`, `suspendedSedimentM`, …). A state has exactly one outlet cell on its edge.
- `BudgetCounters` adds `toolNetM3` and `sourcedWaterM3`, so the budgets still close when readers dig or add
  springs. The closure equations are in the doc comment and are tested by the contract suite.
- `TerrainSolver`: mutating calls (`step`, `configure`, `reset`, `dispose`) are synchronous and ordered;
  reads (`snapshot`, `budget`, `hash`) and `applyTool` (it returns the clamp report) are async.
  **Deviation from the brief:** `configure(patch)` is added, because sliders change parameters live without a
  reset. `reset(preset, seed)` takes a `TerrainPreset` object (`id` + deterministic `create`), so 2B owns
  presets without the solver knowing them.
- **Probes are pure functions of a `StateSnapshot`** (2F implements them), not solver methods. Every backend
  gets the same probes, and `snapshot({ layers })` keeps GPU readback small. Revisit if 1B shows full
  readback at the probe cadence is too slow; then add a region option to `snapshot`, not per-probe methods.
- `hashSnapshot` (FNV-1a, two 32-bit lanes over the step count and every layer's bytes) is the one digest
  for `hash()`, so hashes compare across backends.
- `@hachure/terrain/testing` exports the fake solver and `describeTerrainSolverContract`, the suite every
  backend runs. It imports Vitest, so it is a test-only entry point.

**Why.** Thin contracts written from Demo 1's needs (T9), with budgets and determinism testable from day one
(AC2, AC4) and GPU readback behind an async interface (T5).

**Revisit if.** 1E's parameter table or 1B's readback numbers disagree with these shapes.

### D-008 · 2026-11-07 · S1/W1/1A · Spread schema v0 and the binding rule

**Decision.** `hachure/runtime/src/schema/` holds spread schema v0 and `validateSpread`. Changes from the
handoff draft:

- **Engine-agnostic.** The runtime never imports an engine. Parameter names, tool kinds and probe kinds are
  strings, checked against an `EngineCatalogue` the caller passes (2D builds the terrain one from
  `@hachure/terrain`).
- **No typed numbers in scene labels.** `scene.timeScale.label` and `scene.scaleBar` are gone: the runtime
  derives them, and text binds `{{scene.timeScale}}` and `{{scene.scaleBar}}`. Other scene keys:
  `simYearsPerRealSecond`, `simYearsElapsed`, `metresPerCell`, `terrainWidthM`, `gridSize`. Durations a
  question mentions are declared in `scene.durations` and bound as `{{scene.duration.<id>}}` (T3).
  `scene.stepsPerRealSecond` and `scene.seed` are added; the preset id no longer carries a grid size, which
  comes from the device tier.
- Bindings are `{{probe.<id>}}` (scalar probes only), `{{control.<id>}}` (slider and speed values) and
  `{{scene.<key>}}`. Probes declare `shape: "scalar" | "series"`, an optional result `field`, a unit and
  significant figures.
- `LevelText` always has both `hs` and `uni`. `page.left` is renamed `page.body`. `ignores` is per level.
  Key words, options and labels are `LevelText`.
- Controls: `slider` (engine param, clamps, step, default, unit), `brush` (tool, radius and strength
  clamps), `speed`, `action` (`play-pause`, `reset`, `step`), each with level visibility.
- `ChallengeCheck` is `probe-threshold` (with `sustainSimYears`) composed with `all` / `any`. The challenge
  declares its stamp.
- `predict.answerEvidence` names the qualitative test that backs the answer (T6). Optional in v0, expected
  before expert review.
- **Typed-number rule** (used by the validator; 2D's `no-typed-numbers.test.ts` should reuse
  `findTypedNumbers`): after removing bindings, any digit run is a typed number unless it follows a letter
  (CO2, H2O) or is the word 2D or 3D. It applies to every page-visible text, including questions, options,
  labels and ignores. **Equations (TeX) are exempt**: constants are part of the law; live parameter values go
  in the text as bindings.

**Why.** Page and model agree (AC6) and the level toggle never touches the model (AC8), enforced
mechanically, while keeping Hachure's runtime free of engine imports.

**Revisit if.** Stage 2 freezes schema v1, or the language decision makes `LevelText` per-locale.

### D-S1-1B · 2026-11-07 · S1/W1/1B · Managed WGSL compute and CPU fallback

**Decision.** Start 3C with explicit WGSL arithmetic through `wgslFn`, using three
r187 `WebGPURenderer` for storage and dispatch. Start WebGPU at 256²; 512² remains
experimental. Keep the fallback chain CPU Worker at 128² plus WebGL2 rendering,
then 64² if the real solver requires it, then flat drawing only. Begin asynchronous
probes at 2 Hz, at most one readback in flight; permit 4 Hz after integrated profiling.
Keep full-state readback off the frame loop. Budget reductions use a fixed binary
tree with one writer per output and no float atomics; verify production accuracy
with the mass test.

**Why.** The Intel Arc 140V headless Chrome fixture passes CPU agreement and
same-device bitwise replay for TSL and WGSL at 256²/512². WGSL measured 0.114/0.310 ms
per five-kernel step. Probe readback costs about 3 ms even for 1 KiB. A fixed-tree
GPU sum matches an f32 CPU tree bitwise. The CPU Worker fixture at 128² measured
0.504 ms/step. Forced WebGL2 compute emulation runs but fails CPU agreement for this
neighbor stencil, so it cannot replace the CPU fallback. These are fixture results,
not full solver performance or scientific validation. See
[1B evidence and proposed brief corrections](docs/spikes/1B-gpu-compute.md).

**Revisit if.** The actual solver exceeds the frame budget, the full-state layout
hits storage-binding limits, managed dispatch prevents needed control, or a repaired
WebGL2 path passes comparison. Independent raw-device WGSL and device/buffer interop
were not benchmarked. Repeat in visible Chrome stable on classroom hardware at 5A.

### D-1C · 2026-11-07 · S1/W1/1C · Geometry contours and a shared flat projection

**Decision.** Start 2C with geometry contours and sparse downslope hachures. Generate SVG and 3D contours
from the same piecewise-linear surface and use one orthographic projection at zero exaggeration. Hide
hachures and quantity overlays for the SVG-to-canvas crossfade; then lift original heights. Reduced motion
completes the handoff without animation. Palette proposal: paper #FAF8F2, ink #292B2C, water #0072B2,
sediment #B57900, with labels and an interrupted sediment pattern.

**Why.** The runnable spike compares geometry against derivative-based shader isolines and downslope
hachures against parallel hatching. Geometry provides explicit index weights and shared SVG endpoints.
Shader submission is cheaper in this small fixture, but target-GPU cost is unmeasured. The spike uses
triangle intersections rather than marching squares to match mesh topology; 2C must preserve this or
share a tested saddle rule. Evidence and limitations: `docs/spikes/1C-ink-look.md`.

**Revisit if.** Larger-grid profiling shows contour extraction or transfer exceeds the frame budget,
WebGPU integration changes line quality, or projector review needs heavier lines. 1B owns backend choice;
this dependency-free WebGL2 spike does not decide it.

## Open questions

Carried from the handoff ("Open decisions for the project lead"). The stage that needs each answer is noted.

- [ ] **Scientific sign-off owners** per domain. _Needed by Stage 1, wave 5_ (Demo 1 gate requires expert
      sign-off).
- [ ] **Learning-outcome instrumentation** in Demo 1 (anonymous interaction logs, pre/post quiz). _Decide
      before Stage 1, wave 4_. It changes the runtime's event design.
- [ ] **Domains and trademarks** for Uplift / Hachure (for example uplift.earth). _Before any public launch._
- [ ] **Curriculum alignment** for high school: which national or exam curricula first. _Needed by Stage 2._
- [ ] **Languages:** English only for demos, or bilingual from the start. _Decide before Stage 2._ Bilingual
      text changes the page text format, so decide before the schema is frozen.
- [ ] **Licence and distribution** (see D-002; the current choice is provisional).
- [ ] **Publishing Hachure** as shareable components in the group's GIS ecosystem platform. _Stage 2 exit._
- [ ] **Real DEM source** and default demo region. _Needed by Stage 3._
- [ ] **Book UI technology:** DOM pages or canvas page texture. _Resolved in Stage 1, wave 1 (session 1D)._

<!-- expert-review -->

### D-009 · 2026-11-07 · S1/W1/1E · Science conventions and pending calibration

**Decision.** Adopt the draft science specification in `docs/science/` for review:
solid-volume-equivalent sediment stocks; conservative donor face fluxes; hardness
acting on exposed bedrock; loose-layer slumping; dry-cell sediment deposition.
Keep 1A's parameter names. Normalise capacity with explicit reference thickness 1 m
and speed 1 m/s so its coefficient remains dimensionless. Propose capacity 0.01 and
evaporation fraction 0.00001 per default step, replacing 1A's provisional placeholders
when 2A implements the real solver. This session changes no parallel contract files.

**Why.** Sediment transport and dry guards must conserve solid material, and units
must agree with the typed stock layout. Engineering defaults/clamps are distinguished
from measured quantities. The six documents give executable test definitions rather
than asserting that an unbuilt solver already produces the desired landforms.

**Revisit if.** 2A stability tests, 3B validation or domain review reject the proposed
discretisation or parameter envelope. Record the change and rerun paired seed tests.

**Open coordination.** Interpret `morphAccelerationFactor` as a landscape-clock mapping,
not a second multiplier in hydraulic/erosion updates; reconcile 1A's comment before
implementation. Its value 1 is uncalibrated metadata, not an approved geological clock.
3B derives the factor from measured incision and an expert-approved erosion context;
until then suppress numeric landscape years. The university stream-power relation is
comparative theory: do not label `erosionRatePerS` as its K. The persistent slope-break
challenge is a waterfall proxy, not resolved falling-water physics. Original M07
full-text retrieval remains open; the accessible S08 paper was inspected for the
pipe/capacity/slippage construction. See the sources register for verification limits.
