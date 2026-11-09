/** Full process stages, in the same pass order as cpu/kernel.ts. <!-- expert-review --> */
import type { ComputeNode, Node, StorageBufferAttribute, WebGPURenderer } from "three/webgpu";
import { Fn, storage, instanceIndex, uint, float, vec4, max, wgslFn } from "three/tsl";
import type { TerrainConfig, TerrainState } from "../contract/index";
import {
  DRY_DEPTH_M,
  MM_PER_HR_TO_M_PER_S,
  REFERENCE_CAPACITY_THICKNESS_M,
  REFERENCE_SPEED_M_PER_S,
} from "../cpu/index";

const erodeCode = `fn erosion(c:vec4<f32>, w:vec4<f32>, e:vec4<f32>, n:vec4<f32>, s:vec4<f32>, a:vec4<f32>, material:vec4<f32>, i:u32, size:u32, l:f32, capacity:f32, erode:f32, deposit:f32)->vec4<f32> {
  let x=i%size; let y=i/size;
  var dx=((e.y-w.y)+(e.z-w.z))/(2.0*l); var dy=((s.y-n.y)+(s.z-n.z))/(2.0*l);
  if(x==0u) { dx=((e.y-c.y)+(e.z-c.z))/l; } else if(x==size-1u) { dx=((c.y-w.y)+(c.z-w.z))/l; }
  if(y==0u) { dy=((s.y-c.y)+(s.z-c.z))/l; } else if(y==size-1u) { dy=((c.y-n.y)+(c.z-n.z))/l; }
  let slope=dx*dx+dy*dy; var cap=0.0;
  if(a.x > ${DRY_DEPTH_M}) { cap=capacity*sqrt(slope/(1.0+slope))*length(a.yz); }
  var loose=material.x; var suspended=material.y; var rock=0.0; var picked=0.0;
  if(cap>suspended) { let demand=erode*(cap-suspended); let el=min(loose,demand); rock=(1.0-material.z)*(demand-el); loose-=el; picked=el+rock; suspended+=picked; }
  else if(suspended>cap) { let d=deposit*(suspended-cap); suspended-=d; loose+=d; picked=-d; }
  return vec4<f32>(-rock,loose,suspended,picked);
}`;
const transportCode = `fn sedimentFaces(q:vec4<f32>, eroded:vec4<f32>, rain:f32, water:f32, dt:f32, area:f32)->vec4<f32> {
  let m=eroded.z; let raw=q*(m/max(max(rain,water),${DRY_DEPTH_M})); let sum=raw.x+raw.y+raw.z+raw.w;
  var k=1.0; if(sum>0.0) { k=min(1.0,area*m/(dt*sum)); } return k*raw;
}`;
const gatherCode = `fn materialGather(stock:f32, q:vec4<f32>, w:vec4<f32>, e:vec4<f32>, n:vec4<f32>, s:vec4<f32>, i:u32, size:u32, factor:f32)->f32 {
  let x=i%size; let y=i/size; var incoming=0.0;
  if(x>0u) { incoming+=w.y; } if(x<size-1u) { incoming+=e.x; }
  if(y>0u) { incoming+=n.w; } if(y<size-1u) { incoming+=s.z; }
  if(stock<0.0) {return factor*(incoming-(q.x+q.y+q.z+q.w));}
  return max(0.0,stock-factor*(q.x+q.y+q.z+q.w))+factor*incoming;
}`;
const slumpCode = `fn slump(c:vec4<f32>, w:vec4<f32>, e:vec4<f32>, n:vec4<f32>, s:vec4<f32>, i:u32, size:u32, threshold:f32, rate:f32)->vec4<f32> {
  let x=i%size; let y=i/size; var q=vec4<f32>(0.0);
  if(x>0u) { q.x=max(0.0,(c.x-w.x)+(c.y-w.y)+(c.z-w.z)-threshold)*rate; }
  if(x<size-1u) { q.y=max(0.0,(c.x-e.x)+(c.y-e.y)+(c.z-e.z)-threshold)*rate; }
  if(y>0u) { q.z=max(0.0,(c.x-n.x)+(c.y-n.y)+(c.z-n.z)-threshold)*rate; }
  if(y<size-1u) { q.w=max(0.0,(c.x-s.x)+(c.y-s.y)+(c.z-s.z)-threshold)*rate; }
  let sum=q.x+q.y+q.z+q.w; if(sum>c.z) { q*=c.z/sum; } return q;
}`;
const addCode = `fn compensated(old:vec4<f32>, correction:vec4<f32>, value:vec4<f32>)->vec4<f32> { return old+(value-correction); }`;
type VectorStorage = ReturnType<typeof storage<"vec4">>;
const vector = (code: string) => {
  const fn = wgslFn(code);
  return (args: Record<string, Node | number>) => fn(args) as Node<"vec4">;
};

