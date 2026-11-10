/**
 * @hachure/glacier/testing — the registered protocol, its evaluator and the captured-run fixtures.
 * Browser-safe. The review scripts under ./review are Node-only and are not exported.
 */
export * from "./protocol";
export * from "./captures";
export { evaluateProtocol, type ArmResult, type SectionRecord, type Verdict } from "./evaluate";
