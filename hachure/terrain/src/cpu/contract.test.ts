import { describeTerrainSolverContract } from "../testing/index";
import { createCpuSolver } from "./index";
import { catchmentFixture } from "./test-fixtures";

// 1A's contract suite, run against the CPU reference solver on the validation-spec catchment fixture.
describeTerrainSolverContract("cpu", (config, preset) => createCpuSolver(config, preset), catchmentFixture());
