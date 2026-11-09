<!-- expert-review -->

# Model-step challenge results: no qualifying slope break

All six registered real CPU runs completed. The new numerical morphology gate
**failed**: every uniform and hard-band arm had zero qualifying detector candidates
at every saved observation. The real spread remains pending and awards no stamp.
This does not revise any historical Wave 3 result or approve geological years.

| Seed | Arm          | Completed steps | Qualifying candidates, maximum | Endpoint persistence | Numerical health |
| ---- | ------------ | --------------- | ------------------------------ | -------------------- | ---------------- |
| 1    | Uniform/sham | 22000           | 0                              | Fail                 | Pass             |
| 1    | Hard band    | 22000           | 0                              | Fail                 | Pass             |
| 17   | Uniform/sham | 22000           | 0                              | Fail                 | Pass             |
| 17   | Hard band    | 22000           | 0                              | Fail                 | Pass             |
| 101  | Uniform/sham | 22000           | 0                              | Fail                 | Pass             |
| 101  | Hard band    | 22000           | 0                              | Fail                 | Pass             |

Registration anchor: `931285ecafa6d0592f2106e5c1158d6a919ccb9d`, including the
pre-execution import repair. The original protocol commit was `dcfc9a6`.
See [the preregistration](preregistration.md), [typed config](protocol.ts),
[complete summary and output hashes](summary.json), and [all raw records](results/).
The source hash verifier confirms that the executed protocol/tracker/solver sources
are unchanged. Every arm retains its 111 scheduled observations, effective config,
state hashes, tool operations/results, profiles and budget diagnostics.

The hard-band intervention reduced total gross erosion slightly (roughly three
model cubic metres out of roughly eighteen thousand), but gross erosion is not a
slope-break metric. No candidate existed to start the new model-step persistence
timer. Stronger reader settings and exposed rock did not support the proposed
challenge under this frozen sequence/horizon. No parameter, detector threshold,
reach, seed set or horizon was tuned after seeing these results.

Every arm passed finite/nonnegative-stock and unchanged mass-budget limits; no
stability rejection or tool-induced ground-height change occurred. The largest
absolute solid residual was below 2.5e-8 m³, water below 3.4e-9 m³; the largest wave
Courant value was below 0.036. These are numerical diagnostics, not a successful
morphological or teaching claim. Full terrain snapshots were not retained, as
registered; the fixed seed/config/tool log reproduces the states.

The registered harden brush disks really cover rows 72–75: hardness uses binary
inside-disk support including the radius boundary, whereas height tools use a
raised-cosine weight. `intervention.test.ts` verifies exactly four full rows and
unchanged ground. That check is mechanical software evidence, not a rerun or a
new morphology experiment.

Because the numerical gate failed, no successful actual-renderer comparison or
teaching-release claim is manufactured. Expert review and human accessibility/
classroom checks remain stage gates. A future attempt needs a new prospective
protocol; the software-only stamp fixture does not satisfy the science gate.

Reassess retained records with `node docs/science/validation/challenge/assess.mjs`.
Its exit status is deliberately nonzero for this failed science gate, independent
of the passing software suite. To reproduce the frozen experiment in a separate
checkout, use `node docs/science/validation/challenge/run.mjs`; avoid overwriting
this retained packet when exploring a new protocol.
