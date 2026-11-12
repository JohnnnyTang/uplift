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

### D-010 · 2026-11-07 · S1/W1/1D · DOM book pages with an embedded terrain canvas

**Decision.** Close the "Book UI technology" open question in favour of semantic DOM pages.
Keep reading text, KaTeX HTML/MathML, predictions, disclosures and controls in the DOM; embed the
terrain canvas inside the right page. Use CSS for paper, gutter and shallow book perspective.
Stack pages at tablet widths and allow vertical scrolling, including at projector height.
This entry resolves the earlier unchecked open-question item without rewriting its history.

**Why.** The runnable study at `spikes/book-shell/` meets the open-book visual direction while retaining
native selection, focus and responsive reflow. Keyboard checks and the browser accessibility tree
support this choice; a human screen-reader listening check is still pending. Both levels were checked
at laptop, projector, tablet and mobile sizes. Equation visibility changes leave the drawing and
committed prediction unchanged. Evidence, limitations and tokens for 2E are in
`docs/spikes/1D-book-shell.md`. The canvas is explicitly a mathematical fixture, never a process model.

**Revisit if.** Real terrain integration makes CSS perspective unsuitable, or a later page-turn
interaction needs decorative textures. Keep semantic DOM content even if those decorations change.
Do not compress university text into a fixed-height projector page.

<!-- expert-review -->

### D-2B · 2026-11-08 · S1/W2/2B · Seeded RNG, the tilted-plateau preset and brush tools

**Decision.**

- **RNG.** `createRng(seed)` is xoshiro128\*\* seeded through SplitMix32 (`hachure/terrain/src/rng`).
  `deriveSeed(seed, label)` gives an independent stream for each use, so a new draw in one place never
  shifts another. ESLint bans `Math.random` in `hachure/terrain/**` (`no-restricted-properties`), and a
  test lints a probe file to prove the rule fires.
- **Preset metadata.** `TerrainPreset.create` returns only a state, but model.md needs the outlet's base
  level "in the preset metadata" and the probes need the declared river source. So presets may add
  `layout(config): PresetLayout` (outlet, open face, `baseLevelM`, the source as a ready-to-apply
  `SpringOp`, and its cell). The 1A contract is unchanged; `PresetWithLayout extends TerrainPreset`.
