import type { HostCommand, HostReply, HostTransport, WorkerReply, WorkerRequest } from "./protocol";
/** A small RPC transport; SimHost bounds automatic advance/sample calls to one in flight. */
export class WorkerTransport implements HostTransport {
  private id = 0;
  private disposed = false;
  private readonly pending = new Map<
    number,
    { resolve(reply: HostReply): void; reject(error: Error): void }
  >();
  constructor(private readonly worker: Worker) {
    worker.addEventListener("message", (event: MessageEvent<WorkerReply>) => {
      const handler = this.pending.get(event.data.id);
      if (!handler) return;
      this.pending.delete(event.data.id);
      if ("error" in event.data) handler.reject(new Error(event.data.error));
      else handler.resolve(event.data.reply);
    });
    worker.addEventListener("error", (event) =>
      this.fail(new Error(event.message || "Terrain Worker failed")),
    );
  }
  request(command: HostCommand): Promise<HostReply> {
    if (this.disposed) return Promise.reject(new Error("Host transport is disposed"));
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, command } satisfies WorkerRequest);
    });
  }
  private fail(error: Error): void {
    this.disposed = true;
    this.worker.terminate();
    for (const handler of this.pending.values()) handler.reject(error);
    this.pending.clear();
  }
  dispose(): void {
    this.disposed = true;
    this.worker.terminate();
    this.fail(new Error("Host transport is disposed"));
  }
}
