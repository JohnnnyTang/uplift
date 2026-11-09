import type { StateSnapshot } from "@hachure/terrain";
import { BOOK_PALETTE } from "@hachure/runtime";
/** Diagnostic row profiles from the fake snapshot, not the production contour renderer. */
export function drawFixture(canvas: HTMLCanvasElement, state: StateSnapshot, showWater: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width,
    height = canvas.height;
  ctx.fillStyle = BOOK_PALETTE.paper;
  ctx.fillRect(0, 0, width, height);
  const bedrock = state.layers.bedrockM;
  if (!bedrock) return;
  const n = state.gridSize,
    min = Math.min(...bedrock),
    max = Math.max(...bedrock),
    span = Math.max(max - min, 1);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = BOOK_PALETTE.ink;
  for (let y = 0; y < n; y += 2) {
    ctx.beginPath();
    for (let x = 0; x < n; x++) {
      const px = width * (0.08 + (0.84 * (x + 0.5)) / n);
      const py = height * (0.16 + (0.7 * y) / (n - 1) - (0.12 * (bedrock[y * n + x]! - min)) / span);
      if (x === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  if (showWater && state.layers.waterM) {
    ctx.strokeStyle = BOOK_PALETTE.water;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let y = 0; y < n; y++) {
      const depth = state.layers.waterM[y * n + state.outlet.x]!;
      const x = width * (0.08 + (0.84 * (state.outlet.x + 0.5)) / n),
        py = height * (0.16 + (0.7 * y) / (n - 1));
      if (depth > 0) {
        ctx.moveTo(x - 2, py);
        ctx.lineTo(x + 2, py);
      }
    }
    ctx.stroke();
  }
}
