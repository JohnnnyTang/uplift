/**
 * Browser stand-in for `vitest`. `@hachure/terrain/testing` re-exports the contract suite, which imports
 * Vitest, alongside the fake solver this page needs. The dev page never runs the suite, so these no-ops
 * only satisfy the import. See DECISIONS.md (D-2C-2).
 */
const unavailable = () => {
  throw new Error("vitest is not available on the ink dev page");
};
export const describe = () => undefined;
export const it = () => undefined;
export const test = () => undefined;
export const beforeEach = () => undefined;
export const afterEach = () => undefined;
export const expect = unavailable;
