<!-- expert-review -->

# Expert-review packet: _Where plates meet_ (session 7G)

**Status: reviewed (owner-reported, 2026-11-16, D-W6-6F).** The owner reported that the project team
completed expert review of this lesson. Reviewer names, reviewed commit and answers to the questions
below were not supplied and are not recorded here. The packet text below is the pre-review record.

_Earlier status:_ pending; no specialist had reviewed this lesson and nothing below was signed off.
The packet gathers what a reviewer needs, in reading order: what the reader sees, every claim with its sources,
the cited figures, the artistic choices in the drawing, and the questions. It points to the authoritative
registers and does not replace them:

- **Claim register** (7A): [docs/science/plates/claims.md](../../../science/plates/claims.md), PC1–PC20 and
  NT1–NT7. 7E's additions (PC21, PC22, PD1–PD8) are in
  [docs/science/plates/lesson/README.md](../../../science/plates/lesson/README.md).
- **Sentence register** (7E): the same README, with **214 reader sentences**, each listing its claims and
  sources. `lesson.test.ts` rebuilds the register from the copy and fails if a row is missing or stale, so the
  copy and the register cannot drift apart. 7G regenerated it after one wording fix (§1).
- **Sources**: [docs/science/plates/sources.md](../../../science/plates/sources.md) records what 7A actually read
  (full text, abstract only, or a standard relation). The spread's
  [sources.md](../../../../uplift/spreads/tectonics.plate-boundaries/sources.md) records the limits of use.
