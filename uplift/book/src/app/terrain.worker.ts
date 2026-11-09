import { installTerrainWorker, type TerrainWorkerScope } from "@hachure/runtime/worker";
installTerrainWorker(globalThis as unknown as TerrainWorkerScope);
