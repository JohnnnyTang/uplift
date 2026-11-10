/**
 * @hachure/glacier — public entry point (session 5G).
 *
 * Contracts (config, rock types, state, snapshots, probes), the CPU reference solver and the authored
 * starting V-valley. The GPU solver (5I) and captured-run fixtures live behind `./gpu` and `./captures/*`.
 */
export const packageName = "@hachure/glacier";

export * from "./contract/index";
export * from "./cpu/index";
export * from "./presets/index";
