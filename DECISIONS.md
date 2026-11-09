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
