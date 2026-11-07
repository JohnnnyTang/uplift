/* global performance */
import { WebGPURenderer, StorageBufferAttribute } from "three/webgpu";
import { Fn, storage, instanceIndex, uint, float, max, vec4, wgslFn } from "three/tsl";
import { initialState, settings, median, createCpu, compare, bitwiseEqual, fixedTreeSum } from "./cpu.mjs";
const bodies = [
  "return vec4<f32>(a.x+0.0001,a.y,a.z,a.w);",
  "return vec4<f32>(max(0.0,a.x+0.125*(l.x+r.x+u.x+d.x-4.0*a.x)),(r.x-l.x)*0.25,(d.x-u.x)*0.25,a.w);",
  "return vec4<f32>(a.x,a.y/(1.0+a.x),a.z/(1.0+a.x),a.w);",
  "return vec4<f32>(a.xyz,max(0.0,a.w+0.0625*(l.w+r.w+u.w+d.w-4.0*a.w)));",
  "return vec4<f32>(a.x*0.999,a.y,a.z,a.w);",
];
function tslStage(s, a, l, r, u, d) {
  if (s === 0) return vec4(a.x.add(0.0001), a.y, a.z, a.w);
  if (s === 1)
    return vec4(
      max(0, a.x.add(l.x.add(r.x).add(u.x).add(d.x).sub(a.x.mul(4)).mul(0.125))),
      r.x.sub(l.x).mul(0.25),
      d.x.sub(u.x).mul(0.25),
      a.w,
    );
  if (s === 2) return vec4(a.x, a.y.div(float(1).add(a.x)), a.z.div(float(1).add(a.x)), a.w);
  if (s === 3)
    return vec4(a.xyz, max(0, a.w.add(l.w.add(r.w).add(u.w).add(d.w).sub(a.w.mul(4)).mul(0.0625))));
  return vec4(a.x.mul(0.999), a.y, a.z, a.w);
}
function pipeline(renderer, n, language) {
  const count = n * n,
    attributes = [
      new StorageBufferAttribute(initialState(n), 4),
      new StorageBufferAttribute(new Float32Array(count * 4), 4),
    ];
  const buffers = attributes.map((a) => storage(a, "vec4", count));
  const kernels = [0, 1].map((parity) =>
    Array.from({ length: 5 }, (_, s) => {
      const source = buffers[(parity + s) % 2],
        dest = buffers[(parity + s + 1) % 2];
      const fn = wgslFn(
        `fn stage${s}(a:vec4<f32>,l:vec4<f32>,r:vec4<f32>,u:vec4<f32>,d:vec4<f32>)->vec4<f32>{${bodies[s]}}`,
      );
      return Fn(() => {
        const i = instanceIndex,
          x = i.mod(uint(n)),
          y = i.div(uint(n)),
          a = source.element(i);
        const l = source.element(x.greaterThan(0).select(i.sub(1), i)),
          r = source.element(x.lessThan(n - 1).select(i.add(1), i));
        const u = source.element(y.greaterThan(0).select(i.sub(n), i)),
          d = source.element(y.lessThan(n - 1).select(i.add(n), i));
        dest.element(i).assign(language === "wgsl" ? fn({ a, l, r, u, d }) : tslStage(s, a, l, r, u, d));
      })().compute(count, [64]);
    }),
  );
  let parity = 0;
  return {
    step(count) {
      for (let i = 0; i < count; i++) {
        renderer.compute(kernels[parity]);
        parity = 1 - parity;
      }
    },
    async read(bytes = count * 16) {
      return new Float32Array(await renderer.getArrayBufferAsync(attributes[parity], null, 0, bytes));
    },
    dispose() {
      kernels.flat().forEach((k) => k.dispose());
      attributes.forEach((a) => a.dispose());
    },
  };
}
async function reduce(renderer, input) {
  const attributes = [
    new StorageBufferAttribute(input.slice(), 4),
    new StorageBufferAttribute(new Float32Array(input.length), 4),
  ];
  const buffers = attributes.map((a) => storage(a, "vec4", input.length / 4));
  const kernels = [];
  let parity = 0;
  try {
    for (let count = input.length / 4; count > 1; count /= 2) {
      const source = buffers[parity],
        dest = buffers[1 - parity];
      const kernel = Fn(() => {
        const i = instanceIndex;
        dest.element(i).assign(source.element(i.mul(2)).add(source.element(i.mul(2).add(1))));
      })().compute(count / 2, [64]);
      kernels.push(kernel);
      renderer.compute(kernel);
      parity = 1 - parity;
    }
    return new Float32Array(await renderer.getArrayBufferAsync(attributes[parity], null, 0, 16));
  } finally {
    kernels.forEach((k) => k.dispose());
    attributes.forEach((a) => a.dispose());
  }
}
export async function measureGpu(n, language, forceWebGL = false) {
  const renderer = new WebGPURenderer({ forceWebGL });
  await renderer.init();
  const device = renderer.backend.device,
    backend = renderer.backend.isWebGPUBackend ? "webgpu" : "webgl2";
  const finish = async (p) => (device ? device.queue.onSubmittedWorkDone() : p.read(16));
  const row = { size: n, language, backend };
  let p;
  try {
    const samples = [];
    for (let r = 0; r < settings.repeats; r++) {
      p = pipeline(renderer, n, language);
      p.step(settings.warmup);
      await finish(p);
      const start = performance.now();
      p.step(settings.steps);
      await finish(p);
      samples.push((performance.now() - start) / settings.steps);
      p.dispose();
      p = null;
    }
    Object.assign(row, { msPerStep: median(samples), samples });
    p = pipeline(renderer, n, language);
    p.step(settings.steps);
    await finish(p);
    const reference = await p.read();
    const cpu = createCpu(n);
    cpu.step(settings.steps);
    row.cpuMaxAbs = compare(reference, cpu.snapshot());
    row.cpuAgreement = row.cpuMaxAbs <= settings.tolerance;
    if (!row.cpuAgreement) {
      if (forceWebGL)
        return { ...row, rejected: "Neighbor stencil does not agree with CPU; do not use for solver" };
      throw new Error(`CPU comparison failed: ${row.cpuMaxAbs}`);
    }
    if (device) {
      const a = await reduce(renderer, reference),
        b = await reduce(renderer, reference);
      row.reduction = {
        sameDeviceBitwise: bitwiseEqual(a, b),
        cpuTreeBitwise: bitwiseEqual(a, fixedTreeSum(reference)),
        sum: [...a],
      };
      if (!row.reduction.sameDeviceBitwise || !row.reduction.cpuTreeBitwise)
        throw new Error("Fixed-tree reduction failed");
    }
    row.readback = {};
    for (const [label, bytes] of [
      ["full", n * n * 16],
      ["probe", 64 * 16],
    ]) {
      const times = [];
      for (let i = 0; i < 7; i++) {
        const start = performance.now();
        await p.read(bytes);
        times.push(performance.now() - start);
      }
      row.readback[label] = { bytes, medianMs: median(times), samples: times };
    }
    p.dispose();
    p = pipeline(renderer, n, language);
    p.step(settings.steps);
    await finish(p);
    row.sameDeviceBitwise = bitwiseEqual(reference, await p.read());
    if (!row.sameDeviceBitwise) throw new Error("Repeated GPU run differs bitwise");
    return row;
  } finally {
    p?.dispose();
    renderer.dispose();
  }
}
