<!-- expert-review -->

# Rock types (the reader's one condition)

Three rock types with plain names. Each is a **whole-run** property (owner decision 5): it sets two
relative properties of the bed in `ROCK_TYPES` (`hachure/glacier/src/contract/rocks.ts`). Presentation
(natural colour, lithology pattern, final display name) belongs to 5H/5K/5L and R1.

| Rock      | Hardness | Relative erodibility (sandstone = 1) | Steepest stable wall |
| --------- | -------- | ------------------------------------ | -------------------- |
| shale     | soft     | 2                                    | 34°                  |
| sandstone | medium   | 1                                    | 42°                  |
| granite   | hard     | 0.4                                  | 55°                  |

## What each property does in the model

- **Relative erodibility** multiplies the glacial erosion rate ė = speed-up · ε_ref · erodibility ·
  (u_b / u_ref)² (model note §5). Basis: erosion by abrasion and quarrying depends on bed resistance as
  well as sliding (Hallet 1979; Dühnforth et al. 2010: widely jointed granite erodes slowly because
  quarrying needs fractures). Harbor (1992) represented rock resistance as a multiplier on erosion.
- **Steepest stable wall** is a threshold: where a wall is steeper, rock fails onto the slope below
  (model note §6). Basis: rock-mass strength sets the steepest slope a rock mass sustains (Selby 1980),
  and trough-wall steepness in glaciated valleys tracks rock-mass strength (Augustinus 1992, 1995).

## Source basis and limits

- The **ordering** (shale softer and weaker than sandstone, sandstone than granite) is the supported part:
  typical rock-mass strength classes of mudrock/shale, bedded sandstone and massive granite (Selby 1980).
- The **numbers are teaching choices** inside that ordering, chosen so the three runs are distinct at page
  size. They are not measured constants. Real rock masses of one name vary widely with jointing,
  bedding orientation and weathering; a fractured granite can be weaker than a massive sandstone.
- All three thresholds sit above the authored start's 30° walls, so every rock begins from the same V and
  nothing fails before the ice arrives.
- Omitted: bedding dip, joint orientation, and spatially varying rock within a run (a single rock per run
  is the product decision).
