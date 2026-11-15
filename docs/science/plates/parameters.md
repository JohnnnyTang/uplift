<!-- expert-review -->

# Parameter table for the boundary relief (session 7A → 7C)

**Version 7R-1.** 7A's table (`7A-1`) as revised at the owner's look review (D-W7-7R): row 10 (starting
ridges 500 → 1,500 m, ARTISTIC) and rows 28–29 (rift relief 1,700 → 2,100 m, the top of the cited range).
Every other row is 7A's.

The machine-readable copy is [parameters.json](parameters.json). 7C transcribes it into its typed config
(units in every name) with a source comment per value pointing to the row number here. The 7A storyboard
([docs/review/plates/brief](../../review/plates/brief/README.md)) is drawn from the same file by a
reference sketch of the formulas below, so the frames show what these values look like.

**The shapes are authored, not simulated** (D-L2-1). Nothing here is a model output, and no value in this
table may be typed on the page. The page may cite the real-world column (with its source) and must bind the
two display scales to the scene config. Keys refer to [sources.md](sources.md).

**Labels.**

- **CITED**: the scene value is a real-world value, or lies inside the cited real range, at true scale.
- **ARTISTIC CHOICE**: chosen for legibility, compressed or exaggerated. The real context is given where one
  exists, so the reader-facing text never mistakes it for a fact.
- **DERIVED**: computed from other rows by the stated formula.

## The table

Coordinates: `x` across the boundary (block columns, left to right as seen from the front), `z` along the
boundary (block rows, from the back at row 0 to the front face). The boundary is the line `x = 0`.

