/** <!-- expert-review --> Adapted from docs/science/ignores.md; sources.md resolves citation keys. */
import type { PageSpec } from "@hachure/runtime";

export const ignores = {
  hs: [
    "This process model explores mechanisms. It does not predict a particular real valley. (Model)",
    "All rainfall reaches surface flow. Soil infiltration, groundwater, plants, snow and gaps between storms are omitted. (Model; R)",
    "Hardness means resistance to erosion in this experiment, not measured rock hardness. Loose sediment can move over hard rock. (Model; S08)",
    "The surface has a single height at each map position. It cannot show overhangs or a falling waterfall jet; a steep bed section is only a proxy. (Model; SW)",
    "Clock status: {{scene.timeScale}}. Landscape time requires approved calibration. A model storm does not mean continuous rainfall throughout geological time. (Calibration)",
    "Loose sediment can move down steep slopes. Detailed rockfalls, glaciers, waves, tectonic uplift and changing sea level are omitted. (Model)",
  ],
  uni: [
    "Virtual-pipe flow approximates depth-averaged motion. Turbulence, vertical velocity, free-falling jets and hydraulic jumps are unresolved; grid scale limits channel geometry. (Model; SW)",
    "Capacity uses speed and slope with experimental reference scales. Grain sorting, cohesive entrainment, explicit bedload, density differences, porosity and detailed armouring are omitted. (Model)",
    "The stream-power relation is comparative theory. Its K is not the live erosion relaxation rate, and this is not a numerical Hjulström diagram. (Model; W99)",
    "First-order conservative transport introduces numerical diffusion. Slumping redistributes loose sediment; it does not fracture bedrock or solve soil-mechanical failure. Drying and its threshold are numerical choices. (Model; FV)",
    "Boundaries are closed except at the prescribed outlet. Base level is fixed; no tides or downstream feedback are represented. Rainfall, source and starting terrain are idealised. (Model)",
    "Clock status: {{scene.timeScale}}. Calibration needs an approved field analogy; catchment denudation is not local channel incision. Rates remain indicative when controls change. (Calibration)",
    "Raise and dig add or remove material externally and belong in the solid budget. Repeated edits can create artificial cliffs and pits despite per-operation clamps. (Parameters; Model)",
  ],
} as const satisfies PageSpec["ignores"];
