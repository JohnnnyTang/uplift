import { buildGeometry, config, makeFixture, project, svgContours } from "./geometry";
import type { Point } from "./geometry";
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("terrain");
const gl = canvas.getContext("webgl2", { antialias: true, preserveDrawingBuffer: true });
const heightfield = makeFixture();
const start = performance.now();
const geometry = buildGeometry(heightfield);
const buildMs = performance.now() - start;
$("drawing").innerHTML = svgContours(geometry.segments);
if (!gl) {
  $("status").textContent = "WebGL2 unavailable. The flat contour drawing remains readable.";
  document
    .querySelectorAll("input,select,button")
    .forEach((el) => ((el as HTMLInputElement).disabled = true));
} else {
  const vertex = `#version 300 es
  in vec3 position; uniform float lift; uniform float offset; out vec3 surface;
  void main(){ surface=position; gl_Position=vec4((position.x-position.y)*.82,(position.x+position.y-1.)*.44-.2+position.z/220.*.9*lift, .5-position.z/1000.+offset,1.); }`;
  const fragment = `#version 300 es
  precision highp float;
  in vec3 surface; out vec4 color;
  uniform int mode; uniform int channels; uniform int vision; uniform int stroke; uniform float interval;
  vec3 simulate(vec3 c) {
    vec3 l=mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));
    if(vision==1) l=vec3(dot(l,vec3(.152286,1.052583,-.204868)),dot(l,vec3(.114503,.786281,.099216)),dot(l,vec3(-.003882,-.048116,1.051998)));
    if(vision==2) l=vec3(dot(l,vec3(.367322,.860646,-.227968)),dot(l,vec3(.280085,.672501,.047413)),dot(l,vec3(-.011820,.042940,.968881)));
    if(vision==3) l=vec3(dot(l,vec3(1.255528,-.076749,-.178779)),dot(l,vec3(-.078411,.930809,.147602)),dot(l,vec3(.004733,.691367,.303900)));
    l=clamp(l,0.,1.); return mix(l*12.92,1.055*pow(l,vec3(1./2.4))-.055,step(vec3(.0031308),l));
  }
  void main(){
    vec3 ink=vec3(.161,.169,.173), paper=vec3(.9804,.9725,.9490);
    if(stroke==1){color=vec4(simulate(ink),1.);return;}
    vec3 c=paper;
    if(channels==1){
      // Static overlay fixtures, not hydrology: separately placed for legibility checks.
      float water=1.-smoothstep(.025,.055,abs(surface.x-.32));
      float sediment=(1.-smoothstep(.035,.07,abs(surface.x-.69)))*step(.5,fract(surface.y*45.));
      c=mix(c,vec3(0.,.447,.698),water*.48); c=mix(c,vec3(.710,.475,0.),sediment*.55);
    }
    if(mode==1){
      float h=surface.z/interval;
      float dist=abs(fract(h+.5)-.5)/max(fwidth(h),.00001);
      float weight=mix(.55,1.05,1.-step(.1,abs(mod(floor(h+.5),5.))));
      c=mix(ink,c,smoothstep(weight,weight+.8,dist));
    }
    color=vec4(simulate(c),1.);
  }`;
  function shader(type: number, source: string) {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, source);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS))
      throw Error(gl!.getShaderInfoLog(s) ?? "Shader compile failed");
    return s;
  }
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw Error(gl.getProgramInfoLog(program) ?? "Shader link failed");
  gl.useProgram(program);
  const uniform = (name: string, value: number, integer = false) => {
    const loc = gl.getUniformLocation(program, name);
    if (integer) gl.uniform1i(loc, value);
    else gl.uniform1f(loc, value);
  };
  function buffer(data: number[]) {
    const b = gl!.createBuffer()!;
    gl!.bindBuffer(gl!.ARRAY_BUFFER, b);
    gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array(data), gl!.STATIC_DRAW);
    return { b, count: data.length / 3 };
  }
  const mesh = buffer(geometry.triangles);
  // Expand contour segments into screen-space ribbons: WebGL lineWidth is not portable.
  function ribbon(a: Point, b: Point, widthPx: number, lift: number, w: number, h: number) {
    const pa = project(a, lift),
      pb = project(b, lift),
      dx = (pb[0] - pa[0]) * w,
      dy = (pb[1] - pa[1]) * h;
    const len = Math.hypot(dx, dy) || 1,
      ox = ((-dy / len) * widthPx) / w,
      oy = ((dx / len) * widthPx) / h;
    return [
      pa[0] + ox,
      pa[1] + oy,
      pb[0] + ox,
      pb[1] + oy,
      pb[0] - ox,
      pb[1] - oy,
      pa[0] + ox,
      pa[1] + oy,
      pb[0] - ox,
      pb[1] - oy,
      pa[0] - ox,
      pa[1] - oy,
    ];
  }
  // Ribbons are converted back to fixture coordinates at the segment height.
  function addStroke(out: number[], a: Point, b: Point, width: number, lift: number) {
    const p = ribbon(a, b, width, lift, canvas.clientWidth, canvas.clientHeight);
    for (let i = 0; i < p.length; i += 2) {
      const diff = p[i] / 0.82,
        sum = (p[i + 1] + 0.2 - (a[2] / 220) * 0.9 * lift) / 0.44 + 1;
      out.push((sum + diff) / 2, (sum - diff) / 2, a[2]);
    }
  }
  const strokes = gl.createBuffer()!;
  const attribute = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(attribute);
  function bind(b: WebGLBuffer) {
    gl!.bindBuffer(gl!.ARRAY_BUFFER, b);
    gl!.vertexAttribPointer(attribute, 3, gl!.FLOAT, false, 0, 0);
  }
  const lift = $<HTMLInputElement>("lift"),
    contours = $<HTMLSelectElement>("contours"),
    hatching = $<HTMLSelectElement>("hatching");
  let lastMs = 0;
  function render() {
    const t = performance.now(),
      e = Number(lift.value),
      dpr = Math.min(devicePixelRatio, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.clearColor(250 / 255, 248 / 255, 242 / 255, 1);
    gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);
    gl!.enable(gl!.DEPTH_TEST);
    gl!.depthFunc(gl!.LEQUAL);
    uniform("lift", e);
    uniform("interval", config.contourIntervalM);
    uniform("offset", 0);
    uniform("stroke", 0, true);
    uniform("mode", contours.value === "shader" ? 1 : 0, true);
    uniform("channels", $<HTMLInputElement>("channels").checked ? 1 : 0, true);
    uniform(
      "vision",
      ["normal", "protanopia", "deuteranopia", "tritanopia"].indexOf($<HTMLSelectElement>("vision").value),
      true,
    );
    bind(mesh.b);
    gl!.drawArrays(gl!.TRIANGLES, 0, mesh.count);
    const lines: number[] = [];
    if (contours.value === "geometry")
      for (const s of geometry.segments) addStroke(lines, s.a, s.b, s.index ? 1.65 : 0.9, e);
    if (hatching.value !== "none")
      for (let y = 2; y < config.gridSize - 2; y += 3)
        for (let x = 2; x < config.gridSize - 2; x += 3) {
          const n = config.gridSize,
            h = heightfield[y * n + x],
            dx = (heightfield[y * n + x + 1] - heightfield[y * n + x - 1]) / 2,
            dy = (heightfield[(y + 1) * n + x] - heightfield[(y - 1) * n + x]) / 2,
            slope = Math.hypot(dx, dy);
          if (slope < 1.7 || (slope < 3 && (x + y) % 2 === 0)) continue;
          const u = x / (n - 1),
            v = y / (n - 1),
            len = 0.007 + Math.min(slope, 8) * 0.001;
          const ux = hatching.value === "parallel" ? 0.707 : -dx / slope,
            uy = hatching.value === "parallel" ? 0.707 : -dy / slope;
          addStroke(
            lines,
            [u, v, h],
            [u + ux * len, v + uy * len, h + dx * ux * len * (n - 1) + dy * uy * len * (n - 1)],
            0.85,
            e,
          );
        }
    bind(strokes);
    gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array(lines), gl!.DYNAMIC_DRAW);
    uniform("stroke", 1, true);
    uniform("offset", -0.002);
    gl!.drawArrays(gl!.TRIANGLES, 0, lines.length / 3);
    $("lift-value").textContent = e.toFixed(2);
    $("status").textContent =
      e === 0
        ? "The terrain is flat: contours mark the height of the test surface."
        : `The same contours are lifted to ${Math.round(e * 100)} percent relief. No terrain values changed.`;
    lastMs = performance.now() - t;
    $("metrics").textContent =
      `${geometry.segments.length} contour segments · ${mesh.count / 3} triangles · CPU extraction ${buildMs.toFixed(1)} ms · redraw submission ${lastMs.toFixed(1)} ms (not GPU time)`;
  }
  document.querySelectorAll("input,select").forEach((el) => el.addEventListener("input", render));
  new ResizeObserver(render).observe(canvas);
  let replay = 0;
  $("crossfade").addEventListener("click", () => {
    cancelAnimationFrame(replay);
    lift.value = "0";
    contours.value = "geometry";
    hatching.value = "none";
    $<HTMLInputElement>("channels").checked = false;
    $<HTMLSelectElement>("vision").value = "normal";
    render();
    const begin = performance.now(),
      duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 600;
    const frame = (now: number) => {
      const t = duration ? Math.min(1, (now - begin) / duration) : 1;
      canvas.style.opacity = String(t);
      if (t < 1) replay = requestAnimationFrame(frame);
    };
    canvas.style.opacity = "0";
    replay = requestAnimationFrame(frame);
  });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    canvas.style.opacity = "0";
    $("status").textContent = "Graphics context lost. Flat contour drawing shown; reload to restore relief.";
  });
  render();
}