| #   | Key (`parameters.json`)                                         | Scene value                                                     | Real-world value or range                                                                                                                                                | Source                       | Label                                                          | Note                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `grid.columns`, `grid.rows`, `grid.metresPerCell`               | 160 × 160 cells × 1,000 m (a block about 160 km square)         | Himalaya about 250 km across (frontal thrust to suture) and 2,900 km long; Kenya rift valley 60–180 km wide; San Andreas 1,300 km long                                   | Nab09, TDE-H, Kel94, TDE-U   | **ARTISTIC CHOICE** (block scale)                              | One window for all three boundaries: the rift fits at its real width, the range is compressed. Same column count as lesson 1's glacier grid (160 × 64 × 40 m), so similar mesh cost.                                                                                                       |
| 2   | `display.surfaceVerticalExaggeration`                           | 4                                                               | true scale is 1                                                                                                                                                          | —                            | **ARTISTIC CHOICE** (vertical exaggeration)                    | At 1, a 5 km range on a 160 km block is 3 % of its width; at 4 it is about 13 %. Applies to the surface and the rock layers. Bound into the page, never typed.                                                                                                                             |
| 3   | `display.crustVerticalExaggeration`                             | 0.75 (crust depth compressed to three quarters)                 | true scale is 1; real crust 35 km normal, 68.7 km under the stage-1 range (rows 15, 18, 19)                                                                              | —                            | **ARTISTIC CHOICE** (compressed crust depth; decision D-W7-7A) | Option (a) of [the crust display decision](#crust-display-scale-decision). All crust depths (normal crust, root, rift thinning) shrink by one factor, so the Airy ratios survive. Must stay ≥ row 2 / 5.6 = 0.71, or the root reads shallower than the range is high. Bound into the page. |
| 4   | `display.blockBaseDepthBelowSeaLevelM`                          | 72,000 m (on the crust's scale: drawn at 54 km)                 | deepest Moho in the scene 63,160 m below sea level                                                                                                                       | DERIVED from rows 15, 18, 19 | **ARTISTIC CHOICE**                                            | Leaves a mantle band under the root. **One fixed frame for every boundary and stage**, so ghosts compare (do not use a per-snapshot `blockBaseM`). 7D locks its elevation range over all boundaries at stages 0 and 1: see the extremes under the decision.                                |
| 5   | `stage.ease`                                                    | linear                                                          | —                                                                                                                                                                        | —                            | **ARTISTIC CHOICE**                                            | Stage 0–1 is "early → late", never time. Linear keeps every monotonic property simple.                                                                                                                                                                                                     |
| 6   | `seed`                                                          | 7                                                               | —                                                                                                                                                                        | —                            | **ARTISTIC CHOICE**                                            | Seeds the noise only. Same seed, boundary and stage give the same field.                                                                                                                                                                                                                   |
| 7   | `start.lowlandElevationM`                                       | 400 m                                                           | —                                                                                                                                                                        | —                            | **ARTISTIC CHOICE**                                            | A generic lowland. The absolute level matters only for the snowline (row 37) and the Moho bookkeeping (row 15).                                                                                                                                                                            |
| 8   | `start.regionalTiltMPerKm`                                      | 1.5 m/km, downhill towards +x                                   | —                                                                                                                                                                        | —                            | **ARTISTIC CHOICE**                                            | Gives streams a direction: they cross the boundary from left to right.                                                                                                                                                                                                                     |
| 9   | `start.ridgeSpacingM`                                           | 20,000 m                                                        | —                                                                                                                                                                        | —                            | **ARTISTIC CHOICE**                                            | Eight ridges along the block; sized with row 34 so the transform offset reads.                                                                                                                                                                                                             |
| 10  | `start.ridgeReliefM`                                            | 1,500 m crest to trough                                         | —                                                                                                                                                                        | —                            | **ARTISTIC CHOICE** (owner, D-W7-7R)                           | Raised from 7A's 500 m at the owner's look review (D-W7-7R), so the transform offset reads at page size: 6 km on screen at ×4. Shared by all three boundaries. Ridges and stream valleys run across the boundary (along x).                                                                |
| 11  | `start.ridgeMeanderAmplitudeM`, `start.ridgeMeanderWavelengthM` | 1,000 m, 60,000 m                                               | —                                                                                                                                                                        | —                            | **ARTISTIC CHOICE**                                            | Ridges wander by at most 6° from square across the boundary, so they do not look ruled.                                                                                                                                                                                                    |
| 12  | `start.streamChannelDepthM`, `start.streamChannelWidthM`        | 40 m, 2,000 m                                                   | —                                                                                                                                                                        | —                            | **ARTISTIC CHOICE**                                            | A shallow channel in every trough, so steepest-descent stream dressing finds one clean line per valley.                                                                                                                                                                                    |
| 13  | `start.surfaceNoiseAmplitudeM`, `start.surfaceNoiseWavelengthM` | 30 m, 6,000 m                                                   | —                                                                                                                                                                        | —                            | **ARTISTIC CHOICE**                                            | Seeded texture; small enough not to break the stream lines.                                                                                                                                                                                                                                |
| 14  | `start.layers`, `start.basementName`                            | sandstone, shale, limestone, 600 m each, over crystalline crust | sedimentary fill of 3–5 km exists in the Kenya rift (context only)                                                                                                       | Kel94                        | **ARTISTIC CHOICE**                                            | Generic textbook layers with natural colours, drawn ×4 with the surface (row 2). Not a claim about any real place. Their base (1,800 m under the ridge troughs, moved by the layer offset) is the cover base on the front face, where the crust band starts (D-W7-7R2).                    |
| 15  | `crust.normalThicknessM`                                        | 35,000 m (at the lowland level)                                 | about 30 km (average); 41.1 km (area-weighted mean); 30.5 km extended crust; 46.3 km orogens; about 40 km under the Kenya rift flanks; Moho 40 km below the Ganges Basin | TDE-I, CM95, Kel94, Nab09    | **CITED** (inside the range)                                   | Moho depth below sea level under the lowland `D0 = 35,000 − 400 = 34,600 m` (DERIVED).                                                                                                                                                                                                     |
| 16  | `crust.crustDensityKgPerM3`                                     | 2,800 kg/m³                                                     | 2,800 (textbook); 2,830 mean crustal density                                                                                                                             | TS14, Fia, CM95              | **CITED**                                                      | Used only for row 18.                                                                                                                                                                                                                                                                      |
| 17  | `crust.mantleDensityKgPerM3`                                    | 3,300 kg/m³                                                     | 3,300 (textbook)                                                                                                                                                         | TS14, Fia                    | **CITED**                                                      | Used only for row 18.                                                                                                                                                                                                                                                                      |
| 18  | `crust.airyRootPerMetreOfUplift`                                | 5.6                                                             | 5.6 for 2,800 / 3,300 kg/m³; 4.5–6.0 for crust 2,700–2,830 kg/m³                                                                                                         | Fia, TS14, CM95              | **DERIVED** = ρc / (ρm − ρc)                                   | See [Airy root proportion](#airy-root-proportion). Applied to the smooth range envelope only (an artistic simplification of regional support).                                                                                                                                             |
| 19  | `convergent.rangeCrestElevationM`                               | 5,500 m (smooth crest)                                          | Tibetan Plateau average about 4,600 m; Himalayas up to 8,854 m                                                                                                           | TDE-U                        | **CITED** (inside the range)                                   | Peaks reach about 7,500 m with row 23 and the 1,500 m starting ridges (computed maximum 7,534 m; 7,037 m with 7A's 500 m ridges), below Everest.                                                                                                                                           |
| 20  | `convergent.rangeWidthM`                                        | 80,000 m (base to base)                                         | Himalaya about 250 km across; Tibet extends hundreds of km further                                                                                                       | Nab09                        | **ARTISTIC CHOICE** (compressed to about a third)              | Leaves 40 km of lowland on each side of the block.                                                                                                                                                                                                                                         |
| 21  | `convergent.rangeFlankWidthM`                                   | 25,000 m                                                        | —                                                                                                                                                                        | —                            | **ARTISTIC CHOICE**                                            | Each flank; the crest is 30 km wide at stage 1.                                                                                                                                                                                                                                            |
| 22  | `convergent.rangeWidthAtStageZeroFraction`                      | 0.5                                                             | —                                                                                                                                                                        | —                            | **ARTISTIC CHOICE**                                            | The range widens as it grows (§3 of the wave plan): width = 0.5 → 1 × row 20.                                                                                                                                                                                                              |
| 23  | `convergent.peakNoiseFraction`                                  | 0.3                                                             | —                                                                                                                                                                        | —                            | **ARTISTIC CHOICE**                                            | Peaks and saddles ± 30 % of the local uplift. Never touches the root.                                                                                                                                                                                                                      |
| 24  | `convergent.peakNoiseWavelengthM`                               | 12,000 m                                                        | —                                                                                                                                                                        | —                            | **ARTISTIC CHOICE**                                            |                                                                                                                                                                                                                                                                                            |
| 25  | `divergent.riftWidthM`                                          | 50,000 m (between the outer faults)                             | Main Ethiopian Rift floor about 50 km; Malawi 60 km; Tanganyika up to 70 km; Kenya at least about 60 km                                                                  | Cho05, Kel94                 | **CITED**                                                      |                                                                                                                                                                                                                                                                                            |
| 26  | `divergent.riftFloorWidthM`                                     | 20,000 m (inside the innermost faults)                          | —                                                                                                                                                                        | —                            | **ARTISTIC CHOICE**                                            |                                                                                                                                                                                                                                                                                            |
| 27  | `divergent.scarpsPerSide`, `divergent.scarpDropFractions`       | 3 per side; 0.4, 0.3, 0.3 of the floor drop, outermost first    | a major border fault with smaller normal faults and tilted blocks; often asymmetric                                                                                      | Cho05                        | **ARTISTIC CHOICE**                                            | A symmetric stepped graben, the textbook simplification. Faults evenly spaced from 25 km to 10 km from the axis.                                                                                                                                                                           |
| 28  | `divergent.floorDropM`                                          | 1,500 m below the start                                         | shoulder-to-floor relief about 500 m (Nyanza) to 1,300 m (Malawi) to 2,100 m (Lake Edward)                                                                               | Cho05                        | **CITED** (total relief, with row 29); split **ARTISTIC**      | Total shoulder-to-floor relief 2,100 m, the top of the cited range (owner, D-W7-7R; 7A had 1,700 m). The rift floor reaches −1,100 m on the scene's own datum; no sea is drawn.                                                                                                            |
| 29  | `divergent.shoulderHeightM`                                     | 600 m above the start                                           | (see row 28)                                                                                                                                                             | Cho05                        | **ARTISTIC CHOICE** (share of row 28)                          | "The shoulders rise slightly." About 2/7 of the total relief, as in 7A's split (500 of 1,700 m).                                                                                                                                                                                           |
| 30  | `divergent.shoulderDecayM`                                      | 20,000 m                                                        | —                                                                                                                                                                        | —                            | **ARTISTIC CHOICE**                                            | e-folding distance of the shoulder away from the outer fault.                                                                                                                                                                                                                              |
| 31  | `divergent.scarpFaceWidthM`                                     | 1,000 m (one cell)                                              | real scarps are steeper, narrower faces                                                                                                                                  | —                            | **ARTISTIC CHOICE**                                            | The steepest a 1 km grid allows. Each scarp is a smoothstep across this width.                                                                                                                                                                                                             |
| 32  | `divergent.crustThicknessAtAxisM`                               | 25,000 m at stage 1                                             | 20 km (Lake Turkana) to about 35 km (Lake Naivasha) along the Kenya rift axis; 30 km beneath the graben at 0° latitude                                                   | Kel94, Cho05                 | **CITED** (inside the range)                                   | Moho rise at the axis = `D0 − (25,000 − (400 − 1,500)) = 8,500 m` (DERIVED). The crust at the axis stays 25 km (D-W7-7R).                                                                                                                                                                  |
| 33  | `divergent.thinningHalfWidthM`                                  | 40,000 m                                                        | thinning confined essentially to beneath the rift valley                                                                                                                 | Kel94                        | **ARTISTIC CHOICE** (shape)                                    | The thinned zone is 80 km wide, a little wider than the 50 km valley.                                                                                                                                                                                                                      |
| 34  | `transform.offsetM`                                             | 8,000 m at stage 1                                              | Wallace Creek channel offset 128 m; about 300 km total right-lateral offset on the San Andreas                                                                           | SJ84                         | **ARTISTIC CHOICE** (compressed / enlarged offset)             | Far larger than Wallace Creek's, far smaller than the fault's total. 0.4 of the ridge spacing (row 9): 0.5 would set ridges against valleys and make the direction ambiguous.                                                                                                              |
| 35  | `transform.sense`                                               | right-lateral                                                   | the San Andreas is right-lateral (dextral); west side moves north-west relative to the east side                                                                         | SJ84, TDE-U                  | **CITED**                                                      | Seen from either side, the far side moves to the right: the right half moves towards the reader (+z).                                                                                                                                                                                      |
| 36  | `transform.faultZoneHalfWidthM`                                 | 1,000 m                                                         | the San Andreas fault zone is in places tens of kilometres wide                                                                                                          | TDE-U                        | **ARTISTIC CHOICE** (narrowed)                                 | A crisp offset; the drag zone is a `tanh` of this width.                                                                                                                                                                                                                                   |
| 37  | `dressing.snowlineM`                                            | 5,700 m                                                         | present equilibrium-line altitude about 5,700 m (Khumbu, south side of Everest) and 6,200 m (Rongbuk, north side)                                                        | Owe09                        | **CITED**                                                      | The equilibrium-line altitude is used as the snowline. Snow appears only near stage 1, on the highest ground.                                                                                                                                                                              |
| 38  | `dressing.treelineM`                                            | 4,000 m                                                         | not sourced                                                                                                                                                              | —                            | **ARTISTIC CHOICE**                                            | Dressing colour only (vegetation below, bare rock above). Not a claim; never on the page.                                                                                                                                                                                                  |

## Crust display scale (decision)

**The problem (raised by 7B).** At true depth the crust is 35 km thick and 69 km under the range. Under a
surface exaggerated ×4, that makes a very tall block. 7B's captures read well only with a compressed
crust. Two options:

- **(a) Compress the crust depth (recommended, adopted).** Draw every crust depth at a fraction of true
  scale, label it **ARTISTIC CHOICE**, and keep the real thicknesses in the page text (claims PC7, PC8,
  PC13, all cited). The root is still 5.6 times the uplift in real metres, and all crust depths shrink by
  the same factor, so the root-to-crust ratio is unchanged.
- **(b) True depth with a wide block and low exaggeration.** For the crust to fit at true scale, the block
  must be several hundred kilometres wide, or the surface barely exaggerated. A 5 km range is then 1–3 %
  of the block's width, the 50 km rift a sliver and the transform offset invisible. Rejected: the three
  landforms are the lesson, and they would stop reading at page size.

**Why (a), and how far to compress.** The front face has to show one thing: the crust is thicker under
the range, by much more than the range is high (claim PC6; PC9 at university level). On screen the root is
`5.6 × crust scale` deep for every unit of uplift, and the range is `surface scale` high. So the root
reads at least as deep as the range is high only while `crust scale ≥ surface scale / 5.6` = 0.71 at ×4.
**0.75** is the most compression that keeps that cue (the root 21.4 km deep on screen, the range 20.4 km
high). Choices for 7R:

| Crust scale (row 3) | Normal crust on screen (block width 160 km) | Root ÷ range height on screen | Front face, base to highest peak | Reads                                                   |
| ------------------- | ------------------------------------------- | ----------------------------- | -------------------------------- | ------------------------------------------------------- |
| 1 (true depth)      | 34.6 km (22 % of width)                     | 1.4                           | 63 % of width                    | clearly deeper root; tall block                         |
| **0.75 (adopted)**  | 26.0 km (16 %)                              | 1.05                          | 51 % of width                    | root about as deep as the range is high; moderate block |
| 0.5                 | 17.3 km (11 %)                              | 0.7                           | 40 % of width                    | root shallower than the range is high: contradicts PC9  |
| 0.35 (about 12 km)  | 12.1 km (8 %)                               | 0.5                           | 33 % of width                    | squat; the root looks like a dent                       |

If 7R wants a squatter block than 0.75 gives, lower the surface exaggeration together with the crust
scale (for example ×3 with 0.6), rather than the crust scale alone.

**The page.** It binds both factors (claim PC20) and cites only real thicknesses. It never prints a scene
depth.

**Extremes for the locked elevation range (7D), over all boundaries at stages 0 and 1:**

- Highest bed: 7,534 m (convergent, stage 1; 7,037 m with 7A's 500 m ridges). Lowest bed: −1,906 m
  (divergent, stage 1).
- Deepest crust base: under the convergent range at stage 1, the Moho lies 63,160 m below sea level, and
  the root reaches 28,560 m below the normal Moho (34,600 m). In the snapshot's `crustBaseM` (scene metres,
  below) that is **−11,842 m**, drawn at 47.4 km below sea level at ×4. The normal crust base is −6,487 m
  (25.95 km on screen).
- Block base (row 4): −13,500 scene metres nominal, drawn at 54 km. The block actually drawn sits lower
  (see "Block frame" below).

## Formulas

All lengths in metres. `smoothstep(t) = t²(3 − 2t)` with `t` clamped to [0, 1]; `e = ease(stage) = stage`
(row 5). `noise(·)` is a seeded fractal value noise in about [−1, 1].

**Starting landscape** (identical for every boundary at stage 0):

```text
start(x, z) = L − tilt·x/1000                                   rows 7, 8
            + ½·R·cos(2π·u)            u = (z + A·sin(2π·x/λm + φseed)) / λ      rows 9–11
            − C·smoothstep(1 − d / (Wc/2))   d = distance from u to the trough line (×λ)   row 12
            + N·noise(x/λn, z/λn)                                                row 13
layer i base (before deformation) = L − tilt·x/1000 − R/2 − Σ(j ≤ i) thickness_j   row 14
Moho depth below sea level, flat:  D0 = crust.normalThicknessM − L                row 15
```

**Convergent.** `k = f0 + (1 − f0)·e` (row 22), `w = rangeWidthM·k`, `f = rangeFlankWidthM·k`:

```text
E(x)      = e · (rangeCrestElevationM − L) · smoothstep((w/2 − |x|) / f)     smooth uplift envelope
bed       = start(x, z) + E(x) · (1 + peakNoiseFraction · noise(x/λp, z/λp))
mohoDepth = D0 + airyRootPerMetreOfUplift · E(x)                              root under the envelope only
layer offset = E(x)                                                            layers rise with the range
```

**Divergent.** Fault lines at `|x| = e_i`, evenly spaced from `riftWidthM/2` (outer) to `riftFloorWidthM/2`
(inner); `S_i(x) = smoothstep((e_i − |x|) / scarpFaceWidthM + ½)`:

```text
Δ(x)      = e · [ shoulderHeightM · exp(−max(0, |x| − e_0) / shoulderDecayM) · (1 − S_0(x))
                  − floorDropM · Σ scarpDropFractions_i · S_i(x) ]
bed       = start(x, z) + Δ(x)
rise      = D0 − (crustThicknessAtAxisM − (L − floorDropM))                  = 8,500 m (row 32)
mohoDepth = D0 − e · rise · cos²(π·x / (2·thinningHalfWidthM))   for |x| < thinningHalfWidthM, else D0
layer offset = Δ(x)                                                            layers drop in steps
```

**Cover base** (D-W7-7R2), for every boundary: the base of the start's layer stack moved by the layer offset,
`coverBase = (L − tilt·x/1000 − R/2 − Σ thickness_j) + layer offset` (rows 7, 8, 10, 14). It rises with the
range, steps down at each rift fault and is unchanged by the transform. It depends on `x` only.

**Transform.** Right-lateral; the right half (x > 0) moves towards the reader (+z):

```text
shift(x)  = ½ · e · offsetM · tanh(x / faultZoneHalfWidthM)
bed       = start(x, z − shift(x))                                            relief only moves sideways
mohoDepth = D0                                                                unchanged
layer offset = 0
```

**Crust thickness** everywhere = `bed + mohoDepth` (surface height above sea level plus Moho depth below it).

**Properties 7C can test** (they hold pointwise, by construction): stage 0 is `start` for all three;
every field is continuous in the stage; convergent `E` and the root never decrease with the stage (both
factors of `E` grow, and `1 + 0.3·noise > 0`); the rift floor and the Moho rise change monotonically; the
transform keeps the multiset of elevations up to edge effects, and keeps `mohoDepth` exactly.

## Airy root proportion

A block of crust floats on the denser mantle. Take two columns down to a common depth below the deepest
root: one of normal crust of thickness H with its top at the reference level, and one with extra height h
on top and a root of depth b beneath. Equal weight per unit area (isostatic balance, TS14, Fia):

```text
ρc · H + ρm · b = ρc · (h + H + b)   ⇒   b = h · ρc / (ρm − ρc)
```

With ρc = 2,800 and ρm = 3,300 kg/m³ (rows 16, 17): b = 5.6 h (Fia states "r = 5.6 h" for these densities).
With ρc = 2,700 the factor is 4.5; with CM95's mean 2,830 it is 6.0. The crust beneath a range is then
`H + h + b = H + 6.6 h` thick.

**Cross-check against Tibet.** The scene's stage-1 crest of 5,500 m is 5,100 m above the lowland, so the
root is 5.6 × 5,100 = 28,560 m and the crust 35,000 + 5,100 + 28,560 = 68,660 m thick, with its base
63,160 m below sea level. Nab09 places the Moho about 65–70 km below sea level beneath Tibet, with a crust
of about 70–75 km once the topography is added. The authored relation lands close to the observed one.

**How the page may use it.** The root follows a cited proportion; it is an authored relation with a
source, never "computed" or "the model found". The scene applies it only beneath the range's smooth
envelope (local balance); in reality the plate's stiffness spreads the support over a wider region. That
simplification goes in "What this shows / ignores".

## Crust geometry on the front face

From the formulas, on the smooth (ridge- and noise-free) surface, right of the boundary (`x ≥ 0`; the
left is the mirror image apart from the 1.5 m/km tilt). Full table: [crust-geometry.json](../../review/plates/brief/crust-geometry.json),
regenerated by the storyboard script. `crustBaseSceneM` is the value 7C writes into the crust-base field
(see the next section).

| Boundary   | Stage | At the boundary (x = 0): surface / crust thickness / Moho depth | 20 km out               | 40 km out             | Shape on the face                                                   |
| ---------- | ----- | --------------------------------------------------------------- | ----------------------- | --------------------- | ------------------------------------------------------------------- |
| all        | 0     | 400 m / 35,000 m / 34,600 m                                     | 370 / 34,970 / 34,600   | 340 / 34,940 / 34,600 | flat crust band, flat Moho                                          |
| convergent | 0.5   | 2,950 / 51,830 / 48,880                                         | 1,772 / 44,225 / 42,453 | 340 / 34,940 / 34,600 | range 60 km wide; root 14,280 m below the normal Moho               |
| convergent | 1     | 5,500 / 68,660 / 63,160                                         | 4,940 / 65,129 / 60,190 | 340 / 34,940 / 34,600 | range 80 km wide; root 28,560 m deep, flat-bottomed under the crest |
| divergent  | 0.5   | −350 / 30,000 / 30,350                                          | 70 / 32,545 / 32,475    | 482 / 35,082 / 34,600 | floor 750 m down; Moho up 4,250 m                                   |
| divergent  | 1     | −1,100 / 25,000 / 26,100                                        | −230 / 30,120 / 30,350  | 623 / 35,223 / 34,600 | floor 1,500 m down, shoulders +600 m; Moho up 8,500 m               |
| transform  | 0.5–1 | 400 / 35,000 / 34,600                                           | 370 / 34,970 / 34,600   | 340 / 34,940 / 34,600 | unchanged; a vertical fault line on the face is optional ink        |

## Mapping onto the `LandscapeSnapshot` (for 7B and 7C)

- **Grid and orientation.** `columns` across the boundary, `rows` along it, row 0 at the back.
  `DEFAULT_ORIENTATION` (`valleyAxis: "rows"`, `"increasing"`) puts the boundary from back to front and the
  front face across it, as lesson 1's valley. The cut slider then slides the face along the boundary.
- **`bedM`** = `bed` in real metres. The stage's `reliefScale` = row 2 (4).
- **Crust base** (7B's contract, D-W7-7B: `LandscapeSnapshot.crustBaseM`, metres, surface minus crust
  thickness, same grid as the bed, drawn on the front face only). The stage applies one `reliefScale` to
  the whole block, so 7C writes it in scene metres: `crustBaseM = −mohoDepth × (row 3 / row 2) =
−mohoDepth × 0.1875`. After the stage's ×4 the Moho lands at three quarters of its true depth. The
  implied "crust thickness" `bedM − crustBaseM` is therefore a display value, not real metres. The real
  thicknesses are in the crust-geometry table above and in the claims. Both factors are bound into the
  page.
- **Block frame.** Fixed for all boundaries and stages. Row 4 puts the base 72,000 m below sea level on
  the crust's scale, `−72,000 × 0.1875 = −13,500` scene metres (drawn at 54 km). (7A's first draft of
  this line said `−72,000 / 4 = −18,000`, which applied the surface scale alone; corrected in D-W7-7R2.)
  The frame actually drawn: 7C's `elevationFrame()` runs from the deepest crust base to the highest bed,
  −11,842 to 7,534 scene metres, and the stage adds its own margin of 20 % of that span below it, so the
  base sits at about −15,718 scene metres (drawn at 62.9 km; 83.8 km on the crust's scale). The lead
  accepted that frame at 7R (D-W7-7R). The top is the convergent stage-1 maximum. Lesson 1's per-run `blockBaseM(min, max)`
  would move the base between boundaries and break the ghosts.
- **`rockId`.** Without erosion the surface is always the top layer, so one id for the whole grid (the top
  layer) is correct. The other layers show only on the block's walls and front face.
- **Cover base** (D-W7-7R2: `LandscapeSnapshot.coverBaseM`, real metres like `bedM`, drawn ×4). The formula
  above. On the front face the layered rock shows from the bed down to it, and the crust band runs from it
  down to the crust base.
- **Rock layers on the walls.** The walls draw strata by elevation. For the layers to rise under the range
  and drop at each rift fault (as the storyboard's front faces show), the stage needs the per-cell
  **layer offset** above (vertical displacement of the strata relative to the start). Without it the
  layers stay flat and the range looks carved out of flat beds rather than raised. Raised as a fact for
  7B in `DECISIONS.md` (D-W7-7A).
- **Transform sampling.** `start` is a function, so `start(x, z − shift)` needs no padding. If 7C caches the
  start on a grid, pad it by `offsetM / 2 / metresPerCell = 4` rows at each end.
- **Stage 0.** Identical for all three boundaries, bit for bit: every boundary term has the factor `e`.

## Display check (the storyboard at 820 × 640 px)

At ×4 the stage-1 range stands about 13 % of the block's width above the lowland (17 % at its peaks). At
crust scale 0.75 the crust band is 16 % of the width and the root adds 13 %; the whole front face, from the
block base to the highest peak, is about 51 % of the width. The block is taller than lesson 1's. That, the
strength of the vertical exaggeration and the two-scale front face are for the owner to judge at 7R.

## TypeScript shape (for 7C to transcribe; not code under `uplift/` or `hachure/`)

```ts
/** Every value: docs/science/plates/parameters.md row N (source or ARTISTIC CHOICE). */
interface PlatesReliefConfig {
  readonly seed: number; // row 6
  readonly grid: { readonly columns: number; readonly rows: number; readonly metresPerCell: number }; // row 1
  readonly display: {
    readonly surfaceVerticalExaggeration: number; // row 2, bound into the page
    readonly crustVerticalExaggeration: number; // row 3 (compressed crust depth), bound into the page
    readonly blockBaseDepthBelowSeaLevelM: number; // row 4
  };
  readonly start: {
    readonly lowlandElevationM: number;
    readonly regionalTiltMPerKm: number;
    readonly ridgeSpacingM: number;
    readonly ridgeReliefM: number;
    readonly ridgeMeanderAmplitudeM: number;
    readonly ridgeMeanderWavelengthM: number;
    readonly streamChannelDepthM: number;
    readonly streamChannelWidthM: number;
    readonly surfaceNoiseAmplitudeM: number;
    readonly surfaceNoiseWavelengthM: number;
    readonly layers: readonly { readonly name: string; readonly thicknessM: number }[];
  };
  readonly crust: {
    readonly normalThicknessM: number;
    readonly crustDensityKgPerM3: number;
    readonly mantleDensityKgPerM3: number;
    readonly airyRootPerMetreOfUplift: number; // DERIVED: ρc / (ρm − ρc)
  };
  readonly convergent: {
    readonly rangeCrestElevationM: number;
    readonly rangeWidthM: number;
    readonly rangeFlankWidthM: number;
    readonly rangeWidthAtStageZeroFraction: number;
    readonly peakNoiseFraction: number;
    readonly peakNoiseWavelengthM: number;
  };
  readonly divergent: {
    readonly riftWidthM: number;
    readonly riftFloorWidthM: number;
    readonly scarpsPerSide: number;
    readonly scarpDropFractions: readonly number[];
    readonly floorDropM: number;
    readonly shoulderHeightM: number;
    readonly shoulderDecayM: number;
    readonly scarpFaceWidthM: number;
    readonly crustThicknessAtAxisM: number;
    readonly thinningHalfWidthM: number;
  };
  readonly transform: {
    readonly offsetM: number;
    readonly sense: "right-lateral";
    readonly faultZoneHalfWidthM: number;
  };
  readonly dressing: { readonly snowlineM: number; readonly treelineM: number };
}
```
