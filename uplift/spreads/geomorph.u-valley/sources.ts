/**
 * <!-- expert-review -->
 * Structured sources of "From V to U". Citation keys in the deeper-level prose and teacher notes resolve
 * here; scope, verification status and limits of use are in sources.md and in the lesson's claim/source
 * register (docs/science/glacial/lesson/README.md). Years, volumes and pages are bibliography metadata,
 * not model values.
 */
import type { Source } from "@hachure/runtime";

const REPO = "https://github.com/JohnnnyTang/uplift/blob/main/";

export const sourceKeys = [
  "Model",
  "Protocol",
  "Results",
  "Rocks",
  "Lesson",
  "HHR88",
  "Har92",
  "Hal79",
  "Her15",
  "Sed09",
  "Nye65",
  "CP10",
  "Wee57",
  "Oer01",
  "Sve59",
  "Sel80",
  "Aug92",
  "BE10",
  "CS12",
] as const;
export type SourceKey = (typeof sourceKeys)[number];

export const sources = [
  {
    citation: "Model — Uplift glacier model note: equations, units, parameters, omissions (session 5G/5G2)",
    url: `${REPO}docs/science/glacial/model.md`,
  },
  {
    citation:
      "Protocol — Uplift registered acceptance protocol for From V to U (claims, arms, sections, criteria)",
    url: `${REPO}docs/science/glacial/acceptance-protocol.md`,
  },
  {
    citation: "Results — Uplift feasibility record and registered results, every failed attempt kept",
    url: `${REPO}docs/science/glacial/feasibility.md`,
  },
  {
    citation: "Rocks — Uplift rock types: ordering sourced, numbers are teaching choices",
    url: `${REPO}docs/science/glacial/rock-types.md`,
  },
  {
    citation: "Lesson — Uplift lesson claim/source register and fuller limits for From V to U",
    url: `${REPO}docs/science/glacial/lesson/README.md`,
  },
  {
    citation:
      "HHR88 — Harbor, J. M., Hallet, B. & Raymond, C. F. (1988). A numerical model of landform development by glacial erosion. Nature 333, 347–349.",
    url: "https://doi.org/10.1038/333347a0",
  },
  {
    citation:
      "Har92 — Harbor, J. M. (1992). Numerical modeling of the development of U-shaped valleys by glacial erosion. GSA Bulletin 104(10), 1364–1375.",
  },
  {
    citation:
      "Hal79 — Hallet, B. (1979). A theoretical model of glacial abrasion. Journal of Glaciology 23(89), 39–50.",
  },
  {
    citation: "Her15 — Herman, F. et al. (2015). Erosion by an Alpine glacier. Science 350(6257), 193–195.",
  },
  {
    citation:
      "Sed09 — Seddik, H., Greve, R., Sugiyama, S. & Naruse, R. (2009). Numerical simulation of the evolution of glacial valley cross sections. arXiv:0901.1177.",
    url: "https://doi.org/10.48550/arXiv.0901.1177",
  },
  {
    citation:
      "Nye65 — Nye, J. F. (1965). The flow of a glacier in a channel of rectangular, elliptic or parabolic cross-section. Journal of Glaciology 5(41), 661–690.",
  },
  {
    citation:
      "CP10 — Cuffey, K. M. & Paterson, W. S. B. (2010). The Physics of Glaciers, 4th edition. Academic Press.",
  },
  {
    citation: "Wee57 — Weertman, J. (1957). On the sliding of glaciers. Journal of Glaciology 3(21), 33–38.",
  },
  { citation: "Oer01 — Oerlemans, J. (2001). Glaciers and Climate Change. Balkema." },
  {
    citation:
      "Sve59 — Svensson, H. (1959). Is the cross-section of a glacial valley a parabola? Journal of Glaciology 3(25), 362–363.",
  },
  {
    citation:
      "Sel80 — Selby, M. J. (1980). A rock mass strength classification for geomorphic purposes. Zeitschrift für Geomorphologie 24, 31–51.",
  },
  {
    citation:
      "Aug92 — Augustinus, P. C. (1992). The influence of rock mass strength on glacial valley cross-profile morphometry: a case study from the Southern Alps, New Zealand. Earth Surface Processes and Landforms 17, 39–51.",
  },
  {
    citation: "BE10 — Benn, D. I. & Evans, D. J. A. (2010). Glaciers and Glaciation, 2nd edition. Hodder.",
  },
  {
    citation:
      "CS12 — Cook, S. J. & Swift, D. A. (2012). Subglacial basins: their origin and importance in glacial systems and landscapes. Earth-Science Reviews 115(4), 332–372.",
    url: "https://doi.org/10.1016/j.earscirev.2012.09.009",
    doi: "10.1016/j.earscirev.2012.09.009",
  },
] as const satisfies readonly Source[];