/** All state and ledger commits share the resident latched guard. */
export class FullProcess {
  readonly material: StorageBufferAttribute;
  private readonly counters: StorageBufferAttribute[];
  private readonly corrections: StorageBufferAttribute[];
  private readonly reductions: ComputeNode[] = [];
  private readonly reduced: StorageBufferAttribute[] = [];
  constructor(
    private readonly renderer: WebGPURenderer,
    readonly config: TerrainConfig,
    private readonly state: TerrainState,
    private readonly allocate: (data: Float32Array | number) => StorageBufferAttribute,
  ) {
    const cells = config.gridSize ** 2;
    const initial = new Float32Array(cells * 4);
    for (let i = 0; i < cells; i++)
      initial.set(
        [state.layers.sedimentM[i], state.layers.suspendedSedimentM[i], state.layers.hardness[i], 0],
        i * 4,
      );
    this.material = allocate(initial);
    this.counters = [allocate(cells), allocate(cells)];
    this.corrections = [allocate(cells), allocate(cells)];
    const buf = (a: StorageBufferAttribute) => storage(a, "vec4", a.count);
    for (const input of [...this.counters, this.material]) {
      const arrays = [input, allocate(cells), allocate(cells)];
      let from = 0,
        to = 1;
      for (let count = cells; count > 1; count = Math.ceil(count / 2)) {
        const source = buf(arrays[from]),
          dest = buf(arrays[to]);
        this.reductions.push(
          Fn(() => {
            const i = instanceIndex,
              first = i.mul(2),
              second = first.add(1);
            dest
              .element(i)
              .assign(
                source.element(first).add(second.lessThan(count).select(source.element(second), vec4(0))),
              );
          })().compute(Math.ceil(count / 2), [64]),
        );
        from = to;
        to = to === 1 ? 2 : 1;
      }
      this.reduced.push(arrays[from]);
    }
  }
  build(
    base: VectorStorage,
    changes: VectorStorage,
    rain: VectorStorage,
    water: VectorStorage,
    flux: VectorStorage,
    diagnostic: VectorStorage,
    status: VectorStorage,
  ): { before: ComputeNode[]; commit: ComputeNode[] } {
    const c = this.config,
      n = c.gridSize,
      cells = n * n,
      l = c.metresPerCell,
      dt = c.dtSimSeconds,
      area = l * l;
    const buf = (a: StorageBufferAttribute) => storage(a, "vec4", a.count),
      temp = () => buf(this.allocate(cells));
    const material = buf(this.material),
      eroded = temp(),
      faces = temp(),
      slumpFaces = temp(),
      geometry = temp(),
      transported = temp(),
      candidate = temp(),
      candidateChange = temp(),
      ledgerA = temp(),
      ledgerB = temp();
    const corrections = this.corrections.map(buf),
      counters = this.counters.map(buf);
    const erosion = vector(erodeCode),
      transport = vector(transportCode),
      gatherRaw = wgslFn(gatherCode),
      gather = (args: Record<string, Node | number>) => float(gatherRaw(args) as Node<"float">),
      slump = vector(slumpCode),
      add = vector(addCode);
    const neighbours = () => {
      const i = instanceIndex,
        x = i.mod(uint(n)),
        y = i.div(uint(n));
      return {
        i,
        w: x.greaterThan(0).select(i.sub(1), i),
        e: x.lessThan(n - 1).select(i.add(1), i),
        north: y.greaterThan(0).select(i.sub(n), i),
        south: y.lessThan(n - 1).select(i.add(n), i),
      };
    };
    const erodeKernel = Fn(() => {
      const { i, w, e, north, south } = neighbours();
      const r = vec4(
        erosion({
          c: rain.element(i),
          w: rain.element(w),
          e: rain.element(e),
          n: rain.element(north),
          s: rain.element(south),
          a: water.element(i),
          material: material.element(i),
          i,
          size: uint(n),
          l: float(l),
          capacity: float((c.capacityCoefficient * REFERENCE_CAPACITY_THICKNESS_M) / REFERENCE_SPEED_M_PER_S),
          erode: float(Math.min(1, c.erosionRatePerS * dt)),
          deposit: float(Math.min(1, c.depositionRatePerS * dt)),
        }),
      ).toVar();
      eroded.element(i).assign(r);
      geometry.element(i).assign(vec4(base.element(i).x, changes.element(i).x.add(r.x), r.y, 0));
    })().compute(cells, [64]);
    const faceKernel = Fn(() => {
      const i = instanceIndex;
      faces.element(i).assign(
        transport({
          q: flux.element(i),
          eroded: eroded.element(i),
          rain: rain.element(i).x,
          water: water.element(i).x,
          dt: float(dt),
          area: float(area),
        }),
      );
    })().compute(cells, [64]);
    const gatherKernel = Fn(() => {
      const { i, w, e, north, south } = neighbours();
      transported.element(i).assign(
        vec4(
          gather({
            stock: eroded.element(i).z,
            q: faces.element(i),
            w: faces.element(w),
            e: faces.element(e),
            n: faces.element(north),
            s: faces.element(south),
            i,
            size: uint(n),
            factor: float(dt / area),
          }),
          0,
          0,
          0,
        ),
      );
      slumpFaces.element(i).assign(
        slump({
          c: geometry.element(i),
          w: geometry.element(w),
          e: geometry.element(e),
          n: geometry.element(north),
          s: geometry.element(south),
          i,
          size: uint(n),
          threshold: float(l * Math.tan((c.talusAngleDeg * Math.PI) / 180)),
          rate: float(0.5 * c.thermalRatePerS * dt),
        }),
      );
    })().compute(cells, [64]);
    const outlet = stateOutlet(this.state.outlet, n);
    const ledgerKernel = Fn(() => {
      const i = instanceIndex,
        r = eroded.element(i),
        a = water.element(i),
        h = a.x.mul(1 - c.evaporationFractionPerStep),
        m = transported.element(i).x,
        dry = h.lessThanEqual(DRY_DEPTH_M);
      const sf = faces.element(i)[(["x", "y", "z", "w"] as const)[outlet.face]],
        isOutlet = i.equal(outlet.index);
      ledgerA
        .element(i)
        .assign(
          vec4(
            max(r.w, 0).mul(area),
            max(r.w.negate(), 0).add(dry.select(m, 0)).mul(area),
            isOutlet.select(sf.mul(dt), 0),
            a.x.sub(h).mul(area),
          ),
        );
    })().compute(cells, [64]);
    const waterLedgerKernel = Fn(() => {
      const i = instanceIndex,
        q = flux.element(i)[(["x", "y", "z", "w"] as const)[outlet.face]];
      ledgerB
        .element(i)
        .assign(
          vec4(
            float(dt * c.rainMmPerHr * MM_PER_HR_TO_M_PER_S * area),
            base.element(i).w.mul(dt * area),
            i.equal(outlet.index).select(q.mul(dt), 0),
            0,
          ),
        );
    })().compute(cells, [64]);
    const finalKernel = Fn(() => {
      const { i, w, e, north, south } = neighbours();
      const old = material.element(i),
        r = eroded.element(i),
        a = water.element(i).toVar();
      const loose = gather({
        stock: r.y,
        q: slumpFaces.element(i),
        w: slumpFaces.element(w),
        e: slumpFaces.element(e),
        n: slumpFaces.element(north),
        s: slumpFaces.element(south),
        i,
        size: uint(n),
        factor: float(1),
      }).toVar();
      const h = a.x.mul(1 - c.evaporationFractionPerStep).toVar(),
        m = transported.element(i).x.toVar(),
        dry = h.lessThanEqual(DRY_DEPTH_M);
      const slumpNet = gather({
        stock: float(-1),
        q: slumpFaces.element(i),
        w: slumpFaces.element(w),
        e: slumpFaces.element(e),
        n: slumpFaces.element(north),
        s: slumpFaces.element(south),
        i,
        size: uint(n),
        factor: float(1),
      });
      candidate
        .element(i)
        .assign(
          vec4(
            loose.add(dry.select(m, 0)),
            dry.select(0, m),
            old.z,
            slumpNet.sub(r.w).sub(r.x).add(dry.select(m, 0)),
          ),
        );
      a.x.assign(h);
      water.element(i).assign(a);
    })().compute(cells, [64]);
    const changeKernel = Fn(() => {
      const i = instanceIndex,
        r = eroded.element(i),
        delta = r.x.sub(changes.element(i).y).toVar(),
        next = changes.element(i).x.add(delta).toVar();
      const looseDelta = candidate.element(i).w.sub(changes.element(i).w).toVar(),
        looseNext = changes.element(i).z.add(looseDelta).toVar();
      candidateChange
        .element(i)
        .assign(
          vec4(
            next,
            next.sub(changes.element(i).x).sub(delta),
            looseNext,
            looseNext.sub(changes.element(i).z).sub(looseDelta),
          ),
        );
    })().compute(cells, [64]);
    const materialKernel = Fn(() => {
      const i = instanceIndex;
      const change = candidateChange.element(i),
        clamped = change.z.lessThan(base.element(i).y.negate());
      change.w.assign(clamped.select(0, change.w));
      change.z.assign(max(change.z, base.element(i).y.negate()));
      candidate.element(i).x.assign(base.element(i).y.add(change.z));
      candidate.element(i).w.assign(0);
    })().compute(cells, [64]);
    const diagnosticKernel = Fn(() => {
      const i = instanceIndex;
      const invalid = candidate
        .element(i)
        .x.lessThan(0)
        .or(candidate.element(i).y.lessThan(0))
        .or(candidate.element(i).abs().lessThan(vec4(3.4e38)).all().not())
        .or(candidateChange.element(i).abs().lessThan(vec4(3.4e38)).all().not());
      diagnostic.element(i).assign(max(diagnostic.element(i), vec4(0, 0, invalid.select(1, 0), 0)));
    })().compute(cells, [64]);
    const commit = Fn(() => {
      const i = instanceIndex,
        accepted = status.element(0).y.equal(0);
      material.element(i).assign(accepted.select(candidate.element(i), material.element(i)));
      changes.element(i).assign(accepted.select(candidateChange.element(i), changes.element(i)));
    })().compute(cells, [64]);
    const ledgerCommits = [0, 1].map((j) =>
      Fn(() => {
        const i = instanceIndex,
          accepted = status.element(0).y.equal(0),
          value = (j === 0 ? ledgerA : ledgerB).element(i),
          old = counters[j].element(i).toVar(),
          correction = corrections[j].element(i),
          sum = vec4(add({ old, correction, value })).toVar();
        correction.assign(accepted.select(sum.sub(old).sub(value.sub(correction)), correction));
        counters[j].element(i).assign(accepted.select(sum, old));
      })().compute(cells, [64]),
    );
    return {
      before: [
        erodeKernel,
        faceKernel,
        gatherKernel,
        ledgerKernel,
        waterLedgerKernel,
        finalKernel,
        changeKernel,
        materialKernel,
        diagnosticKernel,
      ],
      commit: [commit, ...ledgerCommits],
    };
  }
  async snapshot(): Promise<{ material: Float32Array; totals: Float32Array[] }> {
    this.renderer.compute(this.reductions);
    const arrays = await Promise.all([
      this.renderer.getArrayBufferAsync(this.material),
      ...this.reduced.map((a) => this.renderer.getArrayBufferAsync(a, null, 0, 16)),
    ]);
    return { material: new Float32Array(arrays[0]), totals: arrays.slice(1).map((a) => new Float32Array(a)) };
  }
  dispose() {
    for (const k of this.reductions) k.dispose();
  }
}
function stateOutlet(outlet: { x: number; y: number }, n: number) {
  return {
    index: outlet.y * n + outlet.x,
    face: outlet.y === n - 1 ? 3 : outlet.x === n - 1 ? 1 : outlet.y === 0 ? 2 : 0,
  };
}
