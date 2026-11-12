import {
  selectTerrainBackend,
  SimHost,
  type BackendSelectionOptions,
  type HostTransport,
} from "@hachure/runtime";
import type { StateSnapshot, SpringOp, ToolResult } from "@hachure/terrain";
import { createWaterInitial, WATER_CONFIG } from "./geometry";
export interface WaterSceneDriver {
  snapshot(): Promise<StateSnapshot>;
  place(op: SpringOp): Promise<ToolResult>;
  advance(steps: number): Promise<void>;
  reset(): Promise<void>;
  settle(): Promise<void>;
  dispose(): void;
}
/** Production authored terrain uses the merged shared host API directly. */
export async function createHostedWaterDriver(
  options: Pick<BackendSelectionOptions, "createWorkerTransport" | "search">,
): Promise<WaterSceneDriver | null> {
  const initial = createWaterInitial();
  const selected = await selectTerrainBackend({
    ...options,
    config: WATER_CONFIG,
    initial,
  });
  if (!selected.transport) return null;
  const transport: HostTransport = selected.transport;
  const host = new SimHost(transport, 2000);
  await host.initialize(WATER_CONFIG, undefined, initial);
  // No host autoplay: bounded fixed-step replies and model mutations are serialized by the scene.
  return {
    snapshot: async () => {
      await host.refresh();
      return host.sample!.snapshot;
    },
    place: (op) => {
      host.resume(false);
      return host.applyTool(op);
    },
    advance: async (steps) => {
      host.resume(false);
      await host.step(steps);
    },
    reset: () => host.reset(),
    settle: async () => {
      await host.pauseAndSettle();
    },
    dispose: () => host.dispose(),
  };
}
