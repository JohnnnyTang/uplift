import {
  selectTerrainBackend,
  SimHost,
  type BackendSelectionOptions,
  type AuthoredTerrainInitial,
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
/** Shared backend/host only. The frozen authored-init signature lands in 5B before integration. */
export async function createHostedWaterDriver(
  options: Pick<BackendSelectionOptions, "createWorkerTransport" | "search">,
): Promise<WaterSceneDriver | null> {
  const initial = createWaterInitial();
  const selected = await selectTerrainBackend({
    ...options,
    config: WATER_CONFIG,
    initial,
  } as BackendSelectionOptions & { initial: AuthoredTerrainInitial });
  if (!selected.transport) return null;
  const transport: HostTransport = selected.transport;
  const host = new SimHost(transport, 2000);
  const deferred = host as SimHost & {
    step: (steps: number) => Promise<void>;
    resume: (playing?: boolean) => void;
    pauseAndSettle: () => Promise<void>;
  };
  if (
    typeof deferred.step !== "function" ||
    typeof deferred.resume !== "function" ||
    typeof deferred.pauseAndSettle !== "function"
  ) {
    host.dispose();
    throw new Error("Authored reader host requires the merged 5B runtime.");
  }
  const initialize = host.initialize.bind(host) as (
    config: typeof WATER_CONFIG,
    calibration: undefined,
    initial: AuthoredTerrainInitial,
  ) => Promise<void>;
  await initialize(WATER_CONFIG, undefined, initial);
  // No host autoplay: bounded fixed-step replies and model mutations are serialized by the scene.
  return {
    snapshot: async () => {
      await host.refresh();
      return host.sample!.snapshot;
    },
    place: (op) => {
      deferred.resume(false);
      return host.applyTool(op);
    },
    advance: async (steps) => {
      deferred.resume(false);
      await deferred.step(steps);
    },
    reset: () => host.reset(),
    settle: async () => {
      await deferred.pauseAndSettle();
    },
    dispose: () => host.dispose(),
  };
}
