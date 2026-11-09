# Anonymous local observations: Demo 1, schema v1

This version is scoped to Demo 1 and the supported `rain-gross-erosion-v1`
recorded comparison. It is not a universal learning analytics schema. A schema
extension or a different scientific comparison needs an explicit version review.

Collection starts off on every mount. The reader starts and stops it explicitly;
it lives only in page memory and survives reading-level changes. Reloading discards the collector. The default cap is `DEFAULT_EVENT_LIMIT`;
retention keeps the newest events and reports how many older events were omitted.
Sequence numbers count committed observations only, with no clock or identifier.
Identical action/context sequences produce identical exports.

The strict event union and validator reject unexpected keys, free text, identity
fields, unknown versions/sources and nonfinite values. Every event is cloned before
retention. `captureLearningConfig` copies only numeric terrain contract fields and
the hardness tuple; host metadata is excluded. No names, accounts, device IDs,
absolute/relative wall clocks, cookies, local storage or network APIs are used.

Each event carries two distinct contexts. `live` contains the latest atomic host
sample's seed, model step, solver-backend enum and cloned full configuration (or null before startup).
`recorded` identifies the versioned comparison, its own seed, sample step, hydraulic
dt and paired rain inputs. Those contexts can differ and are never substituted.
The event `source` identifies live, recorded or lesson/view operations.

| Action                                  | Source   | Meaning                                                              |
| --------------------------------------- | -------- | -------------------------------------------------------------------- |
| collection                              | lesson   | Explicit start/stop with baseline context                            |
| prediction, comparison, flap            | recorded | Committed choice, replay/endpoint inspection, explanation visibility |
| learning-check                          | recorded | Optional before/after answer to the supported question               |
| challenge                               | lesson   | Pending or unavailable status; no success variant is allowed         |
| level                                   | lesson   | Reading view changed; no model operation                             |
| control, playback, brush-settings, tool | live     | Actual controls, tool settings/application result and playback       |
| reset                                   | live     | Completed live reset/default-rain transaction                        |
| restore-defaults                        | live     | University hidden-parameter restoration; distinct from terrain reset |

Stop retains data and appends a stop event before turning collection off. Clear
erases entries, sequence and omission counts, and clears optional check answers;
it preserves the reader's current on/off choice. Export remains available while
stopped if data exists. Export does not add an event or change the model. Download
failure retains the data, reports a usable message and leaves the lesson working.
There is no storage operation to fail or consent persisted between visits.

Optional checks repeat the existing gross-erosion question, with its expert-review
marker and cited recorded evidence in the source. Responses are observed without
assigning a learning-gain score. Completion, prediction correctness and a changed
answer do not establish learning gains or a validated assessment instrument.

The paired replay's typed observation callback receives copied numeric metadata.
Its exceptions are contained; it cannot interrupt rendering or endpoint gating.
Normal replay ticks update observation context without filling the log. Record
only action events and transitions into an endpoint, rather than every frame.

Integration after 4B: await each successful university `host.configure(patch)`,
then record `{ kind: "control", control, value }` for `capacityCoefficient`,
`erosionRatePerS` or `depositionRatePerS`. After a hidden-default restoration,
record `{ kind: "restore-defaults" }`. The book's existing context callback
captures the resulting host config automatically. No restoration should call
terrain reset for the sake of logging. Retain 4A's backend and 4D's accessibility
hooks while merging the small book event hooks.

Checks: `pnpm check` includes the collector tests. `pnpm test:e2e
 e2e/instrumentation.spec.ts` covers opt-out, keyboard opt-in, export validation,
clear/stop, baseline snapshots, distinct recorded/live seeds, model preservation,
and a replay observer that throws on every callback. The production budget remains
enforced by `pnpm check:bundle`.

Recorded operations do not demonstrate attention or dwell time. In particular,
a comparison pause operation may come from scrubbing, seed changes, reset,
reduced motion or automatic completion as well as the pause button. There are no
wall-clock durations in this schema; consumers must not infer time spent learning
from sequence gaps or event count.
