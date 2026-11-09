import { describe } from "vitest";
import { describeTerrainSolverContract } from "../testing/contract-suite";
import { catchmentFixture } from "../cpu/test-fixtures";
import { createGpuTerrainSolver } from "../gpu/index";
const adapter = await navigator.gpu?.requestAdapter();
describe.skipIf(!adapter)("Complete GPU public contract [requires-webgpu]", () => {
  describeTerrainSolverContract("managed WebGPU", createGpuTerrainSolver, catchmentFixture());
});
