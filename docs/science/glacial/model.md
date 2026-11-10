<!-- expert-review -->

# Glacier model note: "From V to U" (session 5G)

Tier: **process model** — simplified but mechanism-faithful; qualitative behaviour is the claim,
magnitudes are indicative and time is compressed. Code: `@hachure/glacier`
(`hachure/glacier/src/cpu/solver.ts`, `shape-factor.ts`). Sources: [sources.md](sources.md).
Feasibility record: [feasibility.md](feasibility.md). Registered protocol:
[acceptance-protocol.md](acceptance-protocol.md). Rocks: [rock-types.md](rock-types.md).

## 1 · State, grid and time

- Grid 128 × 96 square cells of 40 m (5.12 × 3.84 km). Index `j·nx + i`; i runs along the valley
  (i = 0 the mouth, downstream), j across it.
- State: bed elevation b (m), ice thickness H ≥ 0 (m), rock id (one per run), step count; model time
  t = step · Δt with fixed Δt = 0.0025 model years (time-step convergence below). A lagged shape-factor
  field f (§2) is recomputed from state every 40 steps (0.1 model years).
- Start: the authored V-valley `v-valley/1` (`DEFAULT_V_VALLEY`): a straight valley with a gently rising
  floor (1300 → 1450 m), a headwall rising to 1850 m, 26° V walls, ridges rising from 1550 m at the mouth to
  2550 m at the head, and ±2 m seeded roughness. Every slope is below the softest rock's critical slope.
  Identical for every rock; labelled as the starting point.
- Determinism: no randomness after the seeded start; every pass reads the old state and writes a new one.
  The same config gives a bitwise-identical run however steps are chunked (tested).

## 2 · Ice flow: shallow ice with a lateral-drag shape factor

Vertically integrated mass conservation with a diffusive flux (Cuffey & Paterson 2010, §8):

∂H/∂t = −∇·q + ṁ, q = −D ∇s, s = b + H

D = H · (ū_def + u_b) / |∇s|, ū_def = 2A/(n+2) · τ³ · H, τ = f · ρ g H |∇s|

with Glen's law n = 3 and A = 2.4 × 10⁻²⁴ Pa⁻³ s⁻¹ (temperate ice), ρ = 917 kg m⁻³, g = 9.81 m s⁻². D is
evaluated on cell edges (edge-mean H and f, the edge-normal surface slope plus the mean cross slope).

**Basal sliding (Weertman):** u_b = u_ref · (min(τ, τ_max) / τ_ref)^m with m = 2 = (n+1)/2 (Weertman
1957), u_ref = 40 m/yr at τ_ref = 100 kPa. τ_max = 200 kPa caps the stress the sliding and erosion laws
see: valley glaciers sustain ~50–150 kPa, and the shallow-ice estimate overshoots at steep, thin ice
fronts, where it drove runaway erosion (attempt A2b).

**Cold-based thin ice:** the sliding term is multiplied by a warm-based fraction that ramps linearly from
0 at 40 m of ice to 1 at 120 m. Thin ice is frozen to its bed, neither slides nor erodes; this protects
ridges and headwalls and confines erosion to the trough ("selective linear erosion", Sugden 1978;
thermal regime, Cuffey & Paterson 2010 ch. 9). It is a stand-in for a basal temperature calculation, a
teaching choice (attempt A2c).

**Explicit scheme and limits:** D·Δt/Δx² ≤ 0.2 (capped, and each cap counted). Δt = 0.0025 yr is the
converged step: halving it again changed nothing measurable after 100 model years, and the cap fires on
< 0.01 % of ice-edge steps. At Δt = 0.01 yr the cap fired on 8–12 % of ice-edge steps, ice piled up,
and erosion per model year doubled — the pilots run at that step are recorded as such in feasibility.md. A donor-cell outflow limiter scales a cell's outgoing fluxes so it never exports more
ice than it holds: H ≥ 0 and ice is conserved exactly (budget residual is round-off; tested).

