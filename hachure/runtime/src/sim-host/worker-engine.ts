import { createCpuSolver } from "@hachure/terrain";
import { SolverTransport } from "./backend/solver-transport";
import type { HostCommand, HostReply, WorkerRequest, WorkerReply } from "./protocol";

/** Worker and main-thread CPU/GPU paths share initialization, reset and atomic diagnostics. */
export class TerrainWorkerEngine {
  private readonly transport = new SolverTransport(createCpuSolver);
  execute(command: HostCommand): Promise<HostReply> {
    return this.transport.request(command);
  }
  dispose(): void {
    this.transport.dispose();
  }
}

/** Only snapshot copies are transferred; authoritative solver and baseline arrays stay in the Worker. */
export function snapshotTransfers(reply: HostReply): ArrayBuffer[] {
  return Object.values(reply.sample?.snapshot.layers ?? {}).map((layer) => layer.buffer as ArrayBuffer);
}
export interface TerrainWorkerScope {
  addEventListener(type: "message", listener: (event: MessageEvent<WorkerRequest>) => void): void;
  postMessage(message: WorkerReply, transfer: Transferable[]): void;
}
export function installTerrainWorker(scope: TerrainWorkerScope): void {
  const engine = new TerrainWorkerEngine();
  let queue = Promise.resolve();
  scope.addEventListener("message", ({ data }) => {
    queue = queue.then(async () => {
      try {
        const reply = await engine.execute(data.command);
        scope.postMessage({ id: data.id, reply }, snapshotTransfers(reply));
      } catch (error) {
        scope.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) }, []);
      }
    });
  });
}
