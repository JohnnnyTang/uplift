# Terrain tool palette and picking

Session 3E supplies reusable interaction primitives; session 3A mounts them against the Worker host.
The palette uses the existing `@hachure/terrain` brush contract and never owns simulation state.

## Integration

```ts
import { createToolPalette } from "@hachure/runtime";
import { createBrushCursorOverlay, pickHeightfield, rayFromViewport } from "@hachure/ink";

const overlay = createBrushCursorOverlay();
canvasContainer.append(overlay.root); // container is position: relative
const palette = createToolPalette({
  id: "valley-tools",
  config,
  applyTool: (op) => host.applyTool(op),
  onCursorChange: (cursor) => {
    const projection = view.projection();
    overlay.setVisible(cursor.enabled);
    if (projection && view.heightfield) {
      overlay.update(view.heightfield, projection, view.exaggeration, cursor.at, cursor.radiusM);
    }
  },
});
controls.append(palette.root);
palette.setEnabled(false); // unlock through the host's guided-loop state
```

After every displayed snapshot, camera, viewport or lift change, refresh the overlay from that same
`view.heightfield`, `view.projection()` and `view.exaggeration`. Do not pass a newer Worker heightfield
while the view still shows the older snapshot. The palette's `state()` returns the current centre,
radius, brush and amount. `refreshConfig(config)` re-clamps the controls when live configuration changes;
it does not reset the model. Changing grids requires a matching displayed heightfield/projection.

For pointer clicks, convert client coordinates into the projection's canvas-local CSS-pixel viewport,
call `rayFromViewport(projection, xPx, yPx)`, then
`pickHeightfield(view.heightfield, projection, view.exaggeration, ray)`. A hit supplies `xM` and `yM`:
pass it to `palette.setPosition(hit)`, then `palette.apply()`. A miss must not apply a brush.
The explicit ray helper also accepts rays from another camera adapter in the documented world frame.
Picking uses the mesh's existing triangle/saddle convention and returns the nearest forward hit.

The SVG cursor is an ink-only, pointer-transparent surface-following ring. It adds no independent
animation. Dispose both components when the spread closes. Hosts may style `.tool-palette`; controls
inherit native keyboard semantics and the fieldset provides a minimal grid layout.

## Keyboard and clamps

Tab reaches the tool selector, radius, tool-specific amount and terrain cursor in that order. With the
cursor focused, arrows move east/west/north/south by the configured cell spacing. Enter or Space applies
one operation; key repeat cannot paint repeatedly. The button keeps focus during asynchronous Worker
operations. A busy host cannot receive duplicate operations. Native selects and number inputs remain
keyboard operable. All displayed numeric values come from current configuration, cursor state or the
returned tool result.

The visible polite live region reports the current position, reader input clamps, terrain-edge clamps,
solver clamp reasons and actual applied volume. Only this region announces updates; numeric outputs
have automatic live announcements disabled. A rejected operation produces a retry message and restores
an operable cursor. The disabled state prevents edits before the host unlocks them.

## Verification

- `pnpm check`: includes exact-cell picks at flat, half and full lift, a saddle fixture that distinguishes
  the shared triangulation from bilinear sampling, misses, malformed rays, clipped cursor geometry and
  configuration-derived amount bounds.
- `pnpm build`: production book build.
- Browser fixture: from the repository root run `pnpm exec vite --host 127.0.0.1 --port 5183`, then
  `node hachure/runtime/src/tools-ui/smoke.mjs`. The script reuses the existing spike's Playwright tooling;
  no book code or new dependency is imported. `TOOLS_BASE_URL` can override the fixture URL.
- `fixture/results.json` and `fixture/keyboard.png` record a Chromium keyboard-only run against real
  `applyBrush` operations on a clearly labelled synthetic test surface. All four tools, both apply keys,
  reader and solver clamp notices, terrain edges, async failure, focus retention and disabled gating pass.

Human screen-reader listening remains part of 4D; live-region and keyboard assertions do not substitute
for that listening check. The synthetic fixture is never registered as an Uplift spread.