- **Geometry.** `tilted-plateau` implements the common protocol of `docs/science/validation-spec.md`
  (5° south-falling plane, cross curvature 0.0002 /m, 1 m loose layer, hardness 0.2, a 0.1 m³/s spring at
  the reference grid's row 8, south-centre outlet). Slope is the typed preset option `slopeDeg`, limited to
  1–10° (parameters.md). Optional east–west `hardBands` give the AC3b geometry without a second preset.
  The 0.01 m perturbation is bilinear noise on a fixed lattice of 128 intervals per side. That keeps it
  resolution-independent, but it is smooth over two cells at 128² rather than independent per cell.
  It has zero mean over lattice nodes and is bounded by the amplitude.
- **Grid-size independence.** Everything is a function of position as a fraction of
  `L = gridSize × metresPerCell`. **The same landscape at 128² and 256² therefore needs the same L:**
  128² × 10 m and 256² × 5 m are two samplings of one 1280 m catchment (tested: 2×2 block means agree to
  within 2 mm). 256² × 10 m would be a different, larger landscape. The id is `tilted-plateau` for every
  grid and option set; options are readable on `preset.options`, and calibration metadata should record them.
- **Raise adds loose sediment, not rock.** This follows parameters.md ("Add loose sediment"). It differs from
  the `RaiseOp` doc comment ("Adds rock") and from the fake solver, which raises bedrock. Both are 1A-owned
  and left unchanged. Dig and smooth remove sediment before bedrock. Smooth deposits as sediment, and harden
  writes hardness only. Water and suspended sediment are never touched.
- **Slope clamp.** The whole edit is scaled by one factor so that no cardinal neighbour pair of ground cells
  ends steeper than `brushMaxSlopeDeg`. A pair that is already steeper may be eased but not steepened.
  The factor scales the full brush profile, so the brush keeps its shape and smoothing stays conservative.
- **Radius.** The radius is clamped to `[metresPerCell, min(brushMaxRadiusM, L/4)]` (parameters.md).
  Clamping up to one cell also reports `"radius"`, although the `ClampReason` comment says only "above".
  An empty range disables the brush (`applied: false`, `"radius"`). `brushRadiusRangeM` exposes the
  range so that controls can bind to it.
- **Bad inputs throw.** NaN or infinite values, negative height or depth, a radius ≤ 0 and smooth strength
  outside [0, 1] throw `RangeError` rather than clamping silently: no control produces them, and
  `ClampReason` has no code for strength.
- **Volume.** `volumeChangeM3` is measured from the stored float32 values, summed in float64. A solver that
  adds it to `toolNetM3` keeps its solid budget exactly closed. Smooth conserves volume up to float32 storage
  rounding, and its report carries that residue.

**Why.** Determinism (AC2), input clamping with an acknowledgeable report (AC9), and one implementation of
the validation setup that 2A, 2F, 3A and 3B reuse. The API is small because 2A and 3A consume it next.

**Revisit if.** The lead chooses a larger domain for the 256² tier. In that case the "same landscape"
requirement changes, and 4A must recheck `pipeAreaM2` (candidate `0.2 × metresPerCell²`) and the CFL
guards at 5 m cells for this design. Also revisit if expert review changes the protocol geometry or
the material rules for the tools, or if replay has to be bitwise across JavaScript engines. The preset
and brushes call `Math.tan`, `Math.cos` and `Math.hypot`, whose last bit the spec does not fix; the
RNG is pure integer arithmetic. Recommended 1A follow-up: change the `RaiseOp` comment to "adds loose
sediment", and let the fake raise sediment.

<!-- expert-review -->

### D-2F-001 · 2026-11-08 · S1/W2/2F · Pure metrics and explicit snapshot limits

**Decision.** Implement the draft metrics in `docs/science/validation-spec.md` as
pure snapshot helpers, exported with one additive terrain entry-point line. Keep
new helper contracts in the owned `src/probes/` directory. D8 accumulation fallback
retains the declared spring and reports its method and incomplete path; equal-height
routing strictly decreases row-major index, and pits are never filled or breached.
Cell-spaced channel profiles omit a sub-cell terminal remainder. Persistence takes
explicit approved-calibration status and a scheduled observation history; it never
infers approval from a numeric snapshot clock.

**Why.** Metrics must be identical for validation, graphs and challenge consumers,
and incomplete/unresolved cases must not become plausible-looking scientific results.
The implementation follows the cited draft definitions; tests are synthetic arithmetic
fixtures, not scientific validation or expert approval. See `src/probes/README.md` in
`hachure/terrain/` for precise conventions and limitations.

**Contract limitation / follow-up for 3A and 3B.** Point water discharge is outgoing
pipe throughput. The snapshot lacks actual limited sediment face transfers and the
pre-transport donor stocks, so the public point sediment field is explicitly an
instantaneous `Q × suspended/water` estimate. Cumulative export counters remain the
budget authority. A future exact point/reach-face transport diagnostic needs an
additive solver contract and must not silently substitute this estimate in AC3c.
No other session's unmerged solver, preset or renderer is used.

**Not done.** Real-solver validation, calibrated persistence and stamp integration
remain with 3B/4C. Sediment injection requires its own explicit source term before
budget residuals can support it. Scientific expert sign-off remains pending.

<!-- expert-review -->

### D-2A-1 · 2026-11-08 · S1/W2/2A · CPU reference solver: float64 state, enforced guards, wave-guard finding

**Decision.**

- `createCpuSolver(config, preset, options?)` (`hachure/terrain/src/cpu/`) implements `docs/science/model.md`
  stage by stage. Its **authoritative state is float64**; the contract's float32 layers are a mirror,
  refreshed before `snapshot()` and `hash()`. Per-step erosion at the default parameters is about
  10⁻⁶–10⁻⁵ m, below half a float32 ulp at 128–256 m elevation (7.6×10⁻⁶ m): stored in float32 it is
  rounded away and the solid budget stops closing. `hash()` still digests the float32 mirror, so AC2 holds
  bitwise. A step is computed into separate buffers and committed only when every value is finite and every
  stock non-negative; otherwise the state is untouched and the solver pauses with a diagnostic.
- The solver enforces the admissible ranges of `parameters.md` (`CPU_ADMISSIBLE_RANGES`) on top of the
  contract's sanity limits, plus the joint guards: reaction, slump, evaporation in [0,1) with its upper
  bound rescaled for other time steps, a brush radius of at least one cell, and a config-level **pipe-wave
  guard** `dt × 2 sqrt(g A / l) / l ≤ 0.5`. The last one is ours: linearised, the virtual-pipe update is a
  symplectic-Euler wave scheme with celerity `sqrt(g A / l)` (from `dq/dt = A g ΔH / l`, `dh/dt = −Σq / a`),
  so `A / l` acts as an effective depth in model.md's wave guard [FV, SW]. A kernel test shows sloshing
  growing at A = 100 m², l = 1 m (Courant 3.1) and staying bounded at A = 0.2 m². Defaults pass at 10 m and
  5 m cells (2B runs 256² at 5 m), and the candidate scaling `A = 0.2 l²` passes at every admissible cell
  size. `gridSize` admits 8–512 (the fixture allowance in parameters.md). `dtSimSeconds` may change only at
  step 0 ("fixed per run"). The constants and guards are exported from `@hachure/terrain` so the GPU
  solver uses the same ones.
- **Wave guard deviation.** model.md says to pause when
  `dt[(|u|+√(gh))/l + (|v|+√(gh))/l] > 0.5`. The default `waveGuard: "report"` policy instead counts each
  violation in `diagnostics()` and keeps running; `"halt"` implements model.md literally and is tested.
  Reason: the pipes have no friction, so on a slope thin flow accelerates until the donor limiter drains a
  cell in one step. For such a cell model.md's velocity is exactly `u = l / dt`, so its Courant number is 1
  **whatever `dt` is**. Under `"halt"` the validation-spec catchment with its 0.1 m³/s spring stops at
  step 1. A smaller step cannot help, so model.md's "rerun at a smaller fixed step" remedy does not apply.
  Non-finite values and negative stocks always halt.
- **Scientific consequence (open, needs 1E/expert and 3B).** Capacity is proportional to that limiter speed.
  On the 64² catchment at default parameters, 1000 steps (50 s of hydraulic time) gave peak speeds of 200 m/s
  (`l/dt`), suspended stocks up to 1.2 m while the deepest water anywhere was 2.6 cm, 5.4 m of bedrock cut,
  and 27 400 m³ of exported
  sediment from 62 m³ of water input. At `dt = 0.01` the same 50 s gave 1000 m/s and 19 m of cut, so results
  depend on `dt` and do not converge. The budgets close and nothing goes non-finite, but magnitudes from
  this discretisation are not meaningful, and calibration (time-scale.md) would inherit the `dt` dependence.
  Options for the science owners: a momentum sink in the pipe update (for example Manning friction; the
  handoff lists Manning's equation as physical law), or a different velocity or capacity definition. 2A
  does not add one, because that would be new science.
- **Raise adds loose sediment**, following parameters.md. 2B's brush tools do the same. 1A's `RaiseOp`
  comment ("Adds rock") and the fake solver (adds bedrock) disagree; their owner should align them.
- The brush ops in `cpu/tools.ts` are a **swappable placeholder** for 2B's `applyBrush(state, op, limits)`
  (PR #8). To swap: run `applyBrush` on the synced float32 mirror, copy back only the cells it changed, and
  add `volumeChangeM3` to `toolNetM3` (the solver already does this for every tool). Copying back every cell
  would round the whole float64 state to float32. Source ops (spring, rain-source, remove-source) stay in the
  solver.
- The outlet's receiving water surface is the outlet cell's ground at reset (`outletBaseLevelM`), on the face
  chosen by model.md's south/east/north/west priority. When 2B's optional `TerrainPreset.layout()` lands, read
  `baseLevelM` from it and assert its face matches.
- The test fixture `cpu/test-fixtures.ts` builds the validation-spec catchment only because 2B's preset and
  RNG are not on main. 3B must use 2B's preset.

**Why.** Brief 2A requires model.md's process model with enforced ranges and guards, bitwise determinism,
budget closure and no NaN. Implementing it literally showed the wave guard cannot be met. The principles say
to report that honestly rather than hide it or invent a fix.

**Revisit if.** 1E or a domain expert revises the pipe update or velocity (then re-decide the wave-guard
default, and probably restore `"halt"`), 3B finds the magnitudes usable after recalibration, or 2B's
`applyBrush` and `layout()` land on main.

**Fact for 3C/4A.** A GPU solver storing absolute bedrock elevation in plain float32 will lose per-step
erosion to rounding (see above). It needs a split representation (for example the initial elevation plus a
float32 change layer, or a local datum). The CPU–GPU comparison should expect differences from this.

### D-2C-1 · 2026-11-08 · S1/W2/2C · Ink renderer v0: shared triangulation, one projection, one lift uniform

**Decision.**

- **Contours are marching triangles over the mesh's own triangulation** (`hachure/ink/src/topology.ts`).
  Each grid square splits along the diagonal whose end samples differ least in height (a tie takes the
  north-west to south-east diagonal). The mesh index buffer, contour extraction, hachure placement and
  surface sampling all call the same function on the same float32 heights, so saddles are resolved
  identically everywhere. Tests check that every contour segment lies on the uploaded mesh at its level
  across a saddle-filled field, and that a contour from the other diagonal would fail that check.
  Segments join into polylines through the mesh edge they cross (topological, not by coordinate matching).
- **Two entry points.** `@hachure/ink` (contours, `toSvg`, projection, hachures, palette, lift sequence)
  imports no three.js, so the page can paint the flat SVG first (T8). `@hachure/ink/view` holds
  `createInkView` (three r187 `WebGPURenderer`, TSL, automatic WebGL2 fallback, or forced by option).
- **One projection, fixed during the lift.** `createProjection(frame, pose, viewport, reliefScale)` drives
  both the SVG and the 3D camera (tested against three's `OrthographicCamera`). The frame (datum and relief
  headroom) is taken from the first state and fitted to the fully lifted terrain, so the camera never
  moves while exaggeration changes and the SVG lands on the canvas's pixels.
- **One `exaggeration` uniform.** Every layer (fill, contours, hachures, edge) lifts its points through the
  same shader function and uniform, so layers cannot drift apart. `reliefScale` is a display multiplier
  for full lift; `InkView.verticalExaggeration` exposes the scale shown so the page can bind it.
- **Strokes** are instanced screen-space quads with mitred joints and analytic anti-aliasing whose coverage
  is converted so a stroke over paper matches the browser's sRGB-blended SVG stroke. Vertices closer than
  0.05 cell are dropped from both the SVG and the 3D strokes (`drawnPoints`). Four-sample MSAA alone
  rendered 0.9 px contours as visible dashes.
- **Quantity channels** read per-sample vertex attributes (water depth, and suspended sediment by default)
  with linear opacity ramps over paper. Sediment also carries interrupted screen-space stripes. Ramp
  limits are display settings, exposed through `legendTokens()` so a page binds them.

**Evidence** (headless Chrome 156, integrated Intel GPU reporting `xe-2lpg`, fake solver at 256²; a renderer fixture, not a
benchmark): both backends render at exaggeration 0, 0.5 and 1 with no console errors; 100% of ink pixels
in the flat SVG lie within 1 px of canvas ink at exaggeration 0 and vice versa, mean absolute difference
0.8 of 255 per channel, identical paper colour; `setState` at 256² takes about 25–50 ms of CPU (contours,
hachures and buffer packing). See `hachure/ink/dev/evidence/results.json`.

**Why.** D-1C asked 2C to contour the exact mesh or share a tested saddle rule, and to share the flat
projection for the crossfade. Process-faithful drawing: the flat drawing, the 3D surface and the lift are
one surface seen three ways.

**Revisit if.** Real-solver profiling shows the CPU update cost at the needed cadence is too high (then
move extraction into the solver Worker, since it is pure, or add shader isolines as D-1C's comparison
mode), or projector review needs heavier strokes.

### D-2C-2 · 2026-11-08 · S1/W2/2C · Ink renderer deviations and open items

**Deviations from the 2C brief.**

- **`setState(gpuBuffers)` is not implemented; v0 takes a `StateSnapshot` (or a bare heightfield).**
  Geometry contours (D-1C) need heights on the CPU. Driving the mesh from GPU buffers while contours come
  from a slower readback would let the 3D contours disagree with the surface between readbacks, which
  breaks "the 2D diagram and 3D model can never disagree". Proposal for 3C/4A: feed the view snapshots at
  the probe cadence (2 Hz, D-S1-1B), or add a GPU-side isoline path and record which one in 4A.
- **Channels use vertex attributes, not state textures.** The values are still per-sample state; attributes
  interpolate on the same triangles as the contours and behave identically on WebGPU and WebGL2.

**Open items for the lead.**

- `@hachure/terrain/testing` re-exports the Vitest contract suite next to the fake solver, so importing
  the fake solver in a browser pulls in Vitest. The ink dev page aliases `vitest` to a no-op shim inside
  `hachure/ink/dev/`. 2E will hit the same problem. Suggest a separate `@hachure/terrain/fake` entry point
  (outside 2C's owned paths).
- The fake solver produces no sediment. The dev page offers a labelled sediment test pattern derived from
  the fixture's water, so the ochre channel can be inspected. It is a renderer fixture, never science.
- `setState` runs on the main thread at about 25–50 ms for 256². 3A should update the view at the probe
  cadence, not every frame, or run extraction in the Worker.
- The camera pose and `reliefScale` are spread decisions (3A, 3D). If `reliefScale` is not 1, the page
  should state the vertical exaggeration by binding `verticalExaggeration`.

### D-S1-W2-2D · 2026-11-08 · Headless runtime publishes view state and sampled bindings

**Decision.** Keep the guided lifecycle, level store and binding engine independent of the solver.
A committed prediction starts lifting; the key control unlocks only after the host completes the lift.
Resetting this lifecycle resets learning progress only: the host owns an explicit model reset. The level
store accepts no solver and filters visibility without applying defaults or changing hidden parameters.
The binding engine accepts atomic host samples and notifies only when rendered text changes. It has no
clock, solver polling or readback; 3A supplies samples at its probe cadence and handles stale readbacks.

**Contracts and glue.** Reuse schema `parseBindings`, `findMalformedBindings` and `findTypedNumbers`.
Ordinals containing digits remain errors under that shared rule; V-shaped, dimension words and chemical
notation remain allowed. Build the terrain `EngineCatalogue` from the public config/tool/probe contracts,
excluding structural config fields. Minimal runtime export lines and a workspace terrain dependency are
needed outside 2D's owned folders; `pnpm install` regenerates the lockfile for that dependency.

**Time labels.** Derive scene labels from the current config, scheduled playback rate, speed and step
count. All landscape-year labels, including named durations, stay nonnumeric without explicit calibration
approval metadata; an acceleration factor alone is never approval. 3B must supply and verify the actual
calibration record. Support `scene.timeScaleLabel` as a binding-engine alias for the brief's spelling;
the existing schema's canonical validated content id remains `scene.timeScale`. Use the canonical id in
3D content until a future schema revision reconciles aliases. No schema files changed in this session.

**Not implemented here.** Fixed-step scheduling, asynchronous probe evaluation/readbacks, renderer lift,
challenge evaluation, hidden-parameter reset prompts and calibration science belong to their later
sessions. The tests use the public fake solver strictly as an engineering fixture, never science.

### S1/W2/2E · 2026-11-08 · Semantic widgets, shared palette and fixture boundary

**Decision.** Implement reusable DOM widgets and a facing-page shell using the 1D layout: native
controls, selectable text, semantic KaTeX HTML/MathML, stacked pages at tablet width and natural
vertical scrolling at projector height. Reconcile the palette to paper #faf8f2, ink #242b2a,
water/focus #0072b2 and sediment #9c6500, with word labels and solid/dashed legend lines. Normal
text and quantity colours pass a 4.5:1 contrast check on paper; the rule grey is structural only.

**Why.** The darker 1D ochre supports small labels as well as quantity marks, while retaining 1C's
blue/ochre meaning. Keyboard/browser evidence covers the prediction gate, clamped controls,
flap, playback, reset, preserved state across levels and MathML. A thin local fake-solver adapter
keeps 2E independent of unmerged 2D code. The diagnostic drawing is explicitly fake snapshot row
profiles, not a replacement terrain primitive. There is no scored scientific answer, stamp,
geological clock or scientific formula claim in the mock page.

**Open acceptance item.** Human screen-reader listening could not be performed without a human
listener. No NVDA/Narrator process was present. This is an unmet 2E exit criterion; automated
keyboard events and the accessibility snapshot must not be treated as listening evidence. See
`uplift/book/src/evidence/README.md` for the manual protocol, screenshots and integration handover.
3A must replace the fixture route and local adapter with the runtime/renderer integration before
reader release. View-only checkbox controls use callbacks without extending schema v0.

<!-- expert-review -->

### D-W2-001 · 2026-11-08 · Wave 2 integration · Resistance before calibration

**Decision.** Merge the six foundation PRs in the planned order. Choose semi-implicit
Manning-style hydraulic resistance as the direction for a separate correction before 3B
calibration and 3C water porting. This is an implementation direction, not an approved
equation, roughness value or scientific sign-off. The owner must derive the adaptation to
the pipe variables, source the parameter envelope, test timestep refinement at equal
hydraulic duration, and resolve the current wave-guard limitation. Keep geological years,
quantitative erosion claims and the predict answer unapproved until the required evidence
and expert review exist. See the prerequisite brief in `docs/plan/stage-1.md`.

**Evidence.** D-2A-1 documents donor-limited speeds and timestep-dependent incision even
with closed budgets. [USACE HEC-RAS, Eulerian shallow-water discretisation](https://www.hec.usace.army.mil/confluence/rasdocs/ras1dtechref/6.4/theoretical-basis-for-one-dimensional-and-two-dimensional-hydrodynamic-calculations/2d-unsteady-flow-hydrodynamics/numerical-methods/eulerian-shallow-water-equation-solver)
provides a reference for treating resistance implicitly in the velocity update; it does
not validate our virtual-pipe model. Existing equations remain documented as implemented
until the correction merges. No production CPU/GPU kernel changes in wave close.

### D-W2-002 · 2026-11-08 · Wave 2 integration · Shared fixtures and handover

**Decision.** Export `@hachure/terrain/fake` directly from the browser-safe fixture module.
Keep `testing` for the Vitest contract suite and backwards-compatible test imports.
Move both browser consumers to `fake`, remove the ink dev shim, and make the capture
adapter check independent of that shim. Align `RaiseOp` and fake raise with the existing
science brief and real tools: added material is loose sediment. The shared contract test
now checks that raising preserves bedrock. The fake's added-volume ledger uses stored
float32 increments. It remains a clearly labelled scripted fixture, never science.

**Handover.** 3A owns real preset/brush wiring, source reset, 2–4 Hz view updates or Worker
extraction, separate 3D loading and atomic binding samples. 3B needs exact limited sediment
face diagnostics for AC3c. 3C/4A need split/local-datum GPU elevation and matching contour
snapshots or GPU contours. The same landscape is 128² × 10 m and 256² × 5 m; CPU bitwise
replay is scoped to one JavaScript engine. These are explicit subsequent-session requirements.

**Acceptance limit.** The user requested merging all Wave 2 PRs; 2E is merged with its
human screen-reader listening check still open. Structural accessibility and keyboard
checks do not satisfy it. 4D owns completion, and the stage gate retains the requirement.
GPU solver comparison is deferred to 3C because no GPU solver exists yet. Foundation
test success does not close scientific validation, calibration or classroom hardware gates.

### D-W3-P · 2026-11-09 · S1/W3 prerequisite · Resistant pipes and guarded velocity

**Decision.** Subtract Manning friction slope from the virtual-pipe pressure gradient,
with donor section l h and radius l h/(l+2h). Solve the positive quadratic resistance
root with geometry frozen per fixed step, then apply the existing donor limiter.
Average signed donor-area face velocities for capacity and wave diagnostics; dividing
incoming flow by newly wet receiver depth recreates timestep-driven speeds.
`manningNSPerMOneThird` defaults to 0.035 within provisional 0.025–0.15 bounds.

**Evidence.** `docs/science/hydraulic-resistance.md` gives dimensional derivation,
USACE sources, limitations and equal 50-second timestep refinement for the 2A
counterexample. Speed, incision and export successive differences shrink. Restore
`halt` as production default; `report` remains explicitly diagnostic, not approved.
CPU mass-budget, stability and determinism regressions remain required. GPU comparison
fixtures must be ported and run in 3C before its merge; this prerequisite cannot
claim GPU parity with an unbuilt solver. No calibrated years or predict answer.

**Plan facts.** Resistance substantially slows drainage and erosion. 3B must measure
outcomes afresh using the real preset; the old frictionless validation magnitudes
cannot be reused. Expert review of the geometry, roughness and calibration is open.

<!-- expert-review -->

### D-3D-001 · 2026-11-09 · Draft content cannot invent a scored prediction

**Decision.** Author the valley page at both levels with canonical scene bindings and a
typed `predictDraft.answer: null`. Its absence deliberately prevents using the draft as
a scored `PredictSpec`. Keep the answer and both flaps pending the reproducible T6 result;
an inconclusive comparison cannot be silently assigned to a choice. Content sources
separate literature mechanisms from the implementation's engineering parameter ranges.
The stream-power formula is comparative theory, never the implemented capacity law or
a mapping from `erosionRatePerS` to K.

**Integration.** The content exports require scalar probes `incisionDepth` and
`sedimentOut`, value control `rain`, and duration `predictSpan`, agreed with 3A.
The clock uses `scene.timeScale`; the duration binding reports uncalibrated status until
approved. Tests scan every reader field and authored markdown label for typed numbers,
unknown bindings and unresolved citation keys. Bibliographic link destinations are metadata.
The integrating spread must additionally validate these declarations against its actual
probe/control definitions. Review markers remain in source but are removed from plain
reader prose to avoid being read aloud as markup.

**Open gates.** 3B must provide the answer evidence and matching final flap claim; hydraulic
correction and calibration approval are independent of content completion. All scientific
copy remains expert-review draft. Existing M07 full-text, field-analogy and domain-review
gaps remain open. No content test is a scientific validation result.

### D-3B-001 · 2026-11-09 · Validation infrastructure complete; scientific acceptance failed

**Evidence.** All eighteen corrected real-preset runs completed their preregistered
horizons and all sampled budgets/guards passed. AC3a wet-minus-dry incision is negative,
about -0.00049 to -0.00072 m versus the required +0.1 m. AC3b has no narrowing or eligible
knickpoint; approved persistence cannot be established. AC3c has the expected deposition
direction but only about 21.6 m³ excess against a 64.0 m³ margin. T6 is inconclusive on
all seeds. All fifteen calibration sections have nonpositive incision. Full results,
configs, fingerprints, CSVs and the figure are in `docs/science/validation/`.

**Decision.** Publish reusable fixed-section incision and exact accepted-step reach
sediment-transfer diagnostics, plus the failed evidence. Do not change thresholds,
horizons, seeds or default parameters to obtain a pass. Keep the prediction null/unscored,
the clock sentinel unchanged, and scientific approval pending. The lead keeps Wave 3
open: this infrastructure/result PR does not satisfy session 3B's scientific exit.

**Ownership and retention.** Minimal CPU additions observe stage-five limited faces
before scratch reuse; they do not change physics. 3A coordinates separate brush edits.
Public exports let the host use the same metric with an explicit reset baseline.
A result-driven content follow-up replaces stale “awaiting results” wording with the
observed inconclusive outcome, retaining expert-review markers. Raw metric samples
are stored every 200 steps, while full sampled profiles/sections are retained only at
initial/spin-up/final steps; complete terrain snapshots are not archived. This declared
retention deviation keeps the failed draft packet reviewable; deterministic replay is
available from the recorded inputs. The scientific acceptance command exits nonzero.

## D-S1-W3-3E · Shared-surface picking and keyboard brushes

- **Decision:** keep picking in the dependency-free ink entry point. Rays invert the shared orthographic
  projection; nearest triangle intersections use the same saddle rule as mesh, contours and surface
  sampling. The cursor is a projected ink SVG ring from the displayed heightfield and lift, with no
  simulation mutation or animation loop. The host must refresh it after displayed-state, camera and size
  changes; a newer Worker snapshot must not be used ahead of the visible view.
- **Interface:** `createToolPalette` consumes public brush operations/results and current configuration.
  Config-derived radius and tool-specific amount limits apply to mouse, keyboard and programmatic input.
  A dedicated terrain-cursor button owns arrow movement and Enter/Space application; native form
  controls retain their standard key behaviour. Async edits retain focus and suppress overlapping calls.
  Visible live text reports actual positions, tool volumes and both input/solver clamps.
- **Evidence:** exact-cell/lift and saddle tests; Chromium keyboard smoke with real `applyBrush` for all
  tools, clamping, async error recovery and disabled gating. See `hachure/runtime/src/tools-ui/README.md`
  and its fixture evidence. This tests interaction, not geomorphological validity.
- **Handover:** 3A mounts the palette and cursor against the host and currently displayed view. Human
  screen-reader listening stays with 4D. No solver, science model, configuration default or dependency
  changed. Only public barrel exports are outside the two owned directories.

## D-S1-3A · CPU host, Worker boundary and honest draft learning gates

2026-11-09 · session 3A

The book now uses the real tilted-plateau CPU solver in a module Worker. A bounded fixed-step accumulator
changes wall-clock throughput, never numerical dt. Normal atomic snapshots/probes publish at two hertz;
manual updates are coalesced to at most four view refreshes per second. Baseline/current paths and
calibration status travel with each sample. An incomplete metric replaces its old numeric display with an
explicit unavailable status. The host uses the shared fixed-section metric from 3B; the reset baseline
is an observation baseline, separate from the validation protocol's spin-up baseline.

The Worker needs a dedicated public runtime subpath: importing the ordinary runtime entry evaluated DOM
widget CSS in Vite development and failed with `document is not defined`. `@hachure/runtime/worker`
exports only the Worker engine. This was found by the actual browser flow, not by the Node unit suite.

CPU brushes now call the shared `applyBrush` on the synchronized float32 mirror. Only changed bedrock or
sediment components are copied back; all untouched float64 values survive. The tool ledger uses the
actual authoritative stock change, including rounding of edited components. The real preset's declared
source is reinstalled on reset and its outlet face/base level are checked.

A pending scientific answer must not become a fabricated option index. Schema v0 therefore permits
`PredictSpec.answer: null`, visibly unscored, and a `ChallengeCheck` of `pending` with a reason. No draft
stamp is awarded. These are explicit research states; they do not close the science or release gates.
The host adds a `fixed-section-incision` probe kind for the baseline/current metric: a single-snapshot
terrain probe cannot calculate a change relative to reset. Stage 2 should formalize baseline-aware probe
requests instead of multiplying spread-specific host adapters.

Minimal glue outside the session directories: runtime exports/Worker package subpath; binding strings
for unavailable numeric probes; pending schema/widget states; the book entry point; and the spread's
terrain dependency plus generated lockfile. Content remains owned by 3D/3B, and the full challenge and
university chart layer remain Wave 4 work.

Final integration retains separate float64 reset/current surfaces for the shared 3B metric. A regression matches the authoritative scientific calculation exactly and demonstrates that float32 drawing snapshots would give a different result. Real Chrome evidence covers keyboard and ray-picked brush edits; the recorded loaded-machine timings are samples only and do not approve the classroom performance gate.

### D-S1-W3-3C · Guarded managed GPU water and split elevation

<!-- expert-review -->

**Decision.** Port the prerequisite's corrected water stages through three r187 WGSL arithmetic and
managed dispatch. Keep a dedicated `/gpu` export so CPU/Worker consumers do not import Three. The
partial water stage rejects active omitted process coefficients and is not a full TerrainSolver.
A fixed-tree max reduction and latched guard precede whole-state commits; later queued work cannot
advance rejected state. Public CPU constants/guards are reused, including halt semantics.

**Evidence.** The real Chromium/Vitest comparison covers shared dry/wet/front fixtures, roughness
bounds, fixed timesteps, spring input, odd grid/outlet conventions and brush-edited initial state.
Step counts, fields, same-device replay, rejection preservation and atomic readback are asserted.
Separate compensated elevation changes preserve cumulative sub-ulp increments against a float64
reference; this tests precision storage, not the unbuilt GPU erosion process. Results and local
OS driver metadata are in `hachure/terrain/src/compare/`.

**Readback and CI.** Serialize mutations with atomic multi-attribute snapshots, coalesce reads and cap
view sampling at two samples per second. Contours and mesh must consume the same snapshot version.
The dedicated browser workflow attempts Chromium WebGPU/software support; unavailable adapters are
explicitly skipped, never counted as parity. The lead runs local GPU comparisons at wave close.

**Handover.** Full erosion/transport/evaporation, budgets, GPU brushes, backend selection and classroom
performance remain 4A/5A. Expert review of the hydraulic adaptation remains open. Minimal ownership
exceptions are the terrain package GPU export/dependencies, generated lockfile, and browser CI workflow.

**Final integrated check.** Rebase after 3A preserves the same water kernels and comparison bounds.
Add the real seeded 128² tilted plateau and its declared spring for an 80-step water-only comparison,
covering its full elevation range and multiple reduction workgroups. The CI workflow deletes committed
local results immediately after checkout so failed setup cannot display stale local adapter evidence.

### D-W3-L · 2026-11-09 · Wave 3 integration · Publish failed evidence, preserve the science gate

**Finding.** The corrected solver's preregistered rain experiments fail AC3a for
all three seeds; uniform calibration runs lack positive median incision. Numeric
landscape years and a scored prediction would therefore misrepresent the evidence.
See the full 3B packet and `docs/plan/stage-1-wave-3.md` for exact results.

**Decision.** Publish tested validation infrastructure and the unsuccessful evidence
in the planned session order, so the real Worker host can reuse the same public
metrics. This is an implementation handover, not acceptance of 3B's scientific
exit criteria. Keep the spread explicitly unscored and uncalibrated; no waterfall
stamp. Wave 3 remains open. Wave 4 cannot begin until the original exit criteria, or a
scientifically justified and explicitly reviewed replacement, are actually met.

**Required follow-up.** Review the measured deposition/incision behaviour and the
experiment design before changing model parameters, horizons or the question.
Record any preregistered revision before rerunning all arms and seeds. Expert
approval remains separate from successful numerical tests. Never adjust thresholds
or select seeds after seeing results merely to make the gate green.

### D-W3-R1 · 2026-11-09 · Preregister mechanism-isolation follow-up

<!-- expert-review -->

Review finds two experimental confounds: loose cover may shield the hardness
intervention, and upstream deposition leaves too little supply to satisfy AC3c's
absolute margin. Preregister exposed-rock landscape arms and a pulse immediately
upstream of the slope transition; preserve all solver equations, thresholds,
horizons and seeds. Replay all eighteen originals plus all eighteen revised arms.
See [the frozen registration](docs/science/validation/followup/preregistration.md)
for hypotheses, controls, stopping rules, evidence retention and interpretation.
This diagnostic revision is not an approved replacement for the original gate;
public science status and release claims remain unchanged pending results/review.
Owned paths are 3B validation code/evidence plus this required append-only log.

### D-W3-R2 · 2026-11-09 · Owner prioritizes educational relationships

The owner clarified during the registered follow-up that visible outcomes, causal
relationships and relative comparisons matter more than quantitative field accuracy.
Adopt [education-policy.md](docs/science/education-policy.md): process-model releases
need robust qualitative and visual evidence; geological calibration is conditional
on claiming real-world time/rates. Preserve numerical correctness, deterministic
paired comparisons, truthful content and process-generated change.

Finish the frozen R1 experiments unchanged and preserve their historical outcomes.
A policy clarification does not itself validate a lesson or authorize a scored
answer. Future educational protocols must explicitly assess legibility and use
model-time persistence if a geological clock is not claimed. No solver, calibration
approval or reader-visible answer changes are made by this decision.

Minimal ownership expansion is necessary to reconcile the handoff, product story,
stage/handover, validation specification and time-scale proposal with this explicit
user direction. Those edits are policy cross-references, not rewritten experiment
records.

### D-W3-R3 · 2026-11-09 · Completed mechanism-isolation evidence

<!-- expert-review -->

All 36 arms completed with passing guards/budgets; all eighteen originals replay
exactly. Original cover shielded the hardness intervention. Exposed bedrock makes
hardness active (about 1.57% less band bedrock loss), but gives no consistent
narrowing or eligible slope break. Adjacent pulse placement increases reach entry
and preserves greater deposition in the flatter arm (about 24% more), but reduces
the absolute between-arm contrast. Higher rain mobilizes about 2.4 times as much
material without deepening the fixed section minima. See the
[complete packet](docs/science/validation/followup/README.md).

Legacy numerical criteria still fail and are preserved. Under D-W3-R2, prioritize
a visible paired interaction and a matching teaching question; field-rate
calibration is not the next blocker for a qualitative model. The current numerical
packet does not establish classroom legibility or authorize a scored prediction.
No further post-result tuning or solver change was made.

## D-W3-R4 · Teach the supported rain comparison with a recorded replay

2026-11-09 · Wave 3 completion follow-up (3F), requested by the owner.

The prospective presentation protocol is committed at a8464b6. Reuse every
revised rain pair from PR #20, all seeds and samples, and teach cumulative gross
erosion rather than the unsupported deeper/wider claim. A shared-scale bar and
time-trace widget is an engine primitive in Hachure runtime; the spread stays data.
The book wires that primitive to a compact, provenance-checked public terrain
artifact. No solver equations or initial landforms change. Recorded samples are
explicitly labelled; the free terrain is separate and cannot change their result.

The supported answer is scoped to this comparison. All failed legacy records,
calibration approval=false and the pending challenge remain intact. The view
passes the prospective pixel/readability, keyboard, reduced-motion and state
preservation checks on every seed. This closes the Wave 3 educational comparison
under the owner's accepted policy after integration, not the Stage 1 expert,
human-accessibility or hardware gates.

Ownership: 3F integrates validation, the runtime comparison primitive, book wiring,
spread text and evidence/plan docs. The two public barrel exports are minimal glue.
A separate generic paired-live-worker host is unnecessary for this recorded
experiment and is not claimed. Future interactive comparisons should be another
engine primitive rather than heavy spread code.

Open for Stage 1 review: expert interpretation of the taught mechanism and human
classroom usability. Wave 4 must validate a fresh model-time slope-break sequence
before enabling its challenge; these rain results do not support a waterfall.

## 2026-11-09 — S1 W4 4C: challenge infrastructure and failed prospective proxy

Ship a fail-closed ChallengeCheck evaluator, an explicit model-step slope-break
tracker, a keyboard-accessible stamp widget and best-effort local progress. Any
pending check, even nested in an alternative, blocks stamp awards and suppresses
saved stamps. Geological-time persistence requires approved calibration metadata;
invalid/missing probes, gaps, new runs and inconsistent clocks cannot silently
satisfy it. Reading-level updates at the same step add no persistence time.
Local progress is versioned and definition-specific; blocked storage or quota
failure preserves the current in-memory achievement without breaking the book.

The new protocol s1-w4-model-step-slope-break-v1 was committed before executing
all six real CPU arms (three seeds, uniform/sham and hard-band). A pre-execution
module-resolution repair changed tooling only and was also committed before any
solver run. All arms reached the fixed 22000-step endpoint with valid stocks,
conservation and stability checks. No arm produced a qualifying candidate. Thus
its numerical morphology gate FAILED; no renderer-legibility or scientific
success is claimed, and no real-book stamp is enabled. The existing failed
experiments, geological-time approval and pending book definition stay unchanged.
The new model-step criterion does not rewrite historical persistence thresholds.

The harden tool uses binary disk support, including radius-boundary cells; its
raised-cosine weight applies to height edits, not hardness. A mechanical tool test
confirms the registered rows73/74 radius-one-cell strokes cover exactly rows72–75
and alter no ground height. This is software geometry verification, not evidence
of slope-break formation. Retained source/config/state hashes, tool logs and all
scheduled profiles/budgets live in docs/science/validation/challenge/.

Synthetic stamp/detector fixtures are labelled software-only and never appear in
the reader's spread. The book's flap now names the learner's committed choice,
and minimal approved book wiring updates/reset the reusable challenge widget.
Future release needs a new successful prospective sequence plus renderer legibility
and expert/human review. Sustained checks also need an explicit fixed-step host
observation schedule; ordinary view readback cannot prove a missed interval.

Provenance handover exception, agreed with the lead: keep preregistration commit
931285ecafa6d0592f2106e5c1158d6a919ccb9d reachable in this branch's ancestry.
Integrate current main by merging it into 4C, preserving that history in the draft
PR, rather than rebasing/cherry-picking away the immutable pre-execution anchor.
This is a documented exception to the routine session rebase rule. The PR remains
a draft while the real challenge's scientific exit gate is failed/pending.

## D-W4-4E · Enforce production browser and size regressions

2026-11-09 · Stage 1 / Wave 4 / Session 4E.

Use the pinned Playwright Chromium runner against the production build, with an
isolated source-server entry for explicitly unscored science fixtures. No fixture
or test hook ships in the book. CPU Worker and software WebGL2 establish repeatable
browser smoke coverage; WebGPU agreement and hardware performance are separate.

The recorded comparison tests every registered seed and exact sample, fixed shared
bar/trace axes, endpoint-gated committed-answer feedback, keyboard scrub, replay,
reset and reduced motion. Paused live hashes and recorded replay state survive
reading-level switches. Preserve hidden uncalibrated years and pending challenge
without stamp; null-answer predictions must never receive scored wording. Testing
that fixture revealed a book feedback path missing the null-answer guard; the
minimal guard is included.

Interpret the demo's <10 MB ceiling conservatively as <10,000,000 raw generated
bytes, recursively including Worker and lazy assets. Enforce it in both CI jobs;
negative boundary coverage prevents a budget check that always passes.

The opt-in debug primitive reports page rAF fps (explicitly not a completed-draw
benchmark), batch compute milliseconds divided by steps, atomic-sample grid/seed,
and separate solver/renderer labels. No new model state or scientific claim is
introduced. Book lifecycle hooks, a public runtime barrel export and root scripts/
pinned dev dependencies are minimal cross-ownership glue. axe-core is included at
the integrator's request for 4D; 4E does not claim a human accessibility audit.

Open handover: 4A must feed the selected solver name into the debug glue and update
the CPU128 assertion. Remote CI evidence remains unavailable until publication;
local `pnpm check`, production build, budget and Chromium evidence are recorded in
`e2e/HANDOVER.md`. Existing expert/human/hardware gates remain open.

## D-W4-OPEN · Open Wave 4 with anonymous instrumentation

2026-11-09 · Owner requested parallel session worktrees using GPT-6.1 Sol at
high reasoning and explicitly chose to add learning-outcome instrumentation.

Wave 3's supported recorded rain comparison is merged at `d29d639`; the baseline
passes `pnpm check` (434 tests). Start 4A–4F in isolated sibling worktrees. Three
sub-agent slots run at a time; queue the remaining independent sessions. Preserve
the prescribed merge order, with 4F after 4D. A separate integration worktree owns
shared book mounting and plan updates to reduce overlapping session edits.

4F provides an opt-in local event log, optional pre/post checks for the supported
claim, and reader-triggered anonymous export. It adds no server collection,
accounts or identifiers. Interaction completion is not evidence of learning gain.
See the new 4F brief for event scope and acceptance checks.

The waterfall challenge remains pending until a prospectively registered
model-time sequence is validated. Historic failed morphology, hidden geological
years and outstanding expert, human accessibility and target-hardware gates stay
unchanged. Starting Wave 4 does not close these Stage 1 requirements.

## 2026-11-09 — Owner accepts 4C infrastructure merge, not challenge success

After reviewing the six-arm failed morphology result and alternatives, the owner
authorized merging infrastructure and failed evidence with the real challenge
pending and stamps disabled. Scientific challenge acceptance remains open; no
threshold, historical outcome, release approval or geological-time claim changes.
The stage plan records this explicit separation of implementation integration
from acceptance. The owner requests a human listening preview before merging 4D,
so 4D and 4F must wait in the prescribed order.

### D-S1-W4-4A · 2026-11-09 · Complete guarded GPU solver and equal-domain fallback tiers

<!-- expert-review -->

**Decision.** Extend the managed water pipeline with the CPU model's capacity
exchange, flux-form suspension transport, thermal slumping, evaporation and
stranding. Full-process candidates and every ledger pass share the resident
latched guard before commit. Split passes fit the portable eight-storage-buffer
limit; no float atomics or increased adapter limits are required. Keep the
water-only API and original evidence separate from the complete `/gpu` factory.
No process equation, science default, historical experiment result, calibration
approval or pending challenge is changed. Sources are the existing
[model](docs/science/model.md) and
[hydraulic derivation](docs/science/hydraulic-resistance.md).

**Precision and budgets.** Preserve compensated bedrock changes and add a
compensated loose-material change lane: even ordinary loose thickness can swallow
small erosion under absolute Float32 updates. Per-cell direct-transfer counters
use compensated additions and deterministic fixed-tree reductions. Authoritative
Float64 reconstruction serves baseline-aware probes and conservation tests; the
contract's Float32 drawing snapshot cannot resolve every tiny stock difference
at a high absolute datum. The shared contract uses the identical CPU catchment
fixture, while independent high-datum tests check actual sub-ULP erosion and
precision across configuration/tool events. No shared threshold was relaxed.

**Ordering and tools.** All mutations and full reads serialize. Snapshot
coalescing keys on the queued mutation sequence, so reads after queued operations
cannot return an earlier state. Automatic readback remains capped at two hertz;
mesh and contours consume the same host sample. Shared CPU brush evaluation
preserves clamps/smoothing semantics, followed by managed GPU uploads and
compensated resident commits; there is no CPU shadow stepping. Configuration
changes preserve both elevation residuals, source rates, outlet level, counters
and elapsed model time while rebuilding managed pipelines. These are event
operations; embedding controls should coalesce repeated slider events.

**Fallback.** Public runtime selection tries WebGPU256 at 5 m cells, CPU Worker128
at 10 m with WebGL2 rendering, CPU64 at 20 m, then a genuine static preset drawing.
Every tier covers 1280 m. Pipe area scales as `0.2 × cellSide²`, within existing
CFL/roughness guards; this is engineering scaling, not field calibration. Auto
selection warms/measures fixed steps against a compute-only 30 fps admission
budget, then resets before publishing its initial sample. It degrades grid size
without changing fixed dt. Diagnostic `?backend=` flags force each tier; failed
forced tiers report why they returned flat. WebGL2 compute remains excluded.
Calibration metadata and changed init arguments cannot be hidden by cached reads.
The read-only flat transport keeps the genuine step-zero sample and rejects live
controls; it can paint before GPU/Worker initialization.

**Evidence and boundaries.** Actual installed headless Chrome runs on Intel Arc
140V driver 32.0.101.8860. The shared contract, full CPU/GPU comparison, conservation,
real cumulative erosion precision, hidden-lane/budget replay, atomic rejection,
mutation ordering, tools/config/reset and every real forced backend transport
pass. Full results and driver metadata are in `hachure/terrain/src/compare/`.
Headless compute/readback timings exclude rendered frame cost and uncontrolled
power/thermal conditions: visible Chrome classroom AC1 remains 5A. Book mounting
and its forced-tier browser checks are coordinated by the lead; 4A's only owned
path exception is the required runtime barrel export, plus this append-only log.
Human accessibility, expert science sign-off and historical failed morphology
results remain unchanged.

## D-W4-4A-INTEGRATION · Mount the selected solver behind a real initial drawing

2026-11-09 · Lead integration. Paint a genuine step-zero preset before device
creation, then mount the selected complete solver using the shared SimHost.
All tiers cover the same configured domain. The flat tier uses a read-only host,
keeps live controls disabled, and preserves the recorded prediction/comparison.
Diagnostics report the selected solver separately from the rendering backend.
CPU-specific regression tests explicitly request that tier. CI removes committed
local comparison packets before running and uploads only newly generated evidence.

Independent review fixed mid-run timestep changes, mutable queued tool inputs and
rejected-step counters. Actual unavailable-device tests exposed Three's unwanted
WebGL compute fallback and a cleanup rejection; the managed compute factory now
requires WebGPU and owns device cleanup. The fixed APIs pass targeted regressions.

Integrated validation: pnpm check passes 451 tests; 68 actual GPU tests and a fresh
16-case Chromium suite pass. Installed Chrome selects and renders WebGPU at 256
cells per side automatically and when forced. The production bundle is below its
configured budget. One preliminary dev-fixture readiness stall did not reproduce
in forced-cold, isolated or fresh full runs; preserve that uncertainty in the
backend evidence handover rather than assigning an unsupported cause.

Minimal book mounting, test-helper and GPU workflow changes are necessary glue
outside the engine session's owned paths. Headless evidence does not close 5A's
classroom performance gate. GPU configuration currently rebuilds core resources;
slider-drag responsiveness still needs that measured review. Challenge science,
human listening and the other Wave 4 integrations remain open.

## 2026-11-09 — S1 W4 4B: university diagnostics and hidden parameters

The university layer reads one completed HostSample for its long profile and
sediment budget. The profile samples the fixed reset route, not the newly routed
channel: changing the traced route must not masquerade as incision. It labels
incomplete routes, omitted terminal remainders, model datum and independently
rescaled axes. A subcell route is unavailable rather than fabricated.

Erosion, deposition and export are cumulative counters; suspension is a current
stock recomputed from the sampled layer. The page distinguishes these and includes
the external reader-tool ledger instead of presenting their sum as a closed budget.
All displayed measurements and parameter values derive from the sampled state,
effective scene defaults or public admissible ranges. Volumes retain model-m³
scope; no field calibration or geological clock approval was added.

The existing spread-authored KaTeX stream-power comparison and expanded university
ignores are preserved. Added expert-review-marked context defines the symbols and
explicitly distinguishes the capacity solver's relaxation rate from stream-power K.
There is no live K or claimed dimensional mapping.

Capacity coefficient, erosion relaxation and deposition relaxation are university
controls using existing provisional CPU reader ranges. Reading-level changes only
change visibility. High school shows bound current/default values when these hidden
controls differ. Its explicit restore action configures only those parameters,
keeping the terrain, model step and rain setting. Full experiment reset restores
effective university defaults as well. Minimal approved book.ts wiring and a public
widget barrel export are the only implementation changes outside the owned uni path.

Evidence: widgets/uni/data.test.ts and widgets/uni/smoke.mjs; the latter saves
1366px and 390px screenshots and a browser report beside the widget. Existing
science/challenge pending states remain pending. Expert sign-off and human
screen-reader/teaching review are still stage gates, not claimed by these checks.

## 2026-11-09 — 4B integration after GPU backend selection

University controls now share the backend readiness/live-control gate. The flat
fallback exposes measurements but cannot configure live parameters. Full reset
restores university defaults only on mutable backends. Both decision-log sides
are retained during rebase. The additional e2e/university.spec.ts is lead-owned
integration coverage for state-preserving restore, full reset and flat gating.
Desktop/mobile installed-Chrome smoke passes after integration; human and expert
acceptance remain open.

## D-W4-4D · Coalesce spoken measurements and preserve keyboard context

2026-11-09 · Accessibility session. Keep every visible bound snapshot, but announce
running measurements at a five-second cadence and paused changes promptly. Move
focus from the committed prediction to the unlocked comparison and back to the
prediction on reset. A motion preference change during lift cancels the animated
rise and finishes through a crossfade without autoplay. Correct the brush cursor's
aria-disabled state to include its disabled parent fieldset.

Actual Chrome keyboard and axe checks pass in the high-school and university
states. Colour-vision emulation preserves labels and shape encodings. Evidence
and reproduction live in hachure/runtime/src/a11y/README.md. Human screen-reader
listening remains NOT PERFORMED; this session cannot close that carried gate.
Minimal book/widget/export/dependency edits apply the primitive to the real lesson.

## 2026-11-09 — Integrated 4D preview before human listening

Rebase preserves GPU/fallback gating, university controls and both challenge-run
and lift generations. Take main's lockfile and rerun pnpm install; no hand merge.
The integrated challenge widget now avoids rewriting an unchanged live-region
status on every sample. This minimal cross-widget fix prevents redundant speech
mutations; the accessibility browser audit observes that status during play,
brushing and level changes. Keyboard, reduced motion and both axe scans pass.
Human listening remains NOT PERFORMED. The owner requested a preview before merge;
PR #23 remains draft and 4F waits in order. The checklist and local preview are in
docs/review/wave-4-human-review.md. This does not close challenge or release gates.

## D-W4-4F · Explicitly opt-in local classroom observations

2026-11-09 · Stage 1 / Wave 4 / Session 4F, authorized by the owner.

Implement schema v1 specifically for Demo 1 and its validated recorded gross-
erosion question. Use strict typed actions and numeric model context, sequence-
only order and a bounded memory tail. Start off on every mount. No identity/free-
text fields, device identifiers, clocks, storage or network transmission. Export
is a reader-triggered local JSON download. Stop retains data; clear erases it and
optional answers while preserving the chosen on/off setting. Disclose omissions
and contain context/observer/export failures without affecting the lesson.

All retained event fields are cloned. Capture both the live host's full numeric
config/seed/model step and nonidentifying solver-backend enum and the recorded comparison's own version/seed/sample step/
inputs; label the action's source explicitly. Keep pending challenge events pending
and reject invented success. Optional pre/post answers reuse the supported question
and its source; neither completion nor answer changes are claimed as learning gains.

The runtime owns the collector/panel and event validation. Minimal shared glue:
a public export, typed exception-contained paired-replay observation callback,
book action/context hooks, and production browser tests/fixture under `e2e/`.
The work branch is based on 4E's checked test harness. No solver, authored spread,
package dependency or lockfile changes are needed for 4F.

Integration: the event schema already supports 4B's capacityCoefficient,
erosionRatePerS and depositionRatePerS controls plus a distinct restore-defaults
action. The lead should hook successful university configurations and hidden-
default restoration using the guidance in instrumentation/README.md. Keep 4A's
selected backend and 4D's motion/focus changes when merging the book glue. Future
validated challenges or other comparisons need a reviewed event-schema extension;
v1 cannot emit a successful challenge or impersonate a universal assessment.

## D-W4-4F-R1 · Validate the retained JSON representation

2026-11-09 · Review follow-up for the anonymous event boundary.

Input validation alone is insufficient because JSON serialization can invoke
custom hooks or accessors. Revalidate the parsed serialized clone before any
retention, eviction, omission count or sequence update. Reject numeric-pair arrays
unless they are ordinary dense arrays containing exactly two own numeric data
entries and the length property, with no custom serialization or extra keys.
Also include nonenumerable/symbol keys in object extra-field rejection.

Regressions cover the reviewer's array-toJSON injection, hidden serializers,
sparse/decorated arrays in both recorded rain inputs and live hardness ranges,
and an accessor that passes the input check then injects free text during JSON
serialization. Rejected events leave the retained log and sequencing untouched;
all exported retained events pass the public validator. No book or model behavior
changes, and normal book arrays remain accepted.

## 2026-11-09 — Owner approves remaining Wave 4 integration

After the integrated 4D preview and packet were delivered, the owner explicitly
approved merging. This supersedes the pre-merge listening hold; it is not evidence
that human listening passed. PR #23 merged with all checks green. The final 4F
integration preserves motion/focus and challenge guards, logs the selected backend
from live state, and records accepted university parameter changes and explicit
hidden-default restoration after configure completes. Logging does not reset or
mutate either lesson state. New browser coverage checks those hooks and flat/CPU64
export context. Minimal book/e2e and review documentation changes are integration
glue. Human listening, successful challenge science and Stage 1 hardware/expert
gates remain open; merging code does not close Wave 4 acceptance.

The integrated local suite exposed an existing debug-test race: the overlay reads
completed host timing before the page snapshot has refreshed its data attributes.
After Pause, the test now waits for the atomic snapshot counters before asserting
them. No timeout, retry policy or simulation behavior changes.

## D-PRODUCT-PLAYABLE-BOOK · Restore the book and learning-through-play priority

2026-11-09 · Explicit product-owner direction, supplied with six Every Joule screenshots.

Uplift means ink drawings lifting off a book into a manipulable 3D world. The owner
identified the current examples and planning as drifting toward calculation and
complicated front-facing interactions. Adopt immediate play, one visible lesson per
spread, optional low-pressure questions with freely available answer flaps, bounded
book composition and page turning as the product contract. Preserve Hachure as the
scientific/rendering foundation.

This supersedes mandatory prediction-before-play, endpoint-gated answer reveal,
required challenge/stamp progression and Stage 1's page-turn exclusion. It changes
pedagogical requirements in the handoff, not just styling. The next product proof is
two playable spreads; Contours to terrain and a small water-routing lesson are
candidates to verify, not completed or scientifically approved lessons.

Code/evidence inspection found a prediction-gated lift, an endpoint-gated explanation,
a recorded chart before a separate live scene, content-height pages, and technical
controls in the ordinary reading surface. The committed rain-comparison screenshot
confirms the long worksheet composition. No new browser or learner study is claimed.

P0 owns the product story, governing handoff, active plan/framework, README and this
append-only record. P1/P2 implement the experience before Wave 5 hardening.
See docs/plan/product-realignment.md for scoped paths and PB1–PB8. Existing tests that
encode old gates must be updated with the new lifecycle, while state preservation,
scientific honesty and numerical safeguards remain required.

No solver, rendering implementation or evidence classification changes in P0.
Recorded comparisons remain labelled and separate from live results. Failed valley/
waterfall science is preserved and cannot be promoted to a successful lesson.
Those outcomes are not prerequisites for shipping a different supported concept.
Numeric field rates/years require calibration only when claimed.

Open implementation choices: book proportions, the direct contour gesture, and
feasibility of source placement/readable water motion for the second lesson.
Expert assignment, human listening and target-hardware checks remain open.
These are follow-through work; the owner's product direction needs no reconfirmation.

## D-W5-BOOK-REVISION · Complete revision wave and downstream scope correction

2026-11-09 · Explicit owner request: merge the direction commit first, then plan a
complete wave for revising existing implementations, making a new example and
removing drift from unfinished plans.

Commit 46fefe6 was fast-forwarded into local main and pushed to origin/main.
PR #28 records its checklist and handover. GitHub API status reads became unavailable
after PR creation; the git push succeeded. Do not infer remote CI status from that
push; local pnpm check (479 tests) and production build passed before integration.

Replace the coarse P1/P2 execution outline with Stage 1 Wave 5:
5A feasibility/contracts; 5B runtime; 5C book shell/paging; 5D new two-spread example;
5E migration of the default app and existing research implementation; 5F integrated
verification, review evidence and plan reconciliation. Preserve PB1–PB8 as the
product contract. Plan-only work in this session; no implementation session launched.

Use gated groups: 5A merges first; 5B/5C/5D may run concurrently against merged
contracts; 5E follows all three; 5F follows integration. This is a narrow exception
to the earlier-wave-contract convention, not permission to depend on peer branches.
Concurrent ownership is disjoint. Deterministic merge order is 5A through 5F.

The first candidate is Contours to terrain plus a small live water-routing spread.
Source tools already exist; the remaining risks include host setup/reset semantics,
readability and safe quiescence across page changes. If a bounded feasibility spike
cannot support the water lesson, select a distinct contour-spacing/slope lesson and
record the choice before dependent sessions. No scripted process or solver expansion
to rescue a weak introductory example.

Renumber unfinished hardening 5A–5D to 6A–6D and revise it around the complete reader
journey. Rewrite Stage 2–4 outlines so a visible supported lesson, reuse motivated by
that lesson, and actual pilot observations govern expansion. Engine extraction,
DEM loading and new model families are capabilities, not standalone product exits.

Historical failed/pending morphology, human listening, target hardware and expert
review remain accurately recorded. The new research entry must preserve science,
backend and privacy regressions. Event schema v1 is not extended to new lessons
or populated with fake prediction events. Product acceptance is separate from
implementation integration; human observations cannot be inferred from automation.

## D-5A — Playable reader contracts and fixed opening sequence (2026-11-09)

Session 5A selects cartography.contours followed by hydrology.water-path from the
actual InkView/CPU-solver exploratory trial recorded under
`docs/review/book-revision/feasibility/`. The initial pale water encoding is retained;
a tighter, explicitly labelled depth ramp makes the solver's wet routes legible
at the target illustration size. These are feasibility observations, not a
prospective science validation, human study or GPU/classroom hardware pass.

Contour lift changes presentation of the same extracted geometry. Moving the
stable-id spring changes water routing on the prepared fixed terrain; residual
water remains. No erosion, waterfall, field-year or general outlet claim is made.
The bounded contour-spacing alternative is therefore not selected.

Add a backward-compatible ReaderSpread validator with optional question/challenge
and explicit static/live scope; keep legacy consumers runnable through 5E. Freeze
scene lifecycle, binding, navigation and authored-initialization types plus wiring
fixtures. Specifications live in `docs/review/book-revision/contracts.md`.

Missing shared primitives have concrete owners: 5B drains in-flight mutations and
publishes a final sample before departure, and accepts validated/cloned authored
initial terrain with exact domain/configuration and sources on each backend.
Existing valley-specific baselines must not describe a newly placed source. 5D
extracts reusable selected-contour/lift/source interaction from the spike using
public APIs and supplies sourced claims and prospective evidence. These are small
host/view additions, not new solver physics or spread-local simulation code.
5C owns bounded composition, gesture arbitration, focus, history and responsive
pages. 5E migrates the actual default route; this spike does not replace that work.

Retain actual paused model instances across turns, never restore from HostSample.
Presentation/reveal/level changes remain independent of readiness and model state.
Explicit reset restores authored configuration, terrain and sources, pauses and
resets presentation while retaining level. Instrumentation v1 remains confined
to the existing research example. Product, science, human accessibility and target
hardware acceptance remain separately open. Dependents start only after 5A merge.

## D-5BCD — Parallel implementation decisions (2026-11-09)

The owner authorized sessions 5B, 5C and 5D in parallel with GPT-6.1 Sol at high
reasoning, with the lead responsible for shared decisions. All start from merged
5A commit 8069a7f in isolated session worktrees. Keep the frozen contour/water
sequence and composition: the real ink illustration dominates, Georgia carries
the book text, and meaningful blue water plus non-colour marks explain quantities.
The installed frontend-design skill guides frontend work; the Playwright skill
was downloaded through the installer Git fallback for browser verification.

Approve additive shell suspend/resume methods for 5E research navigation. They
preserve retained scene instances without revising the frozen base contract or
migrating the default app ahead of its assigned session. No new animation library
is required for the restrained page turn.

For authored terrain, make valley-specific diagnostics explicitly unavailable.
Do not present empty legacy compatibility values as observations of a moved source.
The existing solver rejects off-grid source operations; UI constraints may bound
input before submission, but source markers update only after accepted operations.
This keeps presentation and model aligned without changing solver semantics.

Approve 5D's prospective source-location comparison on three authored slope
variants (0.03, 0.04, 0.05), since changing a seed does not vary explicitly authored
geometry. Register the complete configuration, source-only intervention, fixed
horizon, display threshold and directional wet-cell comparison before acceptance
runs; retain all outcomes. The intended claim concerns wet extent on these prepared
surfaces, not symmetric outlets, general catchment laws or field rates. Geometry
and rendered checks independently support the contour identity claim. Expert,
human usability/accessibility and hardware review remain pending.

Approve additive `SimHost.step(steps): Promise<void>` and `resume(playing=false)`
for the new scene adapter. Explicit fixed-step response must share host mutation
ordering and quiescence rather than bypassing it with raw transport requests.
Reopening a settled host without autoplay lets reduced-motion readers continue
editing a source. Preserve the retained fractional fixed-step state and omit
wall-clock catch-up on return. These are bounded runtime APIs, not new physics.

Approve placing the quiet research link in the existing book header and reducing
navigation's vertical padding. The first desktop capture's separate research row
pushed the full composition beyond 1366x768. Reuse existing chrome space while
retaining 18px text, 44px targets and the dominant illustration; phone headers
wrap naturally. This addresses viewport fit without shrinking the lesson.

Approve hiding the redundant lift slider on the water lesson: source placement
is its primary gesture; the contour lesson retains its accessible lift control.
The rendered evidence showed readable depth and retained old water, so UI scope
can be simplified without inventing another control or changing the model.

GPU checks distinguish unavailable adapters from implementation failures. The
forced software-rendering setup had no WebGPU adapter; native Chrome subsequently
passed authored CPU/Worker/GPU comparison and the existing GPU suite. This is
browser correctness evidence, not target-device performance acceptance.

## D-5E — Integrate the default book on the local review stack (2026-11-09)

The owner requested 5E work, commit and merge into the review branch. Local main
is still `8069a7f` (5A); `s1/w5/5bcd-lead` at `d74ecc0` contains the combined
5B–5D review stack. This explicit destination overrides the wave's main-first
launch rule for this session only. Use an isolated `s1/w5/5e-migration` worktree,
verify it, and merge back to that review branch. Do not merge main or imply remote
publication/product acceptance.

Make the new contour/water reader the default; retain the valley research route
and its evidence. Replace its last prediction-gated lifecycle caller and remove
the temporary adapter/export/tests. Preserve recorded endpoint-conditioned
feedback without locking live play, replay or general explanation. Keep schema v1
instrumentation exclusively in research and retain a settled model on route return.
See `docs/review/book-revision/migration.md` for bounded compatibility changes,
verification and the unchanged human/scientific review limits.

## 2026-11-09 · 5F local review and responsive content height

The owner requests 5F and merge into the review branch. Continue from `d01f631`
on `s1/w5/5bcd-lead`, using an isolated `s1/w5/5f-acceptance` worktree. This extends
5E's explicitly authorized local-review exception; main remains at 5A and pending
human/expert/hardware gates cannot be closed by merging.

Actual 320 CSS px captures show scene captions/legends overlapping scope/footer:
the shell's square mobile scene box ignores the real adapter's content height.
Bounded exception to 5F path ownership: change only app `reader-layout.css` to let
mobile scene content determine height. Keep renderer/model/physics untouched, and
add actual-page non-overlap regression checks. Human listening/true browser zoom
remain 6B work; visual correctness alone does not prove comprehension.

## D-W5-GLACIAL — Review completed branches; simplify transition; natural colours

2026-11-09, latest owner clarification. Fetched remote B/C/D/E; the combined
s1/w5/5bcd-lead head e7e7f0a also includes F. Main remains 8069a7f. Review these
completed foundations, not the stale claim that dependent sessions have not begun.
This session is s1/w5/current-review in its own worktree based on that review head.

The 2D drawing → artistic transition → complete 3D scene pipeline is settled.
Exact spatial mapping is not required. Contours are incidental, not a product
identity or mandatory first lesson. This supersedes the excessive mapping constraints
in the earlier unmerged scene-direction draft, as well as the old contour-first choice.
Keep the simple book, allow natural and varied scene colours; supersede the two-colour
rule in AGENTS and the handoff. Model quantities remain honest and accessible.

The preferred opening is U-shaped valley formation, superseding the rain/runoff
candidate. Discuss its concrete scene/interaction before implementation planning.
Reopen glacial process scope specifically for this lesson. Existing hydraulics do
not validate glacial erosion; the transition may be artistic, but formation may
not be a keyframed V-to-U shape passed off as a process. Missing shared capability
is glacier flow/erosion, to be scoped and sourced after scene agreement.

Save the four owner-supplied original PNGs with provenance, hashes and third-party
rights notice under docs/references/owner-2026-11-09. No reference imagery becomes
a production asset. Preserve prior trials and acceptance evidence unchanged.

Owned scope: direction/plan/review docs, reference assets and append-only decisions.
Minimal AGENTS wording change is required to remove the directly contradicted colour
restriction. No production code or solver is changed in this review. The previous
unmerged scene-direction worktree is retained but superseded by these current edits.

## D-W5-INTERACT-TIME — Condition changes and temporal observation belong together

2026-11-09. The owner explicitly chooses both: change a physical condition through
UI/direct 3D interaction and watch/inspect different valley formations over time.
This supersedes the earlier discussion-only hold and either/or question. U-shaped
valley formation, artistic drawing-to-scene entrance, optional contours and natural
scene colours remain settled. Planning is authorized; this session launches no build.

Add 5G–5N inside current Wave 5: G scientific feasibility/contracts and condition choice;
H CPU glacial process; I GPU parity; J intervention/timeline/comparison runtime;
K coloured scene and direct gesture; L focused content; M actual-book integration;
N prospective evidence and acceptance. Preserve A–F. Execution G → H → I/J/K/L →
M → N; merge G,H,I,J,K,L,M,N. Wave 6 follows N. Integrate reviewed foundations and
this direction into green main before dependent launches; no silent peer-WIP reliance.

The interaction contract is change → evolve → pause/inspect/replay → compare.
UI and 3D inputs share the accepted command path. Live condition changes apply at
fixed-step boundaries without resetting terrain. Past inspection preserves the live
head and cannot silently branch; comparison starts a named second run from the same
initial state except the declared intervention, with matched-time/shared-scale views.
Playback speed is not physics. Levels, camera, section and ice visibility are view-only.
Bound history and comparison resources; keep research instrumentation unchanged.

5G owns the bounded scientific choice of condition/law and must demonstrate a viable
process route. Do not default to water physics, target-shape tweening or a numerical
control without a physical meaning. Sources and budgets/ranges remain required;
new glacial CPU/GPU behavior needs explicit comparison. Failed feasibility stays failed.
A source's U-valley result does not validate ours or calibrate geological years.

PB9 plus GV1–GV8 record durable acceptance and session ownership. Every session names
its reader action, visible outcome and evidence. Product-contract changes require an
explicit owner decision; ordinary technical choices within it do not require asking
again. Preserve original uploaded references and archived scientific results.

Planning session continues on s1/w5/current-review. Owned scope: plan/product/handoff/
review docs, README, append-only decisions; minimal AGENTS entry prevents stale briefs
from driving future work. No production code, evidence outcomes or lockfile changed.

## D-W5-INTEGRATION — One canonical branch for current and future Wave 5 sessions

2026-11-09. The owner explicitly requests consolidation of all Wave 5 branch work
and current plans into one branch for future sessions. Create s1/w5/integration by
fast-forwarding main's 5A baseline to 7bf47d3, which already contains all committed
Wave 5 tips: revision plan, A, B/C/D, E, F, updated direction, original references
and G–N planning. Record exact ancestry in docs/review/wave-5-integration/sources.json.
No cherry-pick duplication, solver rewrite or manual lockfile merge is needed.

The earlier uncommitted scene-direction draft is preserved byte-for-byte as an
archival patch in the integration handover. Its obsolete strict-transition and
rain-first wording does not replace the later owner decisions. Leave its source
worktree intact. Old branches remain traceable; this integration branch is the
single active base, not an instruction to delete user work.

Future Wave 5 sessions branch from and target PRs to s1/w5/integration, in the
planned merge order; dependencies must already be merged there and checks green.
This supersedes the G–N plan's prerequisite to merge everything into main before
5G. It is a scoped owner-authorized exception, not permission to consume sibling
WIP. Main remains unchanged. This consolidation does not start 5G or close any
scientific, product, human or hardware gate. Push the verified branch for reuse.

Integration session owns provenance/archive and minimal workflow/status updates in
AGENTS, README, current plans and this appended decision; no production code changes.

## D-W5-GLACIAL-REFINE — Rock-type runs, separate comparison, tilted book, GPU; plan rewritten

2026-11-09. Owner answers after the plan discussion, on s1/w5/glacial-plan-refine from
s1/w5/integration (d62bb19):

1. **Condition = rock type** (hardness/composition): two or three rock types with natural
   colours and lithology patterns, chosen on the page or by dropping a specimen on the 3D
   block. This supersedes the open "ice supply / rock resistance / sliding" choice in 5G.
   Rock cannot change under a moving glacier, so a choice applies to a whole run; choosing
   while a run exists starts a new run and keeps the earlier one. Mid-run condition commands
   are removed.
2. **Scene:** a full valley reach with a glacier and its snout (V below, U under the ice) is
   approved. An idealised uniform reach is only the feasibility fallback.
3. **Comparison uses separate runs, not paired runs.** Kept earlier runs are looked up at
   matched model time (ghost profile on the front face, margin-note numbers, optional
   flip). Lockstep A/B, checkpoint replay-to-any-time and command logs are dropped.
   Interpretation recorded here so the owner can correct it.
4. **Tilted 3D book**, with the diorama standing on and above the right page; flat fallback
   on phones, reduced motion and large zoom.
5. **GPU ships too**, as far as it actually gets: 5I starts after 5G and is used where the
   registered CPU/GPU comparison passes; CPU is always the fallback; gaps are recorded.
6. The reference `04-geography-scene.png` is removed and replaced by the owner's
   `Water-cycle-illustration.png` as `04-water-cycle-illustration.png` (hash in manifest).

Plan change: `docs/plan/stage-1-wave-5-glacial.md` is rewritten as the single source for
the first lesson, leading with a storyboard of the page, and the guardrails become a
checklist. The session structure is now:

- 5G glacier model and CPU, running in parallel with 5H book stage, look and transition
  (finishing on 5G captures);
- **R1 owner review gate**, where presentation contracts freeze;
- 5I GPU (from 5G), then 5J runs/timeline, 5K scene interaction and 5L content;
- 5M integration and chrome restyle, then 5N acceptance.

GV1–GV9 replace GV1–GV8 (GV9 = GPU parity or recorded gap). The duplicated status
paragraph in four plan files is replaced by one pointer.

Owned scope: plan/product/handoff/README/AGENTS wording, the reference swap and this entry.
No production code, evidence or lockfile changed. Nothing is launched.

## D-W5-5G — Glacier model: plan-view shallow ice with a lateral-drag shape factor; contracts frozen

2026-11-10. Session 5G (`s1/w5/5g-glacier-model`, from s1/w5/integration ee4959d).

**Decisions (technical, inside the plan).**

1. **Model.** `@hachure/glacier` (new package): vertically integrated shallow-ice flow (Glen n = 3,
   temperate A) with Weertman sliding (m = 2), a fixed authored snowline mass balance, erosion
   ė ∝ u_b² scaled by rock erodibility and an explicit time compression (S = 120), and threshold
   rock-wall failure per rock. Fixed step 0.0025 model years (the converged step; at 0.01 the stability
   cap fired on 8–12 % of edges and doubled erosion); seeded start; Jacobi-ordered passes for the
   GPU port. Feasible with the full valley reach (owner decision 7); the idealised-reach fallback was not
   needed. Record: `docs/science/glacial/feasibility.md`.
2. **The U needs a lateral-drag correction.** Plain shallow ice keeps a V (attempt A0, as Seddik et al.
   2009). A per-column shape factor from the channel "area method" shields the V bottom and moves the
   erosion maxima onto the lower walls (Harbor et al. 1988 pattern). It is a geometric estimate, not a
   higher-order stress solution — flagged for expert review.
3. **Mass balance on the starting bed.** Every rock gets the same ice supply, so a rock comparison
   compares rocks. The omitted feedback (a deepening valley lowers and shrinks its glacier) confounded
   the comparison when switched on (attempt A2a, kept as an arm).
4. **Regularisations, each recorded as a failed attempt first:** sliding/erosion stress capped at
   200 kPa (runaway at steep thin fronts, A2b); thin ice (< 40 m, ramp to 120 m) is cold-based and does
   not slide (ridges eroded away, A2c); a 3-cell ice-free, non-eroding frame at the grid border; a
   non-finite guard that throws.
5. **Rock set proposal:** shale (soft), sandstone (medium), granite (hard); erodibility 2 / 1 / 0.4,
   critical wall 34° / 42° / 55°. Ordering sourced; numbers are teaching choices. Names, colours and
   patterns are for R1.
6. **Frozen contracts** (exported from `@hachure/glacier`): `GlacierConfig` (+ `DEFAULT_GLACIER_CONFIG`,
   limits, `resolveGlacierConfig`), `ROCK_TYPES`, `GlacierSnapshot`/`GLACIER_LAYERS`, `GlacierSolver`,
   `GlacierProbes`, `measureSection`/`SectionMeasure`, and the captured-run format
   `hachure-glacier-capture` v1 (`encodeCapturedRun`/`decodeCapturedRun`). Grid orientation: index
   `j * nx + i`, the valley runs along i, downstream = decreasing i (i = 0 the mouth).
7. **Time label.** Model years with erosion compressed 120×; never geological years. Horizon 300 model
   years; snapshot interval 20 model years; a 16-snapshot run is ~1.6 MB quantized; live + 2 kept runs
   ≈ 4.7 MB (proposal for 5J).
8. **Section probes measure the lower valley** (wall slope 10–60 % of depth, shape fit 5–60 %) and the
   registered rock comparison uses the steepest wall and floor lowering, because the upper V above the
   ice is untouched and dilutes whole-profile averages.

**Deviations from the 5G brief.** The brief's claim "softer rock is wider and deeper" is tested with
depth read as _floor lowering_; rim-to-floor depth is not ordered because soft rock also lowers its rims
(walls retreat). Registration thresholds were set after pilot runs (pilots recorded in feasibility.md).

**Cross-owned edits.** `eslint.config.js`: the `Math.random` ban now also covers `hachure/glacier/**`.
`pnpm-lock.yaml`: the new workspace package entry, as produced by `pnpm install`.

**Open questions.** (a) Expert review of the area-method shape factor and of the cold-based ramp.
(b) Whether R1 wants the "deeper" claim on the page at all, or only "wider in soft rock, steeper walls in
hard rock". (c) Overdeepening: the under-ice floor ends below the floor down-valley; a drawn river below
the snout must not assume a bed that drains down-valley (5H/5K). (d) CPU cost at the converged step ≈ 0.3 s
per model year on the reference grid in Node (one core, measured under load): a 300-year run is ~1.5 min
of worker time at full speed. Faster playback needs the GPU (5I) or a coarser grid; the fixed step must
not grow.

## D-W5-5G2 — Enclosed valley head; grid 160 × 64; protocol re-registered (deviation)

2026-11-10. Session 5G2 (`s1/w5/5g2-enclosed-head`, from s1/w5/integration 9da4fad).

**Deviation from the 5G registration, recorded before the 5G2 registered runs.** The 5G protocol was
registered on `v-valley/1` (open head, 128 × 96). 5G2 re-registers it on a new start and grid; the 5G
results and evidence stay in the record (`docs/review/glacial/model/5g-open-head/`, feasibility.md).

1. **Start `v-valley/2`** (`DEFAULT_V_VALLEY`): the 5G valley over its first 5080 m (same floor and
   26° V walls, so the registered sections keep their start shape), ending in a head basin enclosed on
   three sides by a crest that wraps round the valley end; crest rise 800 m (was 1000 m, to fit the grid);
   outer flanks 14° (was 8°) falling to a quarter of the way from floor to crest (was half), so the ground
   outside the crest carries only thin, cold-based ice. The 5G start is kept as `OPEN_HEAD_V_VALLEY`;
   two new preset options (`valleyLengthM`, `outerFlankFloorFraction`) reproduce it bitwise.
2. **Grid 160 × 64 cells at 40 m** (was 128 × 96): `DEFAULT_GLACIER_CONFIG.nx/ny` changed. Captures
   and consumers read the grid from the manifest; orientation, indexing and every other config value are
   unchanged. A capture snapshot is now 81 920 bytes (was 98 304).
3. **Unchanged:** physics, `GlacierConfig`/state/probe contracts, capture format v1, time compression
   (120), horizon (300 model years), snapshot interval, matched times, seeds, section columns, thresholds.
4. **Added readings:** T1 and R1–R4 also read at matched erosion (E-T1, E-R1–E-R4), beside the
   matched-time verdicts; the 5G open-head start re-run as two recorded attempt arms.
5. **Chosen after four pilot variants** (feasibility.md, P1–P4), which already showed that no tested
   start or compression gives every rock a T1 trough at one common time (erodibility differs 5×).

**Numerical fix (physics code), recorded before the final registered run.** 5H found an odd/even
(2Δx) ripple in the eroded shale bed. Confirmed (odd/even share of bed lowering 0.31–0.44 in the first
5G2 registered run, P5, kept). Cause: the cell sliding speed that drives erosion used a centred surface
gradient and the cell's own thickness, blind to an odd/even surface mode, so thicker ice over a low cell
eroded faster and the ripple fed itself. Fix: the cell stress is the mean of its edge stresses (gradient
components weighted by the edge-mean thickness (2H + H₋ + H₊)/4). Share after the fix 0.12–0.21; a
residual ±10 m alternation remains on the axis in the head basin, where the flux stability cap is active.
Guards: `cpu/solver.test.ts` (odd/even bed under a smooth surface gives no odd/even sliding) and
`captures.test.ts` (odd/even share of bed lowering < 0.3). No GPU solver exists yet (5I); the 5I
comparison must use this discretisation. The 5G registered numbers were computed with the artefact.

**Start correction, before the final registered run.** A new test found one cell pair at the head-basin
crest corner at 34.9°, above shale's 34° (shale would fail with no ice). Outer flanks 20° → 14°
(steepest pair 31.4°).

**Registered result (300 model years).** Pass: R1, R4, S1 (granite 46° vs shale 35° at equal erosion),
E-R1, E-R3, K1, K2, N1; T2 except shale seeds 2–3; T1 sandstone seed 1. Fail: T1 in 8 of 9 arms (granite
lowered 18 m < 30 m while floor +83 m, b +0.3, wall +19°; shale and sandstone seeds 2–3: b fell as walls
retreated), T2 shale seeds 2–3 (growing glacier reached the control section), R2, R3, E-T1 (lowering
18–27 m at the matched area), E-R2, E-R4. The shale glacier no longer leaks (0.57 → 1.10 km³).

**Captures** regenerated at the same paths on 160 × 64: 16 snapshots × 81 920 B = 1.31 MB each,
3.93 MB in total (was 4.72 MB), inside the 5H bundle budget without reducing snapshots or resolution.

**Plan-changing facts.** (a) The grid is now 160 × 64 (6.4 × 2.56 km): 5H/5K framing must read it from
the manifest. (b) The full-T1 claim is not supported in any single horizon; the page should teach the
S1/E-R3 shape claim and the V → trough change by shape, or adopt a per-rock horizon. (c) The 30 m
lowering threshold should go to expert review. (d) Shale's growing glacier can reach the control reach.

## D-5H-STAGE — Book stage, scene look and transition (session 5H, draft on the authored fixture)

2026-11-09. Session 5H, branch s1/w5/5h-book-stage from s1/w5/integration (ee4959d). Technical
choices inside the plan; R1 may change any of the look values.

1. **Camera match, not a 3D book model.** The book stays DOM under CSS `perspective` +
   `rotateX(tilt)` about its centre; one canvas covers the stage and a perspective camera at the
   CSS perspective distance (vertical FOV spanning the stage height) projects page points exactly
   where the browser draws them (unit-tested against the CSS formula). The diorama lives in a
   page-local frame (X right, Y up off the paper, Z down the page), so shadows land on the right
   words and the block may rise past the figure frame. Text stays DOM and selectable.
2. **Tilt 46°, block yawed −24° on the page.** At the 24–34° first tried, the block was seen almost
   from above and read as a map; 46° (close to the reference) plus a three-quarter yaw makes it read
   as an object standing on the page. Cost: the left page's text is foreshortened. R1 question.
3. **Flat fallback** when `(max-width: 60rem), (max-height: 34rem), (prefers-reduced-motion: reduce),
(forced-colors: active)` matches, when the root font size is ≥ 24 px, or when the tilted book would
   not fit the stage. The canvas then sits inside the figure frame (slightly larger, so the cast
   shadow is not clipped). No WebGL/WebGPU → the drawing is the figure.
4. **Natural look:** banded (three-tone) unlit node materials with their own light term and a shared
   paper → colour wash uniform; real shadow map only for the paper shadow-catcher. Exposed rock on
   the land surface is a weathered grey tinted by the rock; the full lithology colour and pattern
   show on the block's sides, where the rock is seen in section. Lithology tiles follow FGDC-STD-013
   conventions and render from one definition to canvas (3D) and SVG (page swatches).
5. **Dressing is presentation read from state** (snow above the snowline on gentle ground; meadow and
   trees low and gentle; river by steepest descent below the snout, never back up-valley or onto
   ice; flow marks along ice velocity or, without it, down the ice-surface slope). Deterministic
   integer hash, no `Math.random()`. 5K owns the production dressing in `ink/src/glacial`.
6. **Fig. 1 drawing** is generated deterministically from the authored landform (floating-horizon
   profile lines), not from model output; an illustrator's SVG can replace `glacialDrawingSvg()`.
7. **Fixture honesty:** two independent authored frames (V start; U trough with glacier), no tween,
   no model time, labelled "Authored fixture — not a model run" on every view. Removed from the review
   path once 5G's captured runs are merged.

Open questions for R1: tilt angle vs. text legibility; whether cutting the block should re-centre it
(today the remaining block stays put, so it shrinks towards the frame top); the provisional rock set
and colours (5G decides the set); whether labels belong on Fig. 1; the desk/board colours.

Cross-owned edits: `hachure/ink/package.json` (two export lines: `./stage`, `./transition`);
`uplift/book/src/app/routes.ts` (one bounded `?review=glacial-stage` route entry).

## D-5H-RUNS — Review build on 5G's captured runs (session 5H, continued)

2026-11-10. Session 5H, rebased onto s1/w5/integration (9da4fad, 5G merged). Technical choices inside the
plan.

1. **Captures load as assets.** `runs.ts` imports each capture's manifest and payload with `?url` from
   `@hachure/glacier/captures/*` and decodes with `decodeCapturedRun`. Grid size, metres per cell, snapshot
   count, rock, snowline, erosion speed-up and model time come from each manifest; nothing is hardcoded, so
   5G2's regenerated captures drop in. The grid orientation (valley along columns, downstream = decreasing
   i) is the capture format's, held once as `CAPTURE_ORIENTATION`. Cost: about 4.7 MB of `.bin` assets in
   the build (fetched only by the review route).
2. **Margin notes bind to the model's probe.** Floor width, depth, floor lowering since the start and the
   steepest wall at the front face are `measureSection` results at the grid column under the cut
   (`describe().cutAlongIndex` → `valleyGridIndex`). Shown rounded to 10 m (the grid is 40 m).
3. **One vertical frame for all runs** (`ValleyDiorama.setElevationRange`): shale lowers its bed far below
   the starting minimum, and a per-snapshot frame made the block jump when the rock or time changed.
4. **Rock choice switches run** (same model time); the rock-look preview stays only for the fixture. The
   look set now matches the model's rocks (shale dashes, sandstone stipple, granite crosses).
5. **Time ruler**: a native range input over recorded snapshots (one tick each), Play/Pause at a fixed
   presentation rate (650 ms per snapshot). Playback only shows recorded snapshots; it never simulates.
6. **Treeline** stays illustrative: 300 m below the model's snowline (the model has no vegetation).
7. **Science on the page**: "soft rock wears away faster and deeper; hard rock keeps steeper walls"
   (marked expert-review; checked against the captures in `runs.test.ts`). Not "softer rock gives a wider
   floor": the runs do not order floor width by rock.

**Facts for the plan.** In the current captures the ice covers almost the whole upper basin, so the U only
reads clearly in shale near the head at mid-run (shape exponent ≈ 1.9 at 200 model years); by 300 model
years shale has worn down its rims as well, and granite barely changes (floor ≈ 20 m lower). Sandstone and
granite sections stay close to V by the model's own shape fit. Shale's eroded bed has an odd/even ripple
along the valley (floor width ≈ 75 m and ≈ 300 m in neighbouring columns near the head at 200 model years),
which looks like a grid-scale (2Δx) mode in the erosion or wall-failure update; flagged for 5G2/5I. 5G2's enclosed head may change this; the
capture positions `U_FRAME`/`U_CUT` in `docs/review/glacial/stage/capture.mjs` must be rechecked then.

**Cross-owned edits.** `uplift/book/package.json`: one dependency line (`@hachure/glacier`), so the book
imports the captures and `measureSection` through public entry points. `pnpm-lock.yaml`: the matching
importer entry, as produced by `pnpm install`.

## D-5H-R1 — R1 review build recaptured on 5G2's captures; U framing re-picked (session 5H, final)

2026-11-10. Session 5H, rebased onto s1/w5/integration (1216f67, 5G2 merged). Technical choices inside the
plan.

1. **Grid read from the manifest, end to end.** `runs.ts`, the block, the front-face slider (one grid cell
   per step) and the section probe already took grid, cell size, snapshot count, rock, snowline and time from
   each capture; the 160 × 64 captures dropped in unchanged. Two places still assumed the 5G grid and are
   fixed: `capture.mjs` (the U cut was `21 / 127`; it now reads `grid.nx` and snapshot times from the
   manifests and chooses grid columns and model years), and the rock-sentence test in `runs.test.ts` (it
   sampled fractions 0.55/0.7/0.85 of the grid, which on 160 columns fall in the overdeepened head reach; it
   now checks the registered under-ice section, `PROTOCOL_SECTIONS.underIce`, and the review U face).
2. **U framing, measured.** Scanning `measureSection` over every column and snapshot (seed 1): the clearest
   robust U under the ice in the valley is shale at 300 model years, column i = 51 (b 1.73; b ≥ 1.67 over
   i = 49–53; floor 209 m; lowered 57 m; 200 m of ice). At that cut and time every rock is a U by shape
   (b 1.73 / 1.59 / 1.61), the floor is lowered 57 / 40 / 18 m and the steepest wall is 35 / 42 / 45°
   (shale / sandstone / granite): the page sentence holds there, so the rock comparison uses the same cut and
   the reader-default time (the last snapshot). Floor width is 209 / 177 / 179 m: not ordered, no claim.
   Columns above about i = 94 are left out of the pick: the head-basin overdeepening lowers every rock
   there by 100–230 m (granite included, with 55° walls), which would invert the teaching.
3. **Matched-erosion captures, extra and labelled.** At the registered section i = 74, the snapshots
   nearest to granite's 300-year eroded area (13 726 m²) are shale 80 years (86 %), sandstone 160 years
   (109 %), granite 300 years; `matched-erosion-<rock>-<years>yr.png` show each rock there. Review only;
   the page default and claim are unchanged.

**Facts for the plan.** (a) With 5G2 the U reads in all three rocks at one honest cut (i = 51, 300 years),
which the 5G captures could not do; at the registered i = 74 shale's U has already degraded by 300 years
(b 0.77, from 1.64 at 140 years). (b) The head-basin overdeepening is the most eye-catching erosion in
every run, granite included; a reader who slides the face to the head will see hard rock cut deep. Expert
review should decide whether that is acceptable or needs a margin note. (c) No column-to-column (odd/even)
alternation is left in shale's valley reach (i < 100); the floor width still jumps in steps (220 → 156 →
74 m at 300 years) where the probe's 25 m floor band catches or misses a bench, and shale's U ends abruptly
up-valley (b 1.66 at i = 54, 1.07 at i = 55), so the margin notes can jump when the face moves one cell.

## D-W5-5I — GPU glacier: WebGPU port passes the registered CPU/GPU comparison; WebGPU recommended default

2026-11-10. Session 5I (`s1/w5/5i-gpu-glacier`, from s1/w5/integration 2548317). Technical choices inside the
plan. Evidence: `docs/review/glacial/gpu/` (README, `tolerances.md`, `results-local.json`, `runs/`).

1. **Implementation.** `@hachure/glacier/gpu` ports the frozen 5G/5G2 model to eight WebGPU compute kernels.
   The pass order, start, fixed step, frame and **D-W5-5G2 edge-mean stress discretisation** all match the CPU.
   It uses raw WebGPU, not Three.js: the glacier package stays renderer-free and worker-capable, and seven
   packed storage buffers stay inside the portable limit of eight. The patterns follow D-S1-W3-3C/D-S1-W4-4A:
   reject capability failures before work, serialize operations, read one status word per batch, latch
   failures, use no float atomics and keep one writer per output word. `AsyncGlacierSolver` mirrors the frozen
   `GlacierSolver` method for method, and `asyncCpuGlacier` wraps the unchanged CPU in it.
2. **Precision.** Bed and ice are two float32 lanes (hi + lo) relative to the run's local datum, updated by
   error-free two-sum. Surface and bed differences are taken lane by lane. This is the split representation from
   D-2A-1. Constants and the starting-bed balance are computed in Float64 and rounded once. Budgets are per-cell
   compensated ledgers summed in Float64 on the host. Counters are u32, and the step counter is a host integer.
   Results are not bitwise equal to the CPU or across devices. Same-device replay is bitwise.
3. **Tolerances declared before the run** (commit `ba8b399`), derived from the registered protocol. Section
   measures must agree within half a registered rock step (2.5 m, 1°, b 0.1, eroded area 2.5 % or 500 m²).
   Every verdict must match, with a declared borderline rule. Probes must agree within 1–5 %. Budgets must agree
   within 1–2.5 %, with GPU closure within 1e-5. Fields must agree within RMS/p99 of 0.5/2.5 m for bed,
   1/5 m for ice and 2/10 m/yr for speed. Section profiles must agree within 2.5 m. The early interval uses one
   tenth of the field bounds. Determinism, precision and fallback are gates as well.
4. **Result (Intel Arc 140V, headless Chrome): every gate passed.** The arms were the nine rock arms, both
   controls and the half step, run to 300 model years. Seed-1 arms were checked against a live CPU, which
   reproduced the 5G2 record hashes bitwise. Worst field difference: bed 8.3 mm (shale), sandstone 0.94 mm,
   granite 0.30 mm. Section measures agreed to ≤ 0.6 mm and 1e-4°. Probes agreed to relative ≤ 2.1e-6. GPU
   budget closure was ≤ 9.5e-10. **All 39 registered verdicts were identical**, including the three borderline
   ones.
5. **Speed (diagnostic, this machine).** GPU 7.7 ms per model year against CPU 292 ms in the same browser,
   about 38×. A 300-year run takes about 2.3 s on the GPU and about 90 s on the CPU.
6. **Recommended default backend: WebGPU**, by the rule declared in advance (all gates pass and at least 2×
   faster). `GLACIER_GPU_PARITY` records it, and a test ties that record to the committed evidence. **CPU is
   always the fallback.**
7. **Per-device check (addition).** Parity was observed on one adapter, so `selectGlacierBackend({prefer:
"auto"})` first runs `checkGlacierGpuDevice`. That check runs 80 steps under a 150 m ice slab, which
   exercises every kernel, and requires GPU and CPU to agree within 1 cm. It costs about 0.1–0.15 s. A shader
   with skewed erosion fails it. The 1 cm bound was written in code before the check first ran, and was
   committed with the results.
8. **Fallback.** For `"auto"`, a creation, device-check or capability failure falls back to the CPU with
   `fallbackReason` and a typed `GlacierGpuError.reason`. An explicit `"webgpu"` request rejects rather than
   being served by the CPU. A mid-run failure rejects and latches the run. The run never continues on another
   backend. `restartOnCpu` starts a new, labelled CPU run from the authored start. All paths are tested, in
   Node with stubs and in real Chrome with forced faults.

**Cross-owned edits.** `hachure/glacier/package.json`: the `./gpu` export, a `test:gpu` script and
devDependencies `@vitest/browser-playwright` and `playwright`, at the versions terrain already pins.
`pnpm-lock.yaml`: regenerated by `pnpm install`. No CI change: adding `test:gpu` to the GPU workflow is
lead glue.

**Not done / open.** (a) Only one adapter has been observed. Other GPUs, mobile and non-Chrome browsers rely on
the device check. (b) The recorded failed attempts (A0, A2a, 5G open head) were not re-run on the GPU. (c) CI
does not run the glacier GPU suite. (d) The expert-review flags of the model (D-W5-5G) are unchanged by the
port.

**Plan-changing facts.** (a) 5J can make WebGPU the default glacier backend through `selectGlacierBackend`.
At about 38× the CPU, a whole 300-year run takes a few seconds, so playback speed is no longer CPU-bound.
5J should surface `backend` and `fallbackReason` to the deeper level or diagnostics, and should handle a
mid-run `GlacierGpuError` by offering a new CPU run, never by continuing. (b) 5M does **not** need to ship
the CPU with the GPU disabled. (c) GPU and CPU runs of the same rock are numerically different runs (millimetres
apart), so kept runs should carry their backend label, and comparisons across backends should stay at
matched times, as already planned.

## D-R1-refinements · 2026-11-11 · Book depth and upright reading

The owner requested a thicker book, a higher far edge / steeper reading slope, and enlarged
web text panels matching their visual reference. This follow-up is scoped to 5H's glacial
review composition; no solver, scientific copy or recorded run changes.

- Layer twelve ruled paper edges above a deeper cloth cover.
- Use a 36-degree CSS camera pitch (previously 46): reducing rotation from face-on raises
  the far edge in the viewport. The existing stage camera consumes the same angle.
- Provide explicit keyboard/touch reading actions for lesson, vocabulary, explanation and
  bound notes. Move the original DOM into an upright nonmodal panel, preserving live
  bindings and disclosure state. Reserve its exact layout height so the scene does not shift.
  Closing restores the text and trigger focus. Reduced motion omits the entrance animation.
- Short laptops show keyword terms on paper and full definitions in the reading panel.
  Phones retain flat readable pages. The supplied reference is visual direction only.
- This implements the requested R1 adjustments; it does not declare final owner acceptance
  or freeze all remaining presentation/gesture decisions.

## D-R1-binding · 2026-11-11 · Recessed binding and separate fore-edges

The owner asked for a sunken centre binding and visible left/right page stacks, replacing
the flat slab and shadow-only gutter. Add createBookBinding to the public Ink stage entry
point: CSS-3D paper facets descend below the reading plane into a rounded trough; a shaped
front face and two splayed fore-edges expose ruled paper layers. The cover sits below them.
This is a reusable book furniture primitive, not custom spread simulation code. The review
only mounts/disposes it and supplies the paper colour. Both figure and readable DOM retain
their original plane, so the matched camera and model state are unaffected.

Keep the physical furniture hidden in flat phone/reduced-motion fallback. Preserve the
existing reading panels, focus return and live-bound notes. No scientific claims or model
parameters changed. Desktop and laptop captures show the recessed silhouette at both ends
of the binding and visible layers on both outer edges.

## D-W5-R2 — bounded spine view and simultaneous reading copies (2026-11-11)

Owner review follow-up to R1: let readers lower the sight line and turn the whole
book/scene around a point just above the spine. Implemented in the shared Ink stage,
with matched CSS/WebGL transforms, a bounded tilt/turn, viewport fitting and immediate
view-only updates. The review page exposes drag, keyboard sliders, arrow-key rotation
and reset. The default sight line is lower; flat/reduced-motion layouts retain immediate
figure rotation without animating or tilting the text. No solver or recorded snapshot changes.

Reading panels now mirror the source DOM instead of moving it off the paper. Live notes
and explanation disclosure stay synchronized; copied IDs/references are renamed. Click
outside or Escape closes the panel; explicit close/Escape restores focus to its trigger.

Scope follows the 5H/R1 stage and glacial review paths. Base is the owner's latest reviewed
`s1/w5/r1-refinements` tip (7f78dd4), rather than the stale workspace main. This is an R1
refinement follow-up, not a claim that later glacial integration or scientific acceptance
is complete. See `docs/review/glacial/stage/r2-camera.md` for validation and handover.

## D-W5-R2b — direct camera gestures, bounded zoom and responsive stage (2026-11-12)

Owner follow-up: zoom is a view-only multiplier from the default fitted view (1) to
1.5, clamped in the shared stage. Tilted mode applies it to the matched DOM/scene
transform about the existing spine pivot; flat mode uses camera zoom. Mouse drag
on the scene/desk rotates, wheel zooms, and native sliders plus Reset view remain
keyboard equivalents. Lesson controls and reading regions do not initiate orbit;
Ctrl/Meta wheel remains browser-owned. Flat text scrolling remains native.

Replace the absolute, nowrap fieldset with a normal-flow responsive control grid.
Its measured height is reserved above the desk. Observe book, anchor and host layout
plus window/visual viewport resize. Remove the fixed flat figure height and let
page content determine paper height before fitting, so short windows do not leave
controls beyond the page edge. Media conditions select flat mode; zoom never does.

Design stays with the book's paper/ink/binding palette and serif labels. No model,
science, playback or solver changes. This continues R2 in its existing worktree.

## D-W5-R1 — Owner review gate: look, book and camera approved; shape claim; default cut; head-basin note

2026-11-11. Owner review gate R1 on main e46ab62 (5G, 5G2, 5H, 5I and the R1/R2 refinements merged).
Inputs: the 5H review build (`docs/review/glacial/stage/`, including `r1-refinements.md` and
`r2-camera.md`), D-W5-5G, D-W5-5G2, D-5H-STAGE, D-5H-RUNS, D-5H-R1, D-W5-5I, D-R1-refinements,
D-R1-binding, D-W5-R2 and D-W5-R2b. Presentation and gesture contracts freeze here for 5J, 5K and 5L.

**Owner decisions.**

1. **The book, as refined by the team, is approved and frozen.** This adopts D-R1-refinements, D-R1-binding,
   D-W5-R2 and D-W5-R2b as R1 decisions, superseding the 46° tilt of D-5H-STAGE 2:
   - a thicker book: twelve ruled paper edges above a deeper cloth cover;
   - a 36° default CSS camera pitch (higher far edge, steeper reading slope), with the three-quarter block
     yaw kept;
   - the recessed centre binding and splayed left/right fore-edges from the public Ink primitive
     `createBookBinding`, hidden in flat phone/reduced-motion fallback;
   - upright, nonmodal reading panels for lesson, vocabulary, explanation and bound notes that mirror the
     source DOM (live notes stay synchronised; Escape/close returns focus; click outside closes), with
     keyword terms on paper on short laptops and flat readable pages on phones;
   - the bounded spine view: tilt and turn about a point just above the spine, a lower default sight line,
     and zoom as a view-only multiplier from 1 (fitted) to 1.5;
   - direct gestures with equivalents: drag on scene/desk rotates, wheel zooms, sliders, arrow keys and
     Reset view; lesson controls and reading regions never start an orbit; Ctrl/Meta wheel stays with the
     browser; media conditions, never zoom, select flat mode;
   - the normal-flow responsive control grid with reserved height, and page content setting paper height.
     The flat-fallback rules of D-5H-STAGE 3 otherwise stand. 5K and 5M carry all of this into production
     unchanged.
2. **Rock set approved:** shale (soft), sandstone (medium), granite (hard), with the 5H lithology patterns
   and colours (shale dashes, sandstone stipple, granite crosses; FGDC-STD-013 conventions).
3. **Teach shape.** The page claim stays "soft rock wears away faster and deeper; hard rock keeps steeper
   walls", plus the V → U change shown by shape. No floor-width claim and no full-T1 claim. Claims rest on
   the registered S1/E-R3 results (D-W5-5G2); expert-review marks stay.
4. **Default front face: grid column i = 51 at the last snapshot**, for every rock (lead recommendation,
   owner accepted). At that cut all three rocks are U by the model's shape fit and the page sentence holds
   (D-5H-R1 2). The cut was picked _after_ scanning the runs, so it is a display choice, not a registered
   test: the registered section stays i = 74, and no page claim may rest on i = 51 alone. The default lives
   in the spread config as a grid column read against the capture manifest (5L), never as a typed number on
   the page; 5K consumes it.
5. **Head basin: keep the full cut range, add a bound note** (lead recommendation, owner accepted). The
   reader may slide the face anywhere; hiding model output would hide the model. When the section under the
   face is overdeepened, a margin note says that thick ice near the valley head can carve a basin deeper
   than the valley below it, even in hard rock. "Overdeepened" is computed from model state (the bed rises
   down-valley from the section, an adverse bed slope), not from a hard-coded column. Science text drafted
   and marked expert-review; source to cite (5L verifies): Cook & Swift (2012), _Subglacial basins: their
   origin and importance in glacial systems and landscapes_, Earth-Science Reviews 115. The expert question
   of D-5H-R1 (b) remains open; this note is the interim answer.
6. **Cutting does not re-centre the block.** The remaining block stays where it stands on the page; the
   spine view (item 1) is how the reader re-frames it.
7. **Fig. 1 gets labels.** A few leader-line labels in the textbook style (e.g. V-shaped valley, valley
   floor, valley head); words only, no numbers. 5K draws them on `glacialDrawingSvg()`, 5L owns the words.
8. **Desk and cover cloth: neutral, carrying no hue** (lead recommendation, owner accepted). Keep the
   warm-grey desk (`--gs-desk`). Change the cloth colour (`--gs-board`, dark green `#2f4a3f`, which competes
   with meadow, trees and lithology colours) to a dark warm neutral near `#3b352f`, applied to the boards
   and the `createBookBinding` cover alike. Colour only: the geometry, layering and binding of item 1 do not
   change. Owned by 5K (scene CSS) until 5M restyles the chrome.
9. **Margin notes stop jumping cell by cell** (lead recommendation, owner accepted). Notes read the section
   averaged over three neighbouring columns (120 m along the valley), and say so in the deeper level; values
   stay rounded to 10 m. Added as a new helper beside `measureSection` in `@hachure/glacier` (additive; the
   frozen `measureSection` contract is unchanged) by 5K, listed as a cross-owned edit. The registered
   protocol keeps the single-column measure.

**Frozen for 5J/5K/5L:** everything in items 1–9, and the specimen / cut / under-the-ice / time gestures as
built in 5H. Changes after this point go through a new owner decision.

**Branches.** `s1/w5/integration` is fast-forwarded to main (e46ab62 plus this entry), so Wave 5 sessions
keep branching from and targeting it (AGENTS.md) and consume the R1/R2 refinements.

**Not decided here:** the expert review of the shape factor, cold-based ramp, 30 m lowering threshold and
head-basin overdeepening (D-W5-5G, D-W5-5G2, D-5H-R1); human, hardware and screen-reader checks.

## D-W5-5L — Lesson content for From V to U: shape claim, bound notes, view config; overdeepened-note finding

2026-11-12. Session 5L (`s1/w5/5l-lesson-content`, from s1/w5/integration 8aee4cf). Technical and content
choices inside the plan and inside D-W5-R1. The contracts frozen at R1 are not reopened.

1. **Content.** `uplift/spreads/geomorph.u-valley/` holds the left page in editorial form. The text has two
   or three sentences per level, the five key words, an optional scored prediction and an unscored margin
   challenge. The prediction asks which rock is worn deeper after the same model time; the answer, shale, is
   backed by R4-deeper. The folder also holds the caption, the single limitation line, the Fig. 1 label
   words, rock names and help, bound margin-note and text-alternative templates, the deeper level, teacher
   notes and sources. It is a `ReaderSpread` validated at import against a glacier catalogue. The lesson
   number and figure number are data (`LESSON_NUMBER`, `FIGURE_NUMBER`) and the shell composes them, so no
   text types a digit.
2. **Teach shape (R1 item 3).** The page claim is "soft rock wears away faster and deeper; hard rock keeps
   steeper walls", plus V → U by shape. A claim/source register (`claims.ts`; prose in
   `docs/science/glacial/lesson/README.md`) is tested in three ways. Each reader paragraph names its claims.
   Each taught claim has a literature source and model evidence. Each verdict relied on passed (R1, R4, S1,
   E-R1, E-R3, K1, K2), or else a registered component holds in every arm (E-T1 b-rise; T2 floor unchanged).
   The width claim and the full-T1 claim are registered as not taught, and a test guards against them.
   Because R3 fails at early matched times, the flap and the teacher notes say to compare walls once both
   rocks have been worn.
3. **Bound values.** Every number is a declared probe (`bindings.ts`). The request kinds `glacier-run`,
   `glacier-section` (the averaged section, R1 item 9), `glacier-face`, `glacier-config`, `glacier-rock`,
   `lesson-display` and `glacier-section-series` are the contract for 5J/5K/5M. `glacier-config` and
   `glacier-rock` fields are tested against `GlacierConfig` and `RockType`. The schema has no glacier
   engine id, so `engine: "terrain"` is used (the handoff lists the lesson as "T (+ice)"); the field is not
   used for dispatch.
4. **View config (R1 items 4, 5, 9).** `U_VALLEY_VIEW` sets the default front face (grid column 51, last
   snapshot), the registered section (`PROTOCOL_SECTIONS.underIce`), note averaging (3 columns) and rounding
   (10 m), and the overdeepened threshold (5 m adverse rise, half the rounding). `resolveDefaultFrontFace`
   reads the defaults against a capture manifest and throws if the grid does not fit. The deeper level and
   the teacher notes say the cut is a display choice and that the claims rest on i = 74.
5. **Citation verified.** Cook & Swift (2012), _Earth-Science Reviews_ 115(4), 332–372,
   doi:10.1016/j.earscirev.2012.09.009, checked against the White Rose and Dundee repository records. Only
   the abstract was read; the full text could not be decoded in this session. The note claims only what the
   abstract supports.

**Finding that changes the plan (R1 item 5).** On the recorded runs with averaged floors, the R1 trigger
("the bed rises down-valley") never fires in granite or at the valley head. The deep head-basin lowering is
not an adverse slope, because the start floor rises steeply to the headwall. The trigger fires only in
shale's lower trough (rise ≤ about 8 m, columns about 20–47, 200–300 model years). The single-column head
"basins" are the documented ±10 m residual alternation. The drafted text ("near the valley head … even in
hard rock") would be false wherever it shows, so it was refined to "the floor here is lower than the floor
further down: a basin, called an overdeepening". The head reach is explained only in the teacher notes. A
reader-facing head note needs a new owner decision; a draft is in the lesson register, not wired.

**Cross-owned edits.**

- `uplift/spreads/index.ts`: one export line, `uValleySpread`; not added to `spreads`, which is 5M's job.
- `uplift/spreads/package.json`: dependency `@hachure/glacier` (`workspace:*`).
- `pnpm-lock.yaml`: the matching importer entry, as produced by `pnpm install`.

**Not done.**

- Wiring into the book (5M) and the host serving the probe kinds (5J/5K).
- The averaged-section and adverse-rise helpers in `@hachure/glacier` (5K). The lesson test holds a
  reference implementation of the trigger.
- Expert review and human checks.

## D-W5-5K — Production glacial scene: model-read dressing, live front face with ghost and lens, gestures with keyboard twins

2026-11-12. Session 5K (`s1/w5/5k-production-scene`, from s1/w5/integration 8aee4cf). Technical choices inside
the plan and inside the frozen R1 contracts (D-W5-R1). Evidence: `docs/review/glacial/scene/`.

1. **Engine primitive `@hachure/ink/glacial`** (new entry point; no three.js in its dressing or lens code):
   production dressing rules (`GLACIAL_DRESSING_RULES`), the section lens (`sectionLensSvg`) and gestures
   (`attachCutDrag`, `attachSpecimenDrag`, `blockScreenGeometry`). The 5H stage gained only additive API:
   `DioramaOptions.rules`, `ValleyDiorama.setGhost`, `DioramaDescription.ghostShown`,
   `BookStage.projectBlockPoints`, `solidProfile`, and palette tokens `ghost`/`ghostHalo`. Old callers are
   unchanged.
2. **Dressing reads model state.** River: from the lowest cell of the row below the snout (snout = the most
   downstream row whose valley bottom carries ice, so thin ridge ice does not count), routed over the bed with
   closed hollows filled (priority flood from the block's front edge); a receiver is always beside or
   downstream, never ice, so the path never climbs up-valley and crosses a basin at its spill level. Flow marks:
   streamlines of the recorded surface velocity seeded where the glacier is wide and flows down-valley (near
   the headwall the recorded ice flows back into the head basin), dash length 1.5–6 cells by local speed.
   Snow and trees keep the 5H rules (snowline from the model config; treeline illustrative). Deterministic;
   a test bans `Math.random` in `ink/src/glacial`. No erosion in a shader or in dressing.
3. **Front face as a live cross-section, plus an enlarged lens.** The block's cut face keeps the 5H rock
   pattern, ice section and dashed starting V, and now draws the newest kept run's bed at the matched time as
   a dotted plum line over a paper halo. At page size the face is only a few pixels tall (1440 × 900 tilted:
   the U is about 10 px), so the exit criterion needed more: a **section lens** beside the caption draws the
   same section in 2D (rock with its lithology pattern, ice, dashed start V, labelled dotted ghost, a scale
   bar from the profile's metres), cropped to the starting valley between its rims, **vertical ×2**, bound
   into its label. The shape exponent of a power-law profile does not change under vertical scaling. This is
   a 5K addition to the approved layout, not an R1 decision: owner, please confirm at the next review.
4. **Margin notes average three columns.** `measureSectionAveraged` (glacier, additive) averages
   `measureSection` over i − 1 … i + 1 (120 m); notes round to 10 m. The registered protocol keeps the single
   column. Kept-run notes show the kept run's floor lowering and steepest wall at its matched recorded time.
5. **Overdeepening note slot**, aligned with 5L (PR #34): `measureOverdeepening` (glacier, additive) reads
   the long profile of the three-column floor; `adverseRiseDownValleyM` = highest floor between the section
   and the mouth minus this floor; the start's own rise is subtracted (outside the divide at the head the
   authored ground already falls away); shown at ≥ 5 m. On the recorded runs it fires only in shale's lower
   trough at 240–300 model years (i = 26–43 at 300), never in sandstone, granite or the head reach; not at the
   default cut. Words are 5L's ("The ice has worn the floor here lower than the floor further down: a basin,
   called an overdeepening."); the R1 head-basin draft is not shown. The single-column, start-subtracted
   variant with a 20 m threshold, tried first, found no basin anywhere (largest carved rise 16 m); the D-W5-R1
   premise "head basin lowered 100–230 m" is lowering, not an adverse slope.
6. **Default front face** is a scene option (`defaultCutColumn`, a grid column read against the manifest);
   the review route passes i = 51 (`REVIEW_DEFAULT_CUT_COLUMN`); 5L/5M move it to the spread config.
7. **One rock command.** `RockCommand` (`commands.ts`): the selector and the specimen drop both call
   `chooseRock`. The local stand-in shows that rock's recorded run at the same model time (the frozen 5H
   behaviour) and keeps the previous run (newest first, at most two; a dropped run would be named in the
   notes). 5M passes the 5J runtime command through `GlacialSceneOptions.createRockCommand`.
8. **Gestures and keyboard twins.** Specimen drag → the radio group; dragging the front face (mouse/pen;
   claims the press before the R2 orbit) → the Front face slider, one grid cell per arrow; "See under the ice"
   → checkbox; turntable = the frozen R2 turn/height/zoom (drag, sliders, Reset). Touch: specimen drag works;
   cut drag stays mouse/pen so phone scrolling is untouched (the slider is the phone path).
9. **Text alternative** describes the current profile: where the face is, through ice or below the snout,
   "closer to a U/V" from the shape exponent against the protocol's anchors (V ≈ 1, U ≈ 2; midpoint 1.5),
   bound floor numbers, the kept run and the overdeepening note.
10. **Fig. 1 labels**: leader-line words from a list (`GLACIAL_DRAWING_LABELS`, 5L's six words: valley head,
    glacier, snout, U-shaped valley, V-shaped valley, valley floor); no numbers; `labels: boolean` still works.
11. **Cloth** `--gs-board` `#3b352f` (edge `#2b2723`) on the boards/cover; colour only.
12. **Kept unchanged**: everything frozen by D-W5-R1 item 1 (book depth, binding, fore-edges, reading
    panels, spine view, zoom 1–1.5, gestures, control grid). The code's default tilt stays `TILT_DEG = 48`
    from R2 ("lower default sight line"); D-W5-R1 item 1 also cites "36°" from R1. Not changed here; 5M
    should reconcile the wording.

**Cross-owned edits.** `hachure/glacier/src/contract/sections.ts` (+ test) and one export line in
`contract/index.ts` (allowed by D-W5-R1 item 9); `hachure/ink/package.json` (one `./glacial` export line);
additive changes in `hachure/ink/src/stage/{diorama,book-stage,block-geometry,index}.ts` and
`materials/natural/palette.ts` (5H stage/materials, "additions keep old callers working").

**For 5M.** Mount `mountGlacialScene(root, options)`; pass `defaultCutColumn`, `drawingLabels`,
`createRockCommand` from the spread/runtime. Note words come from 5L: replace `OVERDEEPENING_NOTE` and the
draft margin phrases in `notes.ts`. Name map to 5L: `noteColumns()` ↔ `measureSectionAveraged` /
`PAGE_SECTION_HALF_WIDTH_COLUMNS`; `roundForNote()` ↔ `notes.metres`; `adverseRiseDownValleyM` is the same
field name (5L's exact column range, ~20–47, is a little wider than this probe's 26–43; pick one probe in 5M).

**Not done.** No video capture; no human, screen-reader or hardware check; touch drag of the cut face.

## D-W5-5J — Runs, timeline and comparison runtime on one command path; WebGPU by default, halted runs never continue

2026-11-12. Session 5J (`s1/w5/5j-runs-timeline`, from s1/w5/integration 8aee4cf). Technical choices inside the
plan and the frozen R1 contracts. Evidence: `docs/review/glacial/runtime/README.md`,
`e2e/fixtures/glacial-runtime-evidence.json`.

1. **Two entry points.** `@hachure/runtime/glacial` is the main-thread `GlacialHost`, the `runs` module, the
   Worker transport, labels and an animation driver; it loads no solver or GPU code.
   `@hachure/runtime/glacial-worker` is the engine (`installGlacialWorker`) and an in-process transport with
   Worker semantics. The water `SimHost` is untouched; the glacial host follows its lifecycle (serialized
   requests, one automatic batch in flight, settle/resume without catch-up) and reuses `FixedStepClock`.
2. **One command path.** Every reader action on runs and time is `host.dispatch(command)`. The page rock
   selector and the 3D specimen drop both send `{ kind: "choose-rock", rockId }`. Level, camera, cut and ice
   view are not host state, so they cannot touch a run.
3. **"Before any run" means before the live run has advanced.** A rock chosen while the live run is still at
   step 0 replaces that run, and nothing is kept. Choosing the live run's own rock does nothing (unless the run
   is halted). A choice keeps the play intent: if the old run was playing, the new run plays from its start. The
   newly kept run becomes the default comparison (§1 "Compare"); the reader may pick another or none.
4. **Recording.** Snapshots are recorded at step 0 and every `snapshotIntervalYears` (20), up to
   `horizonYears` (300), where a run is complete and stops. The engine splits batches at record boundaries, so
   recorded snapshots and hashes do not depend on playback speed or batching (tested). Kept runs are stored in
   the frozen capture format: `RecordedRun` implements `CapturedRun`. Each run's quantization is fixed at its
   start, with the bed offset 500 m below the start's lowest bed; all three registered 300-year captures
   re-encode with 0 values clamped. Budget: 3 runs × 16 × 81 920 B = 3.93 MB, against 32 MiB.
   `planGlacialRuns` rejects over-budget configs, and `RunStore` asserts the budget after every change.
5. **Scrub and compare.** Scrubbing pauses and shows the nearest recorded snapshot. `play` and `step` return to
   live; scrubbing to the live head is the live view. Comparison uses the nearest recorded time, labelled with
   that actual time. Our reading of "cross-backend comparison only at matched times" (D-W5-5I): a kept run on
   another backend is shown only when its recorded time equals the viewed time; otherwise the comparison
   returns `unmatched` with a reason, and scrubbing always lands on matched times.
6. **Backend.** `selectGlacierBackend({ prefer: "auto" })` runs once, at run 1, in the Worker. Later runs reuse
   the chosen backend without repeating the device check. If a later WebGPU creation fails, that run and the
   session from then on use the CPU, labelled. If a run fails mid-way, it is halted and latched, and the
   snapshots recorded before the failure stay as view data. The host offers `restart-on-cpu`, a new CPU run
   from the authored start through `restartOnCpu`. The halted run is kept with its `webgpu` label. Reset keeps
   the session's backend, so a failed GPU is not silently retried.
7. **Labels** (`labels.ts`) are defaults built from bound values: "earlier · model time t model years",
   "kept run N · model time t model years". 5L may reword them around the same values.
8. **"Paused" means settled.** Pause and leave report `activity: "settling"` while accepted batches drain
   and the final live frame is fetched. Only then is `"paused"` published, and from that point the shown frame
   equals the live position. The first build published "paused" (and "departed") before draining. A reader
   could then see a frame older than the run, which happened in CI run 43187600263 (shown step behind live
   step). The deterministic reproduction is the unit test "never reports paused … while the shown frame lags".

**Results (this machine).** Unit: 31 host/run tests plus the capture-quantization test pass in Node. Browser
(`e2e/glacial-runtime.spec.ts`): 11/11 in installed Chrome with WebGPU (Intel Arc 140V), and 8 passed + 3
WebGPU-only skipped in Playwright's bundled Chromium (no adapter). Auto picks WebGPU in Chrome; a forced
`skew-erosion` fault falls back with `[device-check-failed]`; a real device loss halts at step 100 and offers
the CPU run. CPU Worker, CPU main-thread and reload runs give identical hashes, and WebGPU same-device replay
is identical. A production 300-year WebGPU run recorded 16 snapshots (1.31 MB) in about 8 s at 4×.

**Cross-owned edits.** `hachure/runtime/package.json`: dependency `@hachure/glacier: workspace:*` and the
exports `./glacial` and `./glacial-worker`. `pnpm-lock.yaml`: the importer entry, as regenerated by
`pnpm install`.

**Not done / open.** (a) No book integration: 5M adds the app Worker module (`installGlacialWorker(self)`) and
joins `viewFrame()`/`comparison()` to the 5K scene. (b) The real device-loss and same-device replay browser tests run wherever auto
selection picks WebGPU, including CI's software adapter (Linux bundled Chromium), which passes the device
check. The 300-year production run needs `UPLIFT_E2E_CHANNEL` and a hardware adapter: on CI's software
adapter it exceeded the test budget (run 43174361878). The labelled CPU-as-GPU fake covers the halt path on
every machine. (c) The label wording awaits 5L.

**Plan-changing facts.** (a) GPU and CPU state hashes differ even at step 0, because the GPU hashes its two-lane
reconstruction. Determinism holds per backend and same-device, never across backends, which is why kept runs
carry their backend. (b) A CPU-only session plays slower than the scheduled 10 model years per second at 1×
(about 3 model years per second on this machine); the host drops wall-clock time rather than enlarging the
step, as specified. (c) Nothing here blocks 5M.
