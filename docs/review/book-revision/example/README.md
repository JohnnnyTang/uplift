# Playable example evidence

The real Ink/WebGL2 scenes were inspected in installed Chrome at desktop and phone sizes. These are isolated renderer/controller checks, not the final book shell, a learner study or expert approval.

- `contour-flat-desktop.png` and `contour-raised-desktop.png`: direct attached-ring lift. The dashed isoline stays on the same extracted geometry; view exaggeration is disclosed.
- `water-response-desktop.png` and `water-moved-desktop.png`: solver-derived blue depth and wet-cell ink marks. After direct placement in the right hollow, left water visibly remains. No trail is animated or authored.
- `water-reduced-motion.png`, `water-phone.png` and `flat-fallback-phone.png`: native keyboard placement, settled response without intermediate animation, natural phone reflow, labelled static diagram.
- `interaction.webm`: pointer lift, keyboard spring movement, direct second placement, reset, reduced motion, phone and fallback checks. Fixture navigation is deliberately labelled; final book turning belongs to 5C/5E/5F.

Visual decisions: ink #263332, paper #fffdf8, water blue from the shared Ink channel palette; no decorative quantity colour. The illustration owns the space; the dashed isoline/ring is the memorable feature. Water has only source placement as its primary action; its lift control is hidden. Coordinates and wet-cell count are disclosed at university level. Thresholds and domain width remain bound in the legend to interpret the encoding.

## Reproduction

`pnpm exec playwright test --config e2e/fixtures/playable-spreads.playwright.ts` uses the isolated port 4474. The global suite uses its ordinary fixture port 4174. The local config requires installed Chrome. Full schema/type/lint/format/unit checks use `pnpm check`; `pnpm build` verifies the existing app while migration remains separate.

For composed host verification after 5B is merged, start `pnpm exec vite --config e2e/fixtures/playable-spreads.config.ts --port 4474 --strictPort`, then open `/e2e/fixtures/playable-spreads.html?host&backend=cpu-worker` (also `cpu-64`, `webgpu`, `flat`). This opt-in fixture invokes the production `createHostedWaterDriver`, not the test solver adapter. The branch consumes only the frozen main contracts: the production adapter guards for additive `step`, `resume` and `pauseAndSettle` until B lands. Actual B+D backend wiring and GPU acceptance are pending on this branch and must be verified at integration.

`createPlayableEntries({createWorkerTransport,search,inkBackend?})` is the production composition entry for 5E. It returns the fixed contour→water entries. Both consume public Hachure entry points. The water entry always selects the shared authored SimHost/backend path; the real CPU fixture is never a production fallback.

## Guarantees checked

The renderer tests assert pointer lift, keyboard water source, direct surface placement, reset, reduced motion, retained lift on revisit and labelled flat fallback. A delayed real CPU fixture proves departure settles a partial response, model hashes agree across a level/selection-only change, return completes the remaining fixed steps, and reset restores step zero. A delayed-initialization disposal test guards against late scene resurrection. Geometry/text checks catalogue-validate every supplied lesson and assert the selected contour samples and projections.

Page and model share bound elevation, interval, exaggeration, domain, wet threshold, colour ramp and accepted source coordinates. A requested selection never places a spring. The stable source id replaces the source only when the tool reports applied. Drawable-domain limits derive from the actual grid/cell size, and limited placement is disclosed.

No solver kernels changed. Human discoverability, projector contrast, target hardware, integrated page turns, domain-expert sign-off and GPU/backend integration remain separately pending.
