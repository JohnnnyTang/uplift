# Wave 4 decisions and human review

Prepared 2026-11-09. This packet does not approve scientific claims or close human gates.
Merge order remains 4E -> 4A -> 4B -> 4C -> 4D -> 4F.

## Decision 1: scope of the challenge merge (4C, PR #25)

The implementation includes guarded challenge evaluation, a model-step persistence
tracker, accessible stamp UI and best-effort local progress. Pending science blocks
all real-book stamps, including previously saved stamps. Synthetic passing tests
verify software only.

All six prospectively registered CPU arms (seeds 1, 17 and 101, each uniform/sham
and hard-band) completed 22000 steps with healthy numerical budgets. Every arm had
zero qualifying slope-break candidates. This experiment cannot support the
waterfall challenge. Do not lower thresholds after the fact or call it a pass.

Evidence to review:

- [PR #25](https://github.com/JohnnnyTang/uplift/pull/25)
- [Results and interpretation](https://github.com/JohnnnyTang/uplift/blob/s1/w4/4c-challenge/docs/science/validation/challenge/README.md)
- [Prospective protocol](https://github.com/JohnnnyTang/uplift/blob/s1/w4/4c-challenge/docs/science/validation/challenge/preregistration.md)
- [Complete result summary](https://github.com/JohnnnyTang/uplift/blob/s1/w4/4c-challenge/docs/science/validation/challenge/summary.json)

Recommended decision: approve merging 4C's infrastructure and retained failed
experiment with the real challenge visibly pending and stamps disabled. Explicitly
separate implementation integration from the unfulfilled challenge acceptance
criterion. Wave 4 and the Stage 1 challenge gate remain open until a new successful
prospective experiment, or a separately approved replacement challenge, satisfies
them. This approval allows subsequent implementation merges; it does not approve
release, a waterfall claim, geological time or science sign-off.

Alternative: retain 4C as a draft and hold later merges in order while a new
prospective experiment is designed and validated. No success is guaranteed.

Owner decision (2026-11-09): APPROVED in chat. Merge infrastructure and failed
evidence, keep stamps disabled and challenge acceptance open.

## Human review 2: screen-reader listening (4D, PR #23)

Automated keyboard, axe, reduced-motion and palette checks are recorded on the
branch. Human listening is NOT PERFORMED. The final combined application also
needs its automated accessibility audit repeated after integration.

- [PR #23](https://github.com/JohnnnyTang/uplift/pull/23)
- [Audit report and reproduction](https://github.com/JohnnnyTang/uplift/blob/s1/w4/4d-accessibility/hachure/runtime/src/a11y/README.md)
- [Original listening protocol](../../uplift/book/src/evidence/README.md)

After integrating the review preview, use NVDA or Narrator with Chrome. Record
reader/browser versions and the tested commit. Complete this listening sequence:

1. Read the spread's title, model scope, units, legends and starting terrain description.
2. Navigate using the keyboard, choose a prediction and commit it. Confirm the
   selected answer and movement to the unlocked comparison are understandable.
3. Scrub or play the recorded comparison, inspect the endpoint and reveal the
   explanation. Confirm recorded results are distinguishable from the live terrain.
4. Adjust live rain and speed, then play/pause. Listen for labels, units and useful
   measurements without a continuous backlog of announcements.
5. Switch to university. Read the profile alternative, sediment budget and math.
   Change a university parameter, return to high school and use the hidden-settings
   restore action. Confirm the context and values are understandable.
6. Reset. Confirm focus and prediction gating return appropriately; the challenge
   remains pending and no stamp is awarded.
7. Enable reduced motion; verify no automatic playback and accessible explicit Play.

Record: tested commit; OS/browser; screen reader/version; pass/fail for each step;
confusing/missing speech; focus loss; any blocking issue and reproduction steps.
A pass requires an actual listener, not an automated accessibility snapshot.

Owner choice (2026-11-09): prepare a listening preview BEFORE merging 4D.
4D and 4F remain unmerged until this review is resolved. No human pass is claimed.

## Remaining Stage 1 reviews (not requested for merge approval here)

Expert review of science and teaching claims, controlled visible integrated-GPU
performance, classroom/projector review and the stage recording remain open.
They belong to the Stage 1/Wave 5 gate and are not silently waived by merging code.
4F remains opt-in, local-only and anonymous; the owner already authorized its scope.

## Listening preview prepared for the owner

4A (#27), 4B (#22) and the approved infrastructure-only 4C (#25) are merged.
This review branch contains their code plus 4D. It deliberately excludes 4F,
which waits after 4D in merge order. PR #23 remains draft and unmerged.

Open in Chrome with NVDA or Narrator:

- [Listening preview, fixed CPU Worker backend](http://127.0.0.1:5194/?backend=cpu-worker)
- [Automatic hardware selection](http://127.0.0.1:5194/)

The first link fixes the backend so the listening result is easier to reproduce.
The model is real, and the recorded comparison remains separately labelled.
If the preview stops, from D:/code/uplift-wt/4d-accessibility run:

```powershell
pnpm --filter @uplift/book dev --host 127.0.0.1 --port 5194 --strictPort
```

Use the seven listening steps above. Reply with:

```text
Screen reader and version:
Chrome version:
Preview URL/backend:
Steps 1-7: pass / issue (describe each issue and steps to reproduce)
Speech repetition or missing labels:
Focus loss:
Ready to merge 4D: yes / no
```

Automated integrated checks: keyboard-only loop, preserved state across levels,
reduced-motion change during renderer loading, and axe scans of high-school and
university states pass, with zero axe violations or incomplete checks. An added
DOM-mutation check verifies unchanged pending challenge status is not repeatedly
rewritten while playing or changing levels. This is not a human listening pass.

A known local science-fixture startup stall recurred during 4C integration. The
other 17 browser cases passed, CI's complete suite passed, and both isolated
repeats passed without code/timeout changes. Its trace had the initial page but
no worker request or reported script error; the cause remains unconfirmed. The
review preview has passed its own integrated audit; report a stuck initial page
if observed rather than treating the old stall as fixed.
