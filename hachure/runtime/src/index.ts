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

// Accessible DOM widgets (session 2E).
export * from "./widgets/index";

export * from "./tools-ui/index";
// Fixed-step Worker host (session 3A).
export * from "./sim-host/index";

// Evidence-gated challenge evaluation and local progress (session 4C).
export * from "./challenge/index";

// Opt-in runtime diagnostics (session 4E).
export * from "./debug/index";
export * from "./a11y/index";

// Anonymous, explicitly opt-in local classroom observation (session 4F).
export * from "./instrumentation/index";
