/**
 * <!-- expert-review -->
 * Structured sources of "Where plates meet". Citation keys in the deeper level and the teacher notes resolve
 * here. What session 7A actually read of each (full text, abstract only, or a standard relation) and the
 * limits of use are in sources.md and in 7A's register (docs/science/plates/sources.md). Years, volumes and
 * pages in a citation are bibliography metadata, not values of the illustration.
 */
import type { Source } from "@hachure/runtime";

const REPO = "https://github.com/JohnnnyTang/uplift/blob/main/";

export const sourceKeys = [
  "Params",
  "Claims",
  "Lesson",
  "TDE-U",
  "TDE-H",
  "TDE-I",
  "CM95",
  "Nab09",
  "Kel94",
  "Cho05",
  "SJ84",
  "Sar14",
  "Owe09",
  "Fia",
  "TS14",
] as const;
export type SourceKey = (typeof sourceKeys)[number];

/** Uplift's own records: what the illustration draws and why. Never the source of a real-world fact. */
export const INTERNAL_SOURCES: readonly SourceKey[] = ["Params", "Claims", "Lesson"];

export const sources = [
  {
    citation:
      "Params — Uplift parameter table for the plate-boundary illustration: every shape value cited or labelled an artistic choice (session 7A)",
    url: `${REPO}docs/science/plates/parameters.md`,
  },
  {
    citation:
      "Claims — Uplift claim register for Where plates meet: what the copy may and may not say (session 7A)",
    url: `${REPO}docs/science/plates/claims.md`,
  },
  {
    citation:
      "Lesson — Uplift lesson claim/source register for Where plates meet: every sentence to a claim and a source (session 7E)",
    url: `${REPO}docs/science/plates/lesson/README.md`,
  },
  {
    citation:
      "TDE-U — Kious, W. J. & Tilling, R. I. (1996). This Dynamic Earth: The Story of Plate Tectonics. U.S. Geological Survey, online edition, “Understanding plate motions”.",
    url: "https://pubs.usgs.gov/gip/dynamic/understanding.html",
  },
  {
    citation:
      "TDE-H — Kious, W. J. & Tilling, R. I. (1996). This Dynamic Earth, “The Himalayas: Two continents collide”. U.S. Geological Survey.",
    url: "https://pubs.usgs.gov/gip/dynamic/himalaya.html",
  },
  {
    citation:
      "TDE-I — Kious, W. J. & Tilling, R. I. (1996). This Dynamic Earth, “Inside the Earth”. U.S. Geological Survey.",
    url: "https://pubs.usgs.gov/gip/dynamic/inside.html",
  },
  {
    citation:
      "CM95 — Christensen, N. I. & Mooney, W. D. (1995). Seismic velocity structure and composition of the continental crust: A global view. Journal of Geophysical Research 100(B6), 9761–9788.",
    url: "https://doi.org/10.1029/95JB00259",
    doi: "10.1029/95JB00259",
  },
  {
    citation:
      "Nab09 — Nábělek, J., Hetényi, G., Vergne, J., Sapkota, S., Kafle, B., Jiang, M., Su, H., Chen, J., Huang, B.-S. & the Hi-CLIMB Team (2009). Underplating in the Himalaya-Tibet collision zone revealed by the Hi-CLIMB experiment. Science 325(5946), 1371.",
    url: "https://doi.org/10.1126/science.1167719",
    doi: "10.1126/science.1167719",
  },
  {
    citation:
      "Kel94 — Keller, G. R., Prodehl, C., Mechie, J., Fuchs, K., Khan, M. A., Maguire, P. K. H., Mooney, W. D., Achauer, U., Davis, P. M., Meyer, R. P., Braile, L. W., Nyambok, I. O. & Thompson, G. A. (1994). The East African rift system in the light of KRISP 90. Tectonophysics 236, 465–483.",
  },
  {
    citation:
      "Cho05 — Chorowicz, J. (2005). The East African rift system. Journal of African Earth Sciences 43, 379–410.",
    url: "https://doi.org/10.1016/j.jafrearsci.2005.07.019",
    doi: "10.1016/j.jafrearsci.2005.07.019",
  },
  {
    citation:
      "SJ84 — Sieh, K. E. & Jahns, R. H. (1984). Holocene activity of the San Andreas fault at Wallace Creek, California. GSA Bulletin 95, 883–896.",
  },
  {
    citation:
      "Sar14 — Saria, E., Calais, E., Stamps, D. S., Delvaux, D. & Hartnady, C. J. H. (2014). Present-day kinematics of the East African Rift. Journal of Geophysical Research: Solid Earth 119, 3584–3600.",
    url: "https://doi.org/10.1002/2013JB010901",
    doi: "10.1002/2013JB010901",
  },
  {
    citation:
      "Owe09 — Owen, L. A., Robinson, R., Benn, D. I., Finkel, R. C., Davis, N. K., Yi, C., Putkonen, J., Li, D. & Murray, A. S. (2009). Quaternary glaciation of Mount Everest. Quaternary Science Reviews 28.",
    url: "https://doi.org/10.1016/j.quascirev.2009.02.010",
    doi: "10.1016/j.quascirev.2009.02.010",
  },
  {
    citation:
      "Fia — Fialko, Y. Lecture 2, “Gravity and isostasy”. SIO tectonics course notes, University of California San Diego.",
    url: "https://igppweb.ucsd.edu/~fialko/tectonics/Lecture2GravityIsostasy.pdf",
  },
  {
    citation:
      "TS14 — Turcotte, D. L. & Schubert, G. (2014). Geodynamics, 3rd edition, chapter 2 (isostasy). Cambridge University Press.",
  },
] as const satisfies readonly Source[];
