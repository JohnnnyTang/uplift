/**
 * @hachure/terrain — public entry point.
 *
 * Stage 1 fills this in: the typed simulation config, the grid state layout,
 * the CPU reference solver, the GPU solver, tools and probes.
 * See docs/plan/stage-1.md.
 */
export const packageName = "@hachure/terrain";

// Contracts (session 1A): config, state layout, solver interface, tools, probes.
export * from "./contract/index";
