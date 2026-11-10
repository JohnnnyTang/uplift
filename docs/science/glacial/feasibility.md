<!-- expert-review -->

# Feasibility record: glacier model for "From V to U" (session 5G)

Every attempt is kept, including failures (scientific rigour policy). Pilot runs used the reference
grid (128 × 96 × 40 m) unless stated. Final registered results: [results](#registered-results) and
`docs/review/glacial/model/summary.json`. Figures: `docs/review/glacial/model/`.

## Verdict

**Partly feasible with the plan-view model** (owner decision 7: full valley reach; the idealised-reach
fallback was not built, because the plan-view model does form troughs by process). Under the ice the floor
is cut down and the walls steepen to each rock's limit through shallow-ice flow, a lateral-drag shape
factor, sliding-driven erosion and rock-wall failure; below the snout the V is unchanged; the rocks differ
in a registered, measured way (rate, depth, wall steepness at equal erosion). At the registered horizon the
U is fully developed only in shale; in sandstone and granite it is incipient. What holds and what does not
is listed under [registered results](#registered-results); teach only the passing parts.

## Attempts (in order)

| #     | Attempt                                                                   | Outcome                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A0    | Plain shallow-ice approximation (SIA) + Weertman sliding + erosion ∝ u_b² | **Fails the U** (as Seddik et al. 2009 report): stress, sliding and erosion peak on the valley axis, the V deepens into an inner gorge (pilot: b fell from 1.06 to 0.8 at a mid-glacier section; floor width unchanged). In soft rock it also overdeepens without bound (registered arm `attempt-a0-plain-sia-shale`). Kept as a registered attempt arm.                                                            |
| A1    | Nye shape factor uniform over a section                                   | **Excluded analytically, not run**: a section-uniform factor scales every column's stress by the same number, so the erosion maximum stays on the axis; it changes rate, not shape.                                                                                                                                                                                                                                 |
| A2    | Local "area-method" shape factor f = strip length / H (model note §2)     | **Works**: the V-bottom cell is shielded (f ≈ 0.55–0.7 under 150–260 m of ice), sliding has a local minimum on the axis and maxima on the lower walls — the Harbor et al. (1988) pattern — so walls steepen to the rock's critical slope and the floor widens. Adopted.                                                                                                                                             |
| —     | Geometry 1: deep V (650–900 m) with a steep floor                         | Ice only 60–230 m thick (shallow-ice thickness is set by surface slope): the U formed as a narrow notch at the bottom of a much deeper V. Redesigned the start: gentle floor, high head, ridges low down-valley.                                                                                                                                                                                                    |
| —     | Sliding exponent m = 3 at Δt = 0.01 yr                                    | Diffusivity hit the stability cap on up to 8 % of ice-edge steps (thick ice piling on steep slopes). m = 2 (Weertman's (n+1)/2) removes capping (0 % in registered runs).                                                                                                                                                                                                                                           |
| A2a   | Mass balance on the live ice surface                                      | The glacier first grows (height feedback) then shrinks as erosion lowers its surface; soft rock loses its glacier soonest (pilot shale: ice 164 → 43 m at the teaching section by 300 years) so the rock comparison measures glacier size, not rock. Kept as registered attempt arms; the registered model evaluates mass balance on the starting bed (§3 of the model note), stating the omitted feedback.         |
| —     | 4-neighbour wall failure                                                  | Diamond-shaped basins aligned with the grid. Replaced by the 8-neighbour stencil.                                                                                                                                                                                                                                                                                                                                   |
| —     | Wall-failure debris left on the bed under ice                             | Debris piled into the trough floor next to the walls and left a medial bump. Debris landing on ice is now carried away by the glacier (Benn & Evans 2010).                                                                                                                                                                                                                                                          |
| A2b   | Erosion time compression 100 with ice on steep ridges                     | **Runaway**: thin ice at a steep advancing front (shallow-ice τ ≈ 350 kPa) slid at ~500 m/yr and dug a pit that deepened without bound; the run went non-finite at ~40 model years, starting at the open grid edge. Fixes, all kept: τ capped at 200 kPa for sliding/erosion (valley glaciers sustain ~50–150 kPa); a 3-cell non-eroding, ice-free frame at the grid border; a loud non-finite guard in the solver. |
| A2c   | Erosion everywhere ice slides                                             | Thin ice on ridges and headwalls eroded as fast as the trough; in shale the ridges were eroded away, ice spilled sideways and the valley turned into a broad ice-filled basin. Thin ice is now cold-based: sliding (and erosion) ramps from 0 at 40 m to full at 120 m of ice (selective linear erosion, Sugden 1978).                                                                                              |
| —     | Start slopes vs weakest rock                                              | The headwall corner (along- plus across-valley slope) exceeded shale's 34°: shale failed with no ice. Walls set to 26°, headwall rise 400 m, ridge rise 1000 m, roughness ±2 m; the no-ice shale control is now bitwise unchanged (tested).                                                                                                                                                                         |
| —     | Shape-factor smoothing: two 3 × 3 passes                                  | Over-smoothed the axis shielding: sandstone floor widening at 400 years dropped from ~+80 m to +19 m and shale overdeepened ~380 m without bound (time compression 60). One pass restored the trough. Registered: one pass.                                                                                                                                                                                         |
| —     | Horizon 600 → 400 model years                                             | With time compression 60, shale at 500–600 years had eroded its rims into a broad basin (the section measures stop meaning "valley").                                                                                                                                                                                                                                                                               |
| **N** | **Time-step convergence** (all pilots above ran at Δt = 0.01 yr)          | **The pilots were not converged.** The stability cap fired on 8 % (sandstone) to 12 % (shale) of ice-edge steps; a half-step run eroded 57 % less after 400 years. Capped flux let ice pile up and slide faster. Δt = 0.0025 and 0.00125 yr gave identical measures after 100 years (cap < 0.01 %); Δt = 0.005 differed by 3 %. Registered Δt = 0.0025 yr; CPU cost rose ~3×.                                       |
| —     | Converged model, time compression 120, horizon 400                        | Sandstone and granite form troughs; shale's glacier is lost after ~300 years (ice volume halves, the teaching section is ice-free at 400): wall failure at 34° lowers the ridges and the ice drains sideways to the open border. Registered horizon 300 years, matched times 100/200/300.                                                                                                                           |
| A2d   | Closed (no-flux) border instead of the open frame                         | Ice piled up against the closed edge (ice volume ×3 in 400 years) and carved trenches along it. Rejected; the open frame stays.                                                                                                                                                                                                                                                                                     |
| —     | T1 wall criterion +10°                                                    | Impossible for shale by construction (34° critical slope, 26° start). Set to +5° before the registered run.                                                                                                                                                                                                                                                                                                         |

## Registered results

Registered run: 300 model years, seeds 1–3, the arms of [acceptance-protocol.md](acceptance-protocol.md).
Numbers and figures: [docs/review/glacial/model](../../review/glacial/model/README.md).

**Pass:** the V below the snout is unchanged in every arm (T2); softer rock erodes faster (R1) and is cut
deeper (R4) at every matched time and seed; at equal eroded area granite holds steeper walls than shale
(41° vs 34°), so rock changes the shape, not only the rate (S1); both controls (K1, K2); the half-step
check is exact to the reported precision (N1).

**Fail (kept):** a clear trough by 300 years (T1) only in shale seeds 1 and 3 — sandstone floors widen
+19 to +27 m and walls steepen to 42°, but the shape exponent rises only ~0.1; granite has barely begun
(floor lowered 15 m). Floor-width ordering (R2) and wall ordering at matched _time_ (R3) do not hold at
every time. Shale's ridges fail at its 34° limit by ~300 years and its glacier then shrinks as ice drains to
the open border; runs longer than the horizon are not meaningful for shale.

**What can be taught** (subject to expert review): under the ice the valley floor is cut down and its
walls are steepened to what the rock can hold, while below the snout the V is left alone; soft rock is
worn away faster and deeper; hard rock keeps steeper walls. **Not yet supported:** "after the same time
the soft-rock valley is wider", and a fully developed U at the registered horizon in medium and hard
rock.

**Scientific blocker for the full claim:** in the converged model, time compression large enough to
finish the U in sandstone and granite within a playable run erodes shale's confining ridges first (they
fail at 34°), and the shale glacier is lost through the open grid border. Options for a follow-up: a wider
domain with the border far from the ice; a head basin enclosed by higher ground; or a per-run horizon
(each rock compared at matched erosion rather than matched time, which S1 already supports).
