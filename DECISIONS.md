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
