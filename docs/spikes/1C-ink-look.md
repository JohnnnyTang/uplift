# 1C · Ink look and lift

## Run and reproduce

From this worktree: `pnpm exec vite spikes/ink-look --host 127.0.0.1 --port 5175`.
Open http://127.0.0.1:5175. No additional runtime dependency, CDN or workspace lockfile edit.

- `pnpm exec tsc -p spikes/ink-look/tsconfig.json`
- `pnpm exec vitest run --config spikes/ink-look/vitest.config.ts`
- `pnpm check`
- With Playwright installed and Chrome available, `node spikes/ink-look/capture.mjs`.
  If Playwright is outside normal module resolution, set `PLAYWRIGHT_MODULE` to its package directory.
  Run the Vite server first. Captures overwrite `evidence/`.

This is a static analytic **renderer fixture**, never an erosion demonstration. There is no solver,
randomness, model clock or claim about geomorphological behaviour. Relief changes only the projection.

## Recommendation for 2C

Use geometry contours for the initial implementation and SVG handoff. Retain shader isolines as a
comparison/debug mode until larger-grid profiling justifies them. At zero exaggeration, shader height
must remain the original height, not the displaced vertical coordinate; otherwise the isolines vanish.
Geometry retains explicit index-contour weights and the same endpoints as SVG throughout the lift.
Shader isolines have lower CPU submission cost here, but their screen-space width varies near silhouettes.

This spike intersects the **same triangles as the rendered mesh**, rather than independent marching
squares. This is a deliberate deviation: square saddle decisions and bilinear contours can disagree
with a triangulated surface. 2C should either use this triangle-consistent extraction, or specify and test
one saddle/diagonal rule shared by its marching squares and mesh. Join segments into polylines in 2C;
this throwaway spike does not implement the production contour API.

Prefer short downslope hachures, sparsely seeded on a fixed lattice, with density increasing with slope.
Parallel hatching gives a texture but obscures the downslope direction. Keep hachures optional; omit them
in the flat handoff. The spike rebuilds ribbons on input; production should cache geometry and reuse GPU
buffers. Use screen-space ribbons, since portable WebGL line widths cannot provide index weights.
A small depth bias keeps ribbon edges above the mesh; 2C needs camera-dependent bias and silhouette checks.

Crossfade: paint SVG first, initialise the renderer behind it, match orthographic projection and viewport,
then crossfade to geometry contours at exaggeration zero with overlays/hachures off. Only then enable the
lift. The button demonstrates the first handoff; the slider separately demonstrates the lift. Preserve
original heights. Reduced motion completes the crossfade immediately. No automatic motion on page load.
SVG remains present when WebGL2 is unavailable or its context is lost.

## Evidence and limits

Chrome 156.0.8078.80, headless, 1280 × 900, local Windows environment. Recorded in
[results.json](../../spikes/ink-look/evidence/results.json). This is not an integrated-GPU benchmark or
a physical projector assessment, and does not settle WebGPU/Three integration (1B/2C).

| Measurement                         | Observed                                 |
| ----------------------------------- | ---------------------------------------- |
| Grid / triangles / contour segments | 65² / 8,192 / 2,785                      |
| CPU contour extraction, one sample  | See results.json (rerun-dependent)       |
| Geometry submission at full relief  | See results.json; roughly a few ms       |
| Shader submission at full relief    | See results.json; below 1 ms in this run |
| Browser exceptions                  | None                                     |
| Keyboard arrow on exaggeration      | 0 → 0.01                                 |
| Reduced-motion handoff              | Flat, canvas opacity 1 immediately       |
| Mobile width 390 px                 | No horizontal overflow                   |

Submission timings include JS ribbon generation and WebGL calls; **they are not GPU timings or fps**.
Single redraw samples are directional evidence, not statistical benchmarks. The focused tests check
contour levels, projection invariants, constant fields, and SVG endpoints. Root checks do not discover
spike tests; run the explicit command above.

Screenshots: [flat](../../spikes/ink-look/evidence/lift-0.png),
[half relief](../../spikes/ink-look/evidence/lift-0.5.png),
[full relief](../../spikes/ink-look/evidence/lift-1.png),
[1280 × 720 layout](../../spikes/ink-look/evidence/projector.png).

The palette preview applies Machado et al.'s full-severity matrices to **linear RGB** and converts back
to sRGB. Normal, protanopia, deuteranopia and tritanopia screenshots are in `evidence/palette-*.png`.
Blue and ochre remain distinguishable in the previews; sediment also has an interrupted stripe pattern.
This is a visual simulation check, not proof of universal perception or a contrast audit. Legend labels
preserve identity without colour. Actual projector washout and user evaluation remain wave-5 work.

## Tokens for 2C and 2E

| Token         | Value                 | Purpose                                               |
| ------------- | --------------------- | ----------------------------------------------------- |
| paper         | #FAF8F2               | Flat untextured page and canvas clear colour          |
| ink           | #292B2C               | Contours, hachures, text                              |
| water         | #0072B2               | Continuous water overlay; opacity 0.48 in fixture     |
| sediment      | #B57900               | Interrupted sediment overlay; opacity 0.55 in fixture |
| contour       | 0.9 CSS px            | Ordinary contour ribbon and SVG stroke                |
| index contour | 1.65 CSS px           | Every fifth contour from config                       |
| hachure       | 0.85 CSS px           | Sparse downslope strokes                              |
| body          | Segoe UI / sans-serif | Controls and supporting text                          |
| display       | Georgia / serif       | Quiet book typography                                 |

No decorative texture, glow, or gradients in terrain. Overlays are separately located masks for palette
inspection, not water or sediment fields. 2C must replace them with actual state channels. At 720 px high
the controls require vertical scrolling; the terrain remains readable, but 2E should use a more compact
control layout for projection.

## Technical references

- [Khronos derivative specification](https://registry.khronos.org/webgl/extensions/OES_standard_derivatives/):
  derivatives promoted to core in WebGL2 / GLSL 300 es; `fwidth` supports anti-aliased isolines.
- [Machado, Oliveira and Fernandes (2009)](https://doi.org/10.1109/TVCG.2009.113),
  A Physiologically-based Model for Simulation of Color Vision Deficiency.
  [Author matrices](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html).

## Handover

Done: runnable comparison, relief slider, SVG handoff, two hatching modes, labelled overlays, palette
previews, screenshots, focused checks, and token proposal. Not done: production InkView, moving solver
state, WebGPU/Three integration, target-device GPU timings, physical projector assessment. Surprise:
contouring the exact mesh matters as much as sharing the heightfield. Plan impact: 2C must explicitly
align saddle topology and projection between SVG and the terrain mesh before refining the ink material.