**Lateral drag (the correction that makes a U):** plain shallow ice sets τ = ρgH|∇s| column by column, so
stress, sliding and erosion peak at the deepest point and a V only deepens (Seddik et al. 2009; our
attempt A0). In a real cross-section the side walls carry part of the driving stress and the bed in the
bottom of a V is shielded, giving a local minimum of sliding at the centre and maxima on the lower walls
(Nye 1965; Harbor et al. 1988; Seddik et al. 2009). We estimate that redistribution geometrically with
the "area method" for boundary shear stress in a channel (Khodashenas & Paquier 1999): each bed point
carries the driving force of the ice nearest to it. For each ice cell, across the local flow direction,
we take the strip from the bed along the bed normal to whichever comes first — the ice surface, or the
perpendicular bisector with another bed point — and set f = (strip length) / H, clamped to [0, 1]
(lateral drag only ever reduces the shallow-ice stress; a wide flat bed under a flat surface gives
f = 1). A cell's bed is two half-segments, so a V-bottom cell, whose halves face each other, is shielded.
f is averaged over the 3 × 3 ice-covered neighbourhood, because stress is shared between columns over
about an ice thickness (Kamb & Echelmeyer 1986). This is a generalisation of Nye's shape factor to each
column, not a higher-order (iSOSIA-type) stress solution; that is its main approximation.

## 3 · Mass balance: a fixed, authored snowline

ṁ = min(β (z − z_ELA), ṁ_max), β = 0.01 m ice yr⁻¹ m⁻¹, ṁ_max = 3 m/yr, snowline z_ELA = 1830 m — a
fixed, authored value shown (bound) in the deeper level, never a reader control (Oerlemans 2001 for the
linear profile; maritime gradients). **z is the starting bed**, held fixed for the run. This gives every
rock the same ice supply, so a comparison of rocks compares rocks. It deliberately omits the feedback by
which a deepening valley lowers its glacier surface into warmer air and shrinks it (Pedersen & Egholm
2013); with that feedback on (attempt A2a) the faster-eroding rocks lose their glaciers sooner and the
rock comparison is confounded by glacier size.

The outer three cells of the grid are a fixed frame: ice entering it leaves the model (it would flow
into neighbouring valleys; counted as edge outflow in the budget) and its rock is never eroded.

## 4 · Erosion

ė = S · ε_ref · K_rock · (u_b / u_ref)^l under ice ≥ 1 m thick, with l = 2 (Seddik et al. 2009 used a
quadratic law; Herman et al. 2015 estimate an exponent near 2 in the field), ε_ref = 0.01 m/yr at
u_ref = 100 m/yr (order of Humphrey & Raymond 1994; inside the 1–100 mm/yr range for temperate valley
glaciers, Hallet et al. 1996), K_rock the rock's relative erodibility. The bed is lowered vertically.

**Time compression S = 120** (a declared teaching choice): each model year erodes as much as 120 years
of the uncompressed law, so the registered 300-model-year run stands for erosion of the order of 36 000
years (comparable to Seddik et al.'s ~50 ka for a U). The ice itself is simulated in real years. The page says "Simplified model; time is compressed"
and never prints geological years.

## 5 · Rock walls

Where a wall is steeper than the rock's critical slope (8-neighbour stencil, diagonals at √2 spacing),
rock relaxes towards that slope at 5 yr⁻¹ (fast compared with erosion). Rock falling onto ice-covered
ground is carried away by the glacier (Benn & Evans 2010); rock falling onto ice-free ground stays as
talus. The net rock loss therefore equals glacial erosion plus debris the ice carries away, and the
eroded-volume probe is exactly the net lowering (tested).

## 6 · What the model ignores (for the deeper level and teacher notes)

- Higher-order ice mechanics (longitudinal stresses), ice temperature (all ice is temperate and slides),
  subglacial water and effective pressure, seasonal and climate change of the snowline.
- Quarrying versus abrasion, sediment cover, rivers (below the snout the valley is static; no meltwater
  incision), weathering, isostasy, tectonics.
- The mass-balance–elevation feedback (§3) and any climate history: one steady snowline for the run.
- Rock variation within a run, bedding and joint orientation.
- Field calibration: magnitudes are indicative; time is compressed (§4).

## 7 · Known deficiencies and observations

- The shape factor is a geometric estimate. It reproduces the qualitative Harbor-type pattern (shielded
  axis, lower-wall maxima, tested in `shape-factor.test.ts`) but is not a stress solution. An expert
  should judge whether the area-method analogy is acceptable for teaching.
- Under-ice troughs **overdeepen**: the floor under the thickest ice is lowered below the floor further
  down-valley, so the bed has reverse slopes near the snout. A "downhill" river path drawn on such a bed
  runs back up-valley; scene dressing (5K) must route meltwater over the ice surface or treat closed
  depressions (a lake) rather than assume the bed drains down-valley. Overdeepening is real in glaciated
  valleys; its magnitude here is not calibrated. (Measured values: feasibility.md.)
- The headwall and high ridges carry thin ice; thin ice on steep slopes is outside the shallow-ice
  approximation's comfort zone, hence the τ_max cap (§2).
- Grid resolution: a 40 m cell resolves troughs of ~10–20 cells; wall slopes are cell-to-cell values.
