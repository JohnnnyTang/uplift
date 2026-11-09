/** Default module Worker entry point, shared by backend-selection consumers. */
import { installTerrainWorker, type TerrainWorkerScope } from "../worker-engine";
installTerrainWorker(globalThis as unknown as TerrainWorkerScope);
