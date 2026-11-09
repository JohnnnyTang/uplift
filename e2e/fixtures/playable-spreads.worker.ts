import { installTerrainWorker, type TerrainWorkerScope } from "../../hachure/runtime/src/index";
installTerrainWorker(globalThis as unknown as TerrainWorkerScope);
