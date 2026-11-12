/** The book's glacier Worker (session 5M): the 5J engine, WebGPU where it passes the parity check, else CPU. */
import { installGlacialWorker, type GlacialWorkerScope } from "@hachure/runtime/glacial-worker";
installGlacialWorker(globalThis as unknown as GlacialWorkerScope);
