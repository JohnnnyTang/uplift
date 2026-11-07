/* global document, navigator, Worker, performance, Blob, URL */
import { measureGpu } from "./gpu.mjs";
import { settings } from "./cpu.mjs";
function workerBenchmark() {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.mjs", import.meta.url), { type: "module" }),
      start = performance.now();
    worker.onmessage = ({ data }) => {
      worker.terminate();
      resolve({ ...data, roundTripMs: performance.now() - start });
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage(null);
  });
}
function preview(buffer) {
  const gl = document.querySelector("canvas").getContext("webgl2");
  if (!gl) return { available: false };
  const program = gl.createProgram();
  const sources = [
    [
      gl.VERTEX_SHADER,
      `#version 300 es
 precision highp float;out vec2 uv;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.0-1.0,0,1);}`,
    ],
    [
      gl.FRAGMENT_SHADER,
      `#version 300 es
 precision highp float;uniform sampler2D field;in vec2 uv;out vec4 color;void main(){float h=texture(field,uv).r;color=vec4(vec3(0.97,0.95,0.91)-h*vec3(3.0,1.6,0.4),1);}`,
    ],
  ];
  for (const [type, source] of sources) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const start = performance.now();
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 128, 128, 0, gl.RGBA, gl.FLOAT, new Float32Array(buffer));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.finish();
  const uploadAndDrawMs = performance.now() - start,
    error = gl.getError();
  gl.deleteTexture(texture);
  gl.deleteProgram(program);
  if (error !== gl.NO_ERROR) throw new Error(`WebGL2 error ${error}`);
  return { available: true, uploadAndDrawMs };
}
export async function runBenchmark() {
  const report = { date: new Date().toISOString(), userAgent: navigator.userAgent, settings, rows: [] };
  const adapter = await navigator.gpu?.requestAdapter();
  report.adapter = adapter
    ? Object.fromEntries(
        ["vendor", "architecture", "device", "description", "isFallbackAdapter"].map((k) => [
          k,
          adapter.info[k],
        ]),
      )
    : null;
  const worker = await workerBenchmark();
  report.webglPreview = preview(worker.snapshot);
  delete worker.snapshot;
  report.cpuWorker = worker;
  for (const size of [256, 512])
    for (const language of ["tsl", "wgsl"]) {
      document.querySelector("#status").textContent = `Measuring ${language} at ${size} × ${size}`;
      try {
        report.rows.push(await measureGpu(size, language));
      } catch (e) {
        report.rows.push({ size, language, error: String(e) });
      }
    }
  try {
    report.webglCompute = await measureGpu(128, "tsl", true);
  } catch (e) {
    report.webglCompute = { error: String(e) };
  }
  document.querySelector("#result").textContent = JSON.stringify(report, null, 2);
  document.querySelector("#status").textContent = "Finished. Inspect errors before accepting results.";
  return report;
}
globalThis.runBenchmark = runBenchmark;
let latest;
document.querySelector("#run").addEventListener("click", async () => {
  const button = document.querySelector("#run");
  button.disabled = true;
  try {
    latest = await runBenchmark();
    document.querySelector("#download").disabled = false;
  } catch (e) {
    document.querySelector("#status").textContent = String(e);
  } finally {
    button.disabled = false;
  }
});
document.querySelector("#download").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(latest, null, 2)], { type: "application/json" })),
    a = document.createElement("a");
  a.href = url;
  a.download = "1b-results.json";
  a.click();
  URL.revokeObjectURL(url);
});
