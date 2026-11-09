/** <!-- expert-review --> Definitions follow Model, Validation and W99 in sources.md. */
import type { KeyWord } from "@hachure/runtime";

export const keyWords = [
  {
    term: { hs: "Erosion", uni: "Erosion" },
    definition: {
      hs: "Removal of material from the ground into transport. (Model)",
      uni: "A transfer from bedrock or loose cover into the mobile sediment stock. (Model)",
    },
  },
  {
    term: { hs: "Deposition", uni: "Deposition" },
    definition: {
      hs: "Material leaving transport and accumulating on the ground. (Model)",
      uni: "A transfer from suspended sediment to the loose surface layer. (Model)",
    },
  },
  {
    term: { hs: "Incision", uni: "Fixed-section incision" },
    definition: {
      hs: "Lowering of the valley floor compared with its starting height at the same measured sections. (Validation)",
      uni: "Initial minus current minimum ground elevation within a fixed strip of a cross-section; negative values retain aggradation. (Validation)",
    },
  },
  {
    term: { hs: "Sediment", uni: "Sediment stock" },
    definition: {
      hs: "Loose material that can be carried and deposited. (Model)",
      uni: "Mobile or deposited material tracked as solid-volume equivalent, without porosity or density changes. (Model)",
    },
  },
  {
    term: { hs: "Knickpoint", uni: "Knickpoint proxy" },
    definition: {
      hs: "A locally steep section of the river bed; it is not proof of falling water. (Validation)",
      uni: "A resolved local slope break tested against its background slope; the challenge also requires persistence and a complete path. (Validation)",
    },
  },
] as const satisfies readonly KeyWord[];
