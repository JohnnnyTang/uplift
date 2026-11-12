import type {
  GlacialCommandMessage,
  GlacialReply,
  GlacialTransport,
  GlacialWorkerReply,
  GlacialWorkerRequest,
} from "./protocol";

/** RPC to the glacier Worker. The host keeps at most one automatic batch in flight. */
export class GlacialWorkerTransport implements GlacialTransport {
  private id = 0;
  private disposed = false;
  private readonly pending = new Map<
    number,
    { resolve(reply: GlacialReply): void; reject(error: Error): void }
  >();
  constructor(private readonly worker: Worker) {
    worker.addEventListener("message", (event: MessageEvent<GlacialWorkerReply>) => {
      const handler = this.pending.get(event.data.id);
      if (!handler) return;
      this.pending.delete(event.data.id);
      if ("error" in event.data) handler.reject(new Error(event.data.error));
      else handler.resolve(event.data.reply);
    });
    worker.addEventListener("error", (event) =>
      this.fail(new Error(event.message || "Glacier Worker failed")),
    );
  }
  request(command: GlacialCommandMessage): Promise<GlacialReply> {
    if (this.disposed) return Promise.reject(new Error("Glacier transport is disposed"));
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, command } satisfies GlacialWorkerRequest);
    });
  }
  private fail(error: Error): void {
    this.disposed = true;
    this.worker.terminate();
    for (const handler of this.pending.values()) handler.reject(error);
    this.pending.clear();
  }
  dispose(): void {
    if (this.disposed) return;
    this.fail(new Error("Glacier transport is disposed"));
  }
}
