/** <!-- expert-review --> Same ordered update as cpu/kernel.ts; hydraulic-resistance.md derives it. */
import { DRY_DEPTH_M, MM_PER_HR_TO_M_PER_S, WAVE_SAFETY_FACTOR } from "../cpu/index";
const f = (x: number) => x.toExponential(16);
export const rainWgsl = `fn rain(a:vec4<f32>, base:vec4<f32>, change:vec4<f32>, dt:f32, rain:f32)->vec4<f32> {
  return vec4<f32>(a.x + dt * rain * ${f(MM_PER_HR_TO_M_PER_S)} + dt * base.w, base.x + base.y, change.x, 0.0);
}`;
export const pipeWgsl = `fn pipes(c:vec4<f32>, w:vec4<f32>, e:vec4<f32>, n:vec4<f32>, s:vec4<f32>, old:vec4<f32>, i:u32, size:u32, outlet:u32, face:u32, base:f32, dt:f32, l:f32, area:f32, g:f32, rough:f32)->vec4<f32> {
  if (c.x <= ${f(DRY_DEPTH_M)}) { return vec4<f32>(0.0); }
  let x = i % size; let y = i / size;
  let pipe = dt * area * g / l;
  var q = vec4<f32>(0.0);
  if (x > 0u) { q.x = max(0.0, old.x + pipe * ((c.y-w.y)+(c.z-w.z)+(c.x-w.x))); }
  else if (i == outlet && face == 0u) { q.x = max(0.0, old.x + pipe * ((c.y-base)+c.z+c.x)); }
  if (x < size-1u) { q.y = max(0.0, old.y + pipe * ((c.y-e.y)+(c.z-e.z)+(c.x-e.x))); }
  else if (i == outlet && face == 1u) { q.y = max(0.0, old.y + pipe * ((c.y-base)+c.z+c.x)); }
  if (y > 0u) { q.z = max(0.0, old.z + pipe * ((c.y-n.y)+(c.z-n.z)+(c.x-n.x))); }
  else if (i == outlet && face == 2u) { q.z = max(0.0, old.z + pipe * ((c.y-base)+c.z+c.x)); }
  if (y < size-1u) { q.w = max(0.0, old.w + pipe * ((c.y-s.y)+(c.z-s.z)+(c.x-s.x))); }
  else if (i == outlet && face == 3u) { q.w = max(0.0, old.w + pipe * ((c.y-base)+c.z+c.x)); }
  let flowArea = l*c.x; let radius = flowArea/(l+2.0*c.x);
  let beta = dt*area*g*rough*rough/(flowArea*flowArea*pow(radius,4.0/3.0));
  return 2.0*q/(vec4<f32>(1.0)+sqrt(vec4<f32>(1.0)+4.0*beta*q));
}`;
export const limitWgsl = `fn limit(q:vec4<f32>, h:f32, dt:f32, l:f32)->vec4<f32> {
  let sum = q.x+q.y+q.z+q.w;
  var k = 1.0; if (sum > 0.0) { k = min(1.0,l*l*h/(dt*sum)); }
  return vec4<f32>(k, dt*k*sum/(l*l*max(h,${f(DRY_DEPTH_M)})),0.0,0.0);
}`;
export const gatherWgsl = `fn gather(c:vec4<f32>, w:vec4<f32>, e:vec4<f32>, n:vec4<f32>, s:vec4<f32>, q:vec4<f32>, qw:vec4<f32>, qe:vec4<f32>, qn:vec4<f32>, qs:vec4<f32>, k:f32, i:u32, size:u32, dt:f32, l:f32, g:f32)->vec4<f32> {
  let x = i % size; let y = i / size;
  let out = q.x+q.y+q.z+q.w;
  var own = max(0.0,c.x-dt/(l*l)*out); if (k < 1.0) { own = 0.0; }
  var inflow = 0.0;
  if (x > 0u) { inflow += qw.y; } if (x < size-1u) { inflow += qe.x; }
  if (y > 0u) { inflow += qn.w; } if (y < size-1u) { inflow += qs.z; }
  let h = own + dt/(l*l)*inflow;
  if (0.5*(c.x+h) <= ${f(DRY_DEPTH_M)}) { return vec4<f32>(h,0.0,0.0,0.0); }
  let ownArea = l*max(c.x,${f(DRY_DEPTH_M)});
  var jw = -q.x/ownArea; var je = q.y/ownArea; var jn = -q.z/ownArea; var js = q.w/ownArea;
  if (x > 0u) { jw += qw.y/(l*max(w.x,${f(DRY_DEPTH_M)})); }
  if (x < size-1u) { je -= qe.x/(l*max(e.x,${f(DRY_DEPTH_M)})); }
  if (y > 0u) { jn += qn.w/(l*max(n.x,${f(DRY_DEPTH_M)})); }
  if (y < size-1u) { js -= qs.z/(l*max(s.x,${f(DRY_DEPTH_M)})); }
  let u = 0.5*(jw+je); let v = 0.5*(jn+js);
  let celerity = sqrt(g*max(c.x,h));
  return vec4<f32>(h,u,v,dt*(abs(u)+celerity+abs(v)+celerity)/l);
}`;
export const diagnosticWgsl = `fn waterDiagnostics(a:vec4<f32>, q:vec4<f32>, transport:f32)->vec4<f32> {
  var invalid = 0.0;
  if (!(a.x >= 0.0 && all(abs(a) < vec4<f32>(3.4e38)) && all(q >= vec4<f32>(0.0)) && all(q < vec4<f32>(3.4e38)))) { invalid = 1.0; }
  return vec4<f32>(a.w, transport, invalid, 0.0);
}`;
export const guardWgsl = `fn guard(old:vec4<f32>, candidate:vec4<f32>)->vec4<f32> {
  if (old.y > 0.0) { return old; }
  var failure = 0.0;
  if (candidate.z > 0.0) { failure = 2.0; }
  else if (candidate.x > ${f(WAVE_SAFETY_FACTOR)}) { failure = 1.0; }
  var step = old.z; if (failure == 0.0) { step += 1.0; }
  return vec4<f32>(candidate.x,failure,step,candidate.y);
}`;
/** Separate compensated change lane: absolute base elevation never rounds each erosion increment away. */
export const changeWgsl = `fn change(old:vec4<f32>, delta:f32)->vec4<f32> {
  let corrected = delta-old.y;
  let next = old.x+corrected;
  return vec4<f32>(next,(next-old.x)-corrected,0.0,0.0);
}`;
