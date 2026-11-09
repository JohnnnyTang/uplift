# Wave 4 accessibility and motion

The visible terrain description updates from every bound snapshot. A separate
polite status coalesces running measurements to at most one announcement every
five seconds, while paused/action results are immediate; unchanged text is not
reannounced. The recorded comparison follows the same cadence. This avoids
queueing speech on every simulation snapshot without hiding current measurements.

Prediction commitment moves focus to the unlocked recorded comparison; explicit
reset returns focus to the prediction fieldset. Turning on reduced motion while
the lift is running cancels the animated rise and completes through the existing
crossfade without starting either playback. The brush cursor's aria-disabled
state now reflects both its disabled fieldset and pending tool application.

## Reproduction and evidence

Run the book on port 5194, then from the repository root:

```sh
pnpm --filter @uplift/book dev --host 127.0.0.1 --port 5194 --strictPort
node hachure/runtime/src/a11y/browser-audit.mjs
pnpm check
```

Set `LESSON_BASE_URL` to audit another local preview. The audit uses installed
Chrome through Playwright and the pinned axe-core dependency. Its keyboard path
uses Tab and keys rather than injected focus or click calls. It covers skip link,
prediction, recorded scrubbing, explanation, rain, live play/pause, brush clamps
and application, reading-level state preservation and reset focus. A separate
case switches the motion preference during the lift. Pending challenge and
hidden geological time remain unchanged.

[evidence/results.json](evidence/results.json) contains the actual Chromium
version, focus order, errors and axe findings. Both scanned states have zero
violations and zero incomplete checks. Existing palette unit tests require
4.5:1 contrast for ink, secondary text, water and sediment on paper.

The evidence PNGs were visually inspected for normal vision, deuteranopia,
protanopia and tritanopia. Comparison bars retain outline/stripe differences,
time traces retain dashed/solid lines, and terrain legends retain words and
solid/striped swatches. Labels and quantities are legible in these screenshots.
This is developer inspection under browser emulation, not a clinical colour
perception test or physical-projector review. The terrain had little visible
water/suspension in this short run; screenshots establish legend distinguishability,
not legibility of every possible flow condition.

Tools: [axe-core](https://github.com/dequelabs/axe-core) and
[Chromium vision emulation](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setEmulatedVisionDeficiency).

## Human listening remains pending

No human screen-reader listening session was performed. This preserves the open
2E/4D gate in `uplift/book/src/evidence/README.md`. Automated semantics, keyboard
and axe checks do not substitute for hearing the lesson with a screen reader.
A person must follow that existing protocol and record reader/browser versions,
observations and any fixes before this acceptance item can be marked complete.

## Handover

Done: bound visual alternative with speech coalescing, focus transitions, dynamic
reduced-motion handling, disabled-state fix, keyboard/axe and colour-vision audit.
Not done: human listening, physical projector and classroom review; integrated
new university/GPU/instrumentation views require the final combined audit.
Surprise: aria-disabled=false on the cursor overrode the semantics of its disabled
fieldset for axe, exposing an apparent contrast failure. Correct state resolves it.
Plan fact: do not close 4D solely from this automated evidence.

Ownership exceptions: small book.ts mounting/focus/motion hooks, public runtime
export, paired-replay announcement cadence, brush disabled-state line and axe-core
dev dependency are required to apply and verify the engine accessibility primitive.
