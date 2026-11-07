import { test } from "node:test";
import assert from "node:assert/strict";
import { createCpu, bitwiseEqual, compare, fixedTreeSum } from "./cpu.mjs";
test("fixed steps reproduce every lane", () => {
  const a = createCpu(16),
    b = createCpu(16);
  a.step(31);
  b.step(30);
  b.step(1);
  assert.ok(bitwiseEqual(a.snapshot(), b.snapshot()));
  assert.equal(compare(a.snapshot(), b.snapshot()), 0);
});
test("closed stencil keeps bounded suspended lane and finite water", () => {
  const a = createCpu(17);
  a.step(100);
  const data = a.snapshot();
  for (let i = 0; i < data.length; i++) {
    assert.ok(Number.isFinite(data[i]));
    if (i % 4 === 3) assert.ok(data[i] >= 0.02 && data[i] <= 0.021);
    if (i % 4 === 0) assert.ok(data[i] >= 0);
  }
});
test("comparison rejects corrupt and mismatched states", () => {
  assert.throws(() => compare(new Float32Array([NaN]), new Float32Array([0])));
  assert.throws(() => compare(new Float32Array(1), new Float32Array(2)));
  assert.equal(compare(new Float32Array([1]), new Float32Array([2])), 1);
});

test("fixed binary tree has known lane sums", () => {
  assert.deepEqual(
    [...fixedTreeSum(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]))],
    [28, 32, 36, 40],
  );
});
