/**
 * Glacier Worker for the glacial runtime fixture. Production apps call `installGlacialWorker(self)` directly.
 * The fixture waits for one setup message so a test can swap in the labelled CPU-as-"WebGPU" fake that fails
 * mid-run (exercising the halt and restart path on machines without a GPU). Never used by the book.
 */
import { installGlacialWorker, type GlacialWorkerScope } from "../../hachure/runtime/src/glacial-host/worker";
import { fakeGpuSelect } from "../../hachure/runtime/src/glacial-host/test-support";

interface FixtureScope {
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
}
const scope = globalThis as unknown as FixtureScope;

function setup(event: MessageEvent<unknown>) {
  const data = event.data as { fixtureSetup?: { fakeGpuFailAt: number | null } } | null;
  if (!data?.fixtureSetup) return;
  scope.removeEventListener("message", setup);
  const failAt = data.fixtureSetup.fakeGpuFailAt;
  installGlacialWorker(
    globalThis as unknown as GlacialWorkerScope,
    failAt === null ? {} : { select: fakeGpuSelect({ failAtStep: failAt }) },
  );
}
scope.addEventListener("message", setup);