- **Parameter table** (the drawing's shapes): [docs/science/plates/parameters.md](../../../science/plates/parameters.md)
  and `parameters.json`. Every row is cited or labelled ARTISTIC CHOICE.

**The rule above every sentence (D-L2-1).** The figure is an **illustration**. Its relief is authored from cited
real examples, not simulated. No sentence may say or imply that a landform forms, grows, is computed or is
simulated in the scene. Real processes are described as happening in the world, and the scene as showing their
shapes. Please check this rule as carefully as the facts.

## 1 · What the reader sees at the default (school) level, verbatim

Left page (`page.hs.md`, marked expert-review):

1. "Earth's outer shell is broken into huge plates that move very slowly." (PC1; TDE-U)
2. "Where two plates meet, they push together, pull apart or slide past each other, and each kind of boundary
   shapes the land in its own way." (PC2; TDE-U)
3. "Choose a boundary and press Play: the drawing shows its landform from early to late." (PD1, PD7)
   **Changed in 7G** from "…press Play to see the landform it makes, …", which read as the landform forming in
   the scene.

The prediction asks: "When two continents push together, what happens to the crust under the mountains?" The
flap answer (`flap.hs.md`) reads: "Thicker. When two continents collide, neither sinks, because continental rock
is light. The crust crumples and piles up, so under the mountains it is much thicker than elsewhere: a deep
root." (PC3, PC6; TDE-U, Nab09, TS14)

Boundary help under the picker (`lesson.ts`):

- **Convergent:** "Two continents collide. Neither sinks: the crust crumples and is pushed up into mountains,
  with a deep root below."
- **Divergent:** "A continent is stretched. The crust cracks along faults, and blocks of land drop down between
  them into a rift valley."
- **Transform:** "The land is not raised or lowered, only moved sideways, so ridges and streams that cross the
  boundary are offset."

Each help line names its real example, for example "Shapes drawn from the Himalaya and Tibet".

The page carries one label line: "Illustration: shapes drawn from real examples". The school page types **no
figure**. Its only numbers are the scales ("heights ×4, crust depths ×0.75"), which are bound to the scene
config.

The text alternative is spoken for each boundary and stage. For convergent it reads: "… A mountain range stands
along the boundary, higher and wider at later stages, with snow on its highest ground at the end. On the front
face the rock layers bend up under the range, and the crust beneath it is thicker: a deep root."

## 2 · Every claim, its sources, and how many reader sentences rest on it

This table was generated from the two registers on 2026-11-15. Claim wording is abridged at 160 characters; the
registers hold the full text. "Sentences" counts the rows of the sentence register that cite the claim.

| ID   | Level | Status    | Claim (draft wording, abridged at 160 characters)                                                                                                               | Sources                    | Sentences |
| ---- | ----- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------- |
| PC1  | S     | taught    | Earth's outer shell is broken into large plates that move slowly.                                                                                               | TDE-U                      | 25        |
| PC2  | S     | taught    | Where two plates meet is a plate boundary. Plates move apart at a divergent boundary, towards each other at a convergent boundary, and past each other at a t…  | TDE-U                      | 56        |
| PC3  | S     | taught    | When two continents collide, neither sinks, because continental rock is light; the crust crumples and is pushed up into mountains, such as the Himalayas and…   | TDE-U                      | 43        |
| PC4  | S     | taught    | Mount Everest, in the Himalayas, rises about 8,850 m above sea level.                                                                                           | TDE-U                      | 7         |
| PC5  | S     | taught    | The Tibetan Plateau, behind the Himalayas, averages about 4,600 m above sea level.                                                                              | TDE-U                      | 7         |
| PC6  | S     | taught    | Mountain ranges have deep roots: under a high range the crust is much thicker than elsewhere.                                                                   | Nab09, TS14                | 71        |
| PC7  | U     | taught    | Beneath southern Tibet the base of the crust lies about 70 km below sea level, against about 40 km beneath the Ganges plain to the south.                       | Nab09                      | 23        |
| PC8  | U     | taught    | Continental crust is usually 30–40 km thick; seismic surveys give an average of about 41 km, about 30 km where the crust has been stretched and about 46 km u…  | TDE-I, CM95                | 5         |
| PC9  | U     | taught    | Thick, light crust floats higher on the denser mantle, a little like an iceberg in water (isostasy). For typical densities the root reaches about 5.6 times a…  | TS14, Fia                  | 36        |
| PC10 | S     | taught    | Where a continent is stretched, the crust cracks along faults and blocks of land drop down between them, making a rift valley.                                  | TDE-U, Cho05               | 41        |
| PC11 | S     | taught    | The East African Rift is a divergent boundary about 5,000 km long. Its rift valleys are typically about 50–70 km wide.                                          | Sar14, Cho05, Kel94        | 8         |
| PC12 | U     | taught    | Rift valleys are bounded by steep normal faults, often a large border fault with smaller faults and tilted blocks; the shoulders stand roughly 0.5–2 km above…  | Cho05                      | 31        |
| PC13 | U     | taught    | Beneath the Kenya Rift the crust thins from about 35 km in the south to about 20 km beneath Lake Turkana, and the thinning lies beneath the rift valley itself. | Kel94                      | 20        |
| PC14 | S     | taught    | At a transform boundary the plates slide past each other; crust is neither made nor destroyed, so the land is not raised or lowered, only moved sideways.       | TDE-U                      | 44        |
| PC15 | S     | taught    | The San Andreas Fault in California is a transform boundary about 1,300 km long. The Pacific Plate moves north-west past the North American Plate at about 5…   | TDE-U                      | 19        |
| PC16 | S     | taught    | Streams that cross the San Andreas are bent sideways where they cross it. At Wallace Creek the stream channel is offset by about 130 m.                         | SJ84                       | 18        |
| PC17 | U     | taught    | The San Andreas is right-lateral: looking across it, the far side has moved to the right. In all, the two sides have moved about 300 km past each other.        | SJ84, TDE-U                | 8         |
| PC18 | U     | explained | The Wallace Creek offset built up at about 34 mm a year, over thousands of years, in jumps of several metres during great earthquakes.                          | SJ84                       | 3         |
| PC19 | U     | explained | India collided with Asia about 40–50 million years ago, and most of the uplift of the Himalayas and Tibet came in the last 10 million years.                    | TDE-H, TDE-U               | 3         |
| PC20 | S     | display   | The drawing is an illustration: its shapes are drawn from real examples and are not to scale. Heights and rock layers are stretched (bound scale)…              | parameters.md rows 2, 3    | 50        |
| PC21 | —     | explained | Beneath real rifts hot, low-density mantle also matters (very slow upper mantle under the Kenya Rift).                                                          | Kel94                      | 14        |
| PC22 | —     | explained | Real ranges are partly held up by the plate's bending strength, spreading their support more widely.                                                            | TS14                       | 16        |
| PD1  | —     | display   | The scene is an illustration: shapes authored from real examples; they do not form in the scene.                                                                | Params, Claims             | 100       |
| PD2  | —     | display   | The stage goes from early to late: an ordering, not a clock; no years.                                                                                          | Params                     | 71        |
| PD3  | —     | display   | Continental settings only; volcanoes, earthquakes, oceans and subduction left out on purpose.                                                                   | Claims, TDE-U              | 29        |
| PD4  | —     | display   | No erosion: the land is only raised, lowered or moved sideways.                                                                                                 | Params, Kel94              | 26        |
| PD5  | —     | display   | The rock layers are generic, not a map of real rocks.                                                                                                           | Params                     | 28        |
| PD6  | —     | display   | Simplified shapes: narrower range, resized offset, symmetric steps, one boundary line.                                                                          | Params, Cho05, TDE-U, SJ84 | 32        |
| PD7  | —     | display   | Every boundary starts from the same starting landscape and is shown from early to late.                                                                         | Params                     | 52        |
| PD8  | —     | display   | Boundaries already viewed appear as labelled ghost outlines at the same stage.                                                                                  | Params                     | 46        |

PC15's plate speed and PC18–PC19 appear only in the deeper level's "Real time scales, not in the drawing"
paragraph (D-W7-7E). PC4 and PC5 appear only in the deeper level and the teacher notes, never beside the figure.

**Not taught.** Please confirm that none of these slips in:

| ID  | Never on the page                                                                                             | Note                       |
| --- | ------------------------------------------------------------------------------------------------------------- | -------------------------- |
| NT1 | "The mountains (rift, offset) form / grow / are simulated / are calculated in the scene."                     | —                          |
| NT2 | Any opening rate for the East African Rift or convergence rate for India and Asia.                            | (Sar14 not read for rates) |
| NT3 | "The Himalayas are rising more than 1 cm a year."                                                             | (TDE-H)                    |
| NT4 | "Under large ranges the crust can be 100 km thick."                                                           | (TDE-I)                    |
| NT5 | Any scene measurement as a fact ("this range is 80 km wide", "the offset is 8 km", "the root is 29 km deep"). | —                          |
| NT6 | Volcanoes, magma, earthquakes as events, ocean ridges, trenches, subduction.                                  | —                          |
| NT7 | "Rifts are symmetric" or "ranges are symmetric".                                                              | —                          |

## 3 · Typed figures (deeper level and teacher notes only)

The lesson types only cited real-world figures. Each must sit in a paragraph whose annotation names the figure's
claim (`citedFigures` in `claims.ts`, enforced by `lesson.test.ts`):

- **Heights:** 8,850 m (PC4); 4,600 m (PC5).
- **Crust:** Moho about 70 km and 40 km below sea level (PC7); crust 30–40 km, 41, 30 and 46 km (PC8); 35 → 20 km
  under the Kenya Rift (PC13).
- **Rift:** 5,000 km long and 50–70 km wide (PC11); shoulders 0.5–2 km above the floor (PC12).
- **Transform:** 1,300 km and about 5 cm a year (PC15); about 130 m at Wallace Creek (PC16); about 300 km in all
  (PC17); 34 mm a year (PC18).
- **Time:** 40–50 and 10 million years (PC19).

Everything the drawing configures is **bound** to the scene config, never typed: both vertical scales (PC20), the
Airy ratio and densities (PC9), the snowline and the block width.

## 4 · Artistic choices in the drawing (labelled, not claims)

These come from the parameter table, where each row carries its citation or its ARTISTIC label:

- **Scales:** heights and rock layers ×4; crust depths ×0.75. One factor applies to every crust depth, so the
  Airy proportions survive.
- **Range:** 80 km base to base. The Himalaya is about 250 km across.
- **Transform offset:** 8 km. Wallace Creek's offset is about 130 m; the San Andreas total is about 300 km.
- **Rift:** a symmetric stepped graben with 3 scarps per side. Real basins are often lopsided half-grabens; the
  page discloses this.
- **Starting ridges:** 1,500 m crest to trough (owner, D-W7-7R). No copy states a ridge height.
- **Rock:** one cover-rock lithology.
- **Dressing:** trees, streams and snow, with the snowline at 5,700 m (cited, Owe09). No lakes, no erosion and no
  sediment, all disclosed.
- **Root:** follows Airy isostasy directly beneath the range's smooth envelope. This is an authored relation with
  a source, not a computed result.
- **View:** 7G added a 12° tip of the block towards the reader. It is view-only and changes no shape.

## 5 · Questions for the reviewer

1. **Honesty rule.** Does any sentence, caption, text alternative or help line say or imply that the landforms
   form, grow or are computed in the scene? 7G changed one school sentence. The tests forbid "form", "grow",
   "run", "simulation" and "model time" outside denials.
2. **Crust and roots (PC6–PC9, PC13).** Are the crust thicknesses and the Moho depths under southern Tibet and the
   Kenya Rift stated fairly? Is "a root about 5.6 times as deep as the mountains stand high" (Airy, with 2,800 and
   3,300 kg/m³) acceptable for school and university readers? The flap notes that the drawn root looks only about
   as deep as the range is high (×4 heights, ×0.75 crust depths).
3. **Rifts (PC10–PC12).** Are "about 50–70 km wide" and "shoulders roughly 0.5–2 km above the floor" fair for the
   East African Rift? Is the symmetric drawn graben disclosed clearly enough?
4. **Transform (PC14–PC17).** For a continental transform, is "crust is neither made nor destroyed, so the land is
   not raised or lowered" a fair school-level simplification, given local transpression and transtension?
5. **Real time scales (PC15, PC18, PC19).** Are the plate speed, the Wallace Creek slip rate and the timing of the
   India–Asia collision hedged correctly? 7A read some sources only as abstracts, and
   [sources.md](../../../science/plates/sources.md) marks each one. Please confirm the values against the full
   texts.
6. **Scope.** Volcanoes, earthquakes, oceans and subduction are left out (PD3). Is this disclosed well enough that
   the lesson does not suggest continental boundaries have none?
7. **Figure.** In `captures/pl3-*-late-2x.png`, do the range with its root, the rift with its scarps and thinner
   crust, and the transform offset read as the real examples they cite, at the stated exaggerations?

## How to record the review

Append a DECISIONS.md entry that approves the lesson or lists the changes. Then change "expert sign-off" for PB5
and PL5 in the [ledger](README.md) from pending to done. Until then the lesson stays marked
`<!-- expert-review -->`.
