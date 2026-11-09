import type { BindingEngine } from "../bindings/index";
import { terrainSceneBindings } from "../bindings/terrain-scene";
import type { SceneSpec } from "../schema/index";
import type { HostSample } from "./protocol";
/** All fields come from a single completed host sample; unavailable metrics replace old values. */
export function publishTerrainSample(
  bindings: BindingEngine,
  sample: HostSample,
  scene: SceneSpec,
  speed: number,
  paused: boolean,
): void {
  bindings.update({
    probe: {
      incisionDepth: sample.probes.incisionDepth ?? "Unavailable: unresolved sections",
      sedimentOut: sample.probes.sedimentOut,
    },
    control: { rain: sample.config.rainMmPerHr, speed },
    scene: terrainSceneBindings({
      config: sample.config,
      scene,
      stepCount: sample.snapshot.step,
      speed,
      paused,
      ...(sample.calibration.status === "approved" ? { calibration: sample.calibration } : {}),
    }),
  });
}
