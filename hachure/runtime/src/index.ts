/**
 * @hachure/runtime — public entry point.
 *
 * Stage 1 fills this in: the Spread schema, the lifecycle state machine,
 * probe bindings and the predict / flap / challenge widgets.
 * See docs/plan/stage-1.md.
 */
export const packageName = "@hachure/runtime";

// Spread schema v0 (session 1A): types, bindings and the validator.
export * from "./schema/index";

// Headless lifecycle, view state and host-fed live text (session 2D).
export * from "./core/index";
export * from "./bindings/index";
