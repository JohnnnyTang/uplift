# Reader runtime verification · 5B

These are software integration fixtures, not a science lesson or human listening evidence.

- `pnpm check`: 58 files / 506 unit tests pass.
- `pnpm build`: passes (existing Three.js chunk size advisory remains).
- `pnpm exec tsc -p e2e/tsconfig.json`: passes.
- `reader-runtime.spec.ts`: all three tests pass using installed Chrome, headless,
  native `--enable-unsafe-webgpu`, at the isolated fixture server port 4274.
- `pnpm --filter @hachure/terrain test:gpu`: existing 3 browser files / 68 tests pass.
  Fresh generated comparison reports were copied to `reader-runtime-gpu-comparison.json`
  and `reader-runtime-hydraulics-comparison.json`; historical terrain reports were restored.
- `reader-runtime-keyboard.png`: after keyboard reset, focus remains on Reset,
  the question is unanswered, explanation is closed, and reading level is retained.
  Screenshot visually inspected at 1000×800.

The browser tests exercise immediate keyboard explanation reveal, no-answer stepping,
settlement, depth changes after settlement, retained host return and explicit reset.
CPU and Worker water arrays agree exactly; native GPU water arrays agree within 1e-5
following authored initialization, five fixed steps and stable-id source replacement.
Reset restores authored terrain and zero water/step. No shader or solver was changed.
Only explicit adapter unavailability skips the GPU-specific test; a shader, transport
or numerical failure fails. An attempted forced Swiftshader/Vulkan run lacked an adapter;
native Chrome subsequently passed. Bundled Chromium was unavailable locally, so the
local test config selected the installed Chrome channel. The temporary config is not committed.

The default book migration and actual two-scene page turns belong to 5E/5F. This fixture
cannot establish product acceptance, scientific sign-off or target classroom performance.
