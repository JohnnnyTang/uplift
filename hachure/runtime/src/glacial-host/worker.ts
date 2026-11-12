/**
 * `@hachure/runtime/glacial-worker`: the glacier engine side. An app's Worker module calls
 * `installGlacialWorker(self)`; tests (and a context without Workers) use `InProcessGlacialTransport`.
 * Kept apart from `@hachure/runtime/glacial` so the main thread never loads solver or GPU code.
 */
import { GlacialEngine, type GlacialEngineOptions } from "./engine";
import {
  type GlacialCommandMessage,
  type GlacialReply,
  type GlacialTransport,
  type GlacialWorkerReply,
  type GlacialWorkerRequest,
  glacialReplyTransfers,
} from "./protocol";

export { GLACIAL_START, GlacialEngine, type GlacialEngineOptions } from "./engine";

export interface GlacialWorkerScope {
  addEventListener(type: "message", listener: (event: MessageEvent<GlacialWorkerRequest>) => void): void;
  postMessage(message: GlacialWorkerReply, transfer: Transferable[]): void;
}

/** Serves one engine over `postMessage`, strictly in request order. */
export function installGlacialWorker(
  scope: GlacialWorkerScope,
  options: GlacialEngineOptions = {},
): GlacialEngine {
  const engine = new GlacialEngine(options);
  let queue = Promise.resolve();
  scope.addEventListener("message", ({ data }) => {
    queue = queue.then(async () => {
      try {
        const reply = await engine.execute(data.command);
        scope.postMessage({ id: data.id, reply }, glacialReplyTransfers(reply));
      } catch (error) {
        scope.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) }, []);
      }
    });
  });
  return engine;
}

/**
 * The engine on the calling thread, with Worker semantics: requests and replies are structured clones and
 * run strictly in order. For tests and as a last resort; it blocks the thread while a CPU batch runs.
 */
export class InProcessGlacialTransport implements GlacialTransport {
  readonly engine: GlacialEngine;
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;
  constructor(options: GlacialEngineOptions = {}) {
    this.engine = new GlacialEngine(options);
  }
  request(command: GlacialCommandMessage): Promise<GlacialReply> {
    if (this.disposed) return Promise.reject(new Error("Glacier transport is disposed"));
    const result = this.queue.then(async () => {
      try {
        return structuredClone(await this.engine.execute(structuredClone(command)));
      } catch (error) {
        // Same shape as a Worker reply: the message only, as an Error.
        throw new Error(error instanceof Error ? error.message : String(error), { cause: error });
      }
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    void this.queue.finally(() => this.engine.dispose());
  }
}
