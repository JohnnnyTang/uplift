<!-- expert-review -->

# Scientific scope for a geography education app

Product-owner clarification, 2026-11-09: prioritize visible cause and effect,
relative outcomes and understandable relationships over quantitative field
accuracy. This is an accepted product direction; the expert-review marker covers
model-specific scientific explanations, not a request to reapprove that priority.

## What we optimize

A learner changes one thing, sees a clear consequence, compares it with a baseline
and explains the relationship. For **process-model** spreads, acceptance means the
intended qualitative relationship is causally supported and visually legible at
classroom playback speed. Realistic erosion rates, exact metre-scale magnitudes
and a mapping to geological years are optional, unless the lesson claims them.
The physical-law tier still needs worked-example accuracy for the law it teaches.

A small numerical difference is useful diagnostic evidence, but not sufficient
educational evidence. Conversely, missing an arbitrary metre/cubic-metre margin
does not disprove a sound, visible qualitative relationship. Thresholds should
serve numerical reliability or a specified perceptual/task outcome; they are not
universal geomorphic constants. The original validation thresholds were already
labelled engineering proposals in [validation-spec.md](validation-spec.md).

## What remains required

- Landforms and changes emerge from the simulated mechanisms; no scripted outcome.
- The taught direction and explanation match the actual tested model. A deeper
  valley, a wider channel and more total mobilized sediment are different claims.
- Paired controls, fixed-step reproducibility, multiple seeds and honest reporting
  prevent a convincing picture from depending on a selected lucky run.
- Conservation, finite/nonnegative stocks and CPU/GPU agreement remain engineering
  correctness requirements. They do not require field-rate calibration.
- Page numbers still bind to model/configuration values. Clearly distinguish model
  units from measured-world predictions. A qualitative model can display model time
  or an uncalibrated-time label; it need not invent approximate geological years.
- Any presentation exaggeration is declared and comes from the same state. Parameters
  may be chosen for teaching within documented model limits, without representing
  those choices as measured natural constants. Two levels still share one model.
- Expert review checks the taught mechanisms, scope and misleading implications;
  qualitative lessons do not require an unrelated quantitative calibration study.

## Prospective educational acceptance

For each spread, register a single teaching claim, the paired intervention, all
seeds, the fixed run horizon and the intended view before a new validation run.
Require both a stable, numerically resolved relative effect and a visible comparison
in the actual renderer, with a matching accessible text explanation. Check that
it is readable at the intended viewport and playback speed. Save the replay/config,
bound probe comparison and visual evidence. Human review of legibility complements
numerical checks; it cannot turn a reversed causal effect into a pass.

For an uncalibrated slope-break challenge, a future protocol can use persistence
in explicitly labelled model steps/time instead of geological years. Register that
criterion and update the checker/content together before enabling a stamp. The
current geological-time checker remains pending until that implementation exists.

## Transition from the Wave 3 experiments

The owner's clarification arrived **after** the mechanism-isolation preregistration
and **while** its runs were underway. Finish the registered 36 arms unchanged;
retain all legacy thresholds and classifications for an auditable experiment.
They are diagnostic records, not the sole future release gate. Do not rewrite a
failed historical result as a pass or silently select a new prediction answer.

Assess the findings against this educational purpose separately. The present
numerical packet alone does not establish visual legibility or a validated revised
lesson. Wave 3 remains open for those demonstrations and truthful lesson content;
absence of a field-rate calibration alone no longer blocks a qualitative lesson.
Original numeric-years approval metadata must remain false until such a claim is
actually calibrated. The current app stays unscored until a supported teaching
question and its evidence are wired into it.

Sources: the product-owner instruction in this session; the tier definitions and
process-based requirements in [the handoff](../handoff.md#scientific-rigour-policy);
measurement scope in [validation-spec.md](validation-spec.md). This policy changes
product acceptance priorities, not the underlying physical process equations.
