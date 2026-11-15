/**
 * <!-- expert-review -->
 * Claim/source register of "Where plates meet" (machine-readable). The draft wording and IDs are session 7A's
 * (docs/science/plates/claims.md: PC1–PC20, NT1–NT7); 7E shortened wording where the copy is shorter, never
 * strengthened it, and added the illustration's own disclosure statements (PD1–PD8) and two university
 * limits (PC21, PC22). The human-readable register, every reader sentence to a claim and a source, is
 * docs/science/plates/lesson/README.md.
 *
 * Every paragraph of reader markdown names its claims in a `<!-- claims: … | sources: … -->` comment, and
 * every text group in lesson.ts names its claims in `textClaims`; lesson.test.ts checks both against this
 * register.
 *
 * Status: `taught` (on the page or the deeper level as a fact about the real Earth), `explained` (deeper
 * level or teacher notes only), `display` (a statement about the illustration itself: what it draws, how it
 * is scaled, what it leaves out), `not-taught` (the copy must never make it).
 */
import type { SourceKey } from "./sources";

export type ClaimStatus = "taught" | "explained" | "display" | "not-taught";

export interface Claim {
  readonly id: string;
  readonly status: ClaimStatus;
  /** Reading level in 7A's register: S = school (default level), U = university. */
  readonly level: "S" | "U" | "—";
  readonly statement: string;
  readonly sources: readonly SourceKey[];
  /** Limits of the claim, or why it must not be made. */
  readonly limits: string;
}

export const claims: readonly Claim[] = [
  {
    id: "PC1",
    status: "taught",
    level: "S",
    statement: "Earth's outer shell (the lithosphere) is broken into large plates that move slowly.",
    sources: ["TDE-U"],
    limits: "Background.",
  },
  {
    id: "PC2",
    status: "taught",
    level: "S",
    statement:
      "Where two plates meet is a plate boundary. Plates move apart at a divergent boundary, towards each other at a convergent boundary, and past each other at a transform boundary.",
    sources: ["TDE-U"],
    limits: "Key words: plate, plate boundary, convergent, divergent, transform, crust.",
  },
  {
    id: "PC3",
    status: "taught",
    level: "S",
    statement:
      "When two continents collide, neither sinks, because continental rock is light; the crust crumples (buckles) and is pushed up into mountains, such as the Himalayas and the Tibetan Plateau.",
    sources: ["TDE-U"],
    limits: "Continental collision only; no subduction.",
  },
  {
    id: "PC4",
    status: "explained",
    level: "S",
    statement: "Mount Everest, in the Himalayas, rises about 8,850 m above sea level.",
    sources: ["TDE-U"],
    limits:
      "TDE-U states 8,854 m; a newer survey value was not verified. Deeper level and teacher notes only (D-W7-7E): never beside the figure, where it could read as the drawn range's height.",
  },
  {
    id: "PC5",
    status: "explained",
    level: "S",
    statement: "The Tibetan Plateau, behind the Himalayas, averages about 4,600 m above sea level.",
    sources: ["TDE-U"],
    limits: "Deeper level and teacher notes only (D-W7-7E).",
  },
  {
    id: "PC6",
    status: "taught",
    level: "S",
    statement:
      "Mountain ranges have deep roots: under a high range the crust is much thicker than elsewhere.",
    sources: ["Nab09", "TS14"],
    limits:
      'The front face shows this. Say "the drawing shows the crust thicker under the range", never that it thickens in the scene.',
  },
  {
    id: "PC7",
    status: "taught",
    level: "U",
    statement:
      "Beneath southern Tibet the base of the crust (the Moho) lies about 70 km below sea level, against about 40 km beneath the Ganges plain to the south.",
    sources: ["Nab09"],
    limits: "Moho depths below sea level; the crust's thickness adds the topography (about 70–75 km).",
  },
  {
    id: "PC8",
    status: "taught",
    level: "U",
    statement:
      "Continental crust is usually 30–40 km thick; seismic surveys give an average of about 41 km, about 30 km where the crust has been stretched and about 46 km under mountain belts.",
    sources: ["TDE-I", "CM95"],
    limits: "TDE-I says about 30 km; CM95 (abstract read) 41.1 km area-weighted; the range covers both.",
  },
  {
    id: "PC9",
    status: "taught",
    level: "U",
    statement:
      "Thick, light crust floats higher on the denser mantle, a little like an iceberg in water (isostasy). For typical densities the root reaches about 5.6 times as deep as the mountains stand high.",
    sources: ["TS14", "Fia"],
    limits:
      "The ratio and densities are bound from the illustration's config, never typed. The drawing applies the root directly under the range; real support is spread more widely by the plate's bending strength.",
  },
  {
    id: "PC10",
    status: "taught",
    level: "S",
    statement:
      "Where a continent is stretched, the crust cracks along faults and blocks of land drop down between them, making a rift valley.",
    sources: ["TDE-U", "Cho05"],
    limits: "Magma and volcanoes are left out (out of scope), although TDE-U mentions them.",
  },
  {
    id: "PC11",
    status: "taught",
    level: "S",
    statement:
      "The East African Rift is a divergent boundary about 5,000 km long. Its rift valleys are typically about 50–70 km wide.",
    sources: ["Sar14", "Cho05", "Kel94"],
    limits:
      "On the page only as the named example; the figures are in the deeper level and teacher notes (D-W7-7E).",
  },
  {
    id: "PC12",
    status: "taught",
    level: "U",
    statement:
      "Rift valleys are bounded by steep normal faults, often a large border fault with smaller faults and tilted blocks, and many are lopsided half-grabens; the shoulders stand roughly 0.5–2 km above the floor.",
    sources: ["Cho05"],
    limits: "The drawing's steps are symmetric; the copy says so wherever the steps are mentioned (NT7).",
  },
  {
    id: "PC13",
    status: "taught",
    level: "U",
    statement:
      "Beneath the Kenya Rift the crust thins from about 35 km in the south to about 20 km beneath Lake Turkana, and the thinning lies beneath the rift valley itself.",
    sources: ["Kel94"],
    limits: "",
  },
  {
    id: "PC14",
    status: "taught",
    level: "S",
    statement:
      "At a transform boundary the plates slide past each other; crust is neither made nor destroyed, so the land is not raised or lowered, only moved sideways.",
    sources: ["TDE-U"],
    limits:
      '"Not raised or lowered" simplifies TDE-U; real transforms have local bends with some uplift or sinking. Expert to confirm wording.',
  },
  {
    id: "PC15",
    status: "taught",
    level: "S",
    statement:
      "The San Andreas Fault in California is a transform boundary about 1,300 km long, in places tens of kilometres wide. The Pacific Plate moves north-west past the North American Plate at about 5 cm a year on average.",
    sources: ["TDE-U"],
    limits:
      "The plate speed carries a year: deeper level only, in the real-time-scales paragraph, never near the stage scrubber and never per stage (D-W7-7E).",
  },
  {
    id: "PC16",
    status: "taught",
    level: "S",
    statement:
      "Streams that cross the San Andreas are bent sideways where they cross it. At Wallace Creek the stream channel is offset by about 130 m.",
    sources: ["SJ84"],
    limits: "SJ84: 128 m. The drawing's offset is not to scale with it (parameter row 34).",
  },
  {
    id: "PC17",
    status: "taught",
    level: "U",
    statement:
      "The San Andreas is right-lateral: looking across it, the far side has moved to the right. In all, the two sides have moved about 300 km past each other.",
    sources: ["SJ84", "TDE-U"],
    limits: "",
  },
  {
    id: "PC18",
    status: "explained",
    level: "U",
    statement:
      "The Wallace Creek offset built up at about 34 mm a year, over thousands of years, in jumps during great earthquakes.",
    sources: ["SJ84"],
    limits:
      "A year-bearing fact (owner/7E decision, D-W7-7E): deeper level only, in one paragraph framed as real time scales not shown in the drawing; the earthquake clause is left out (NT6). SJ84: 33.9 ± 2.9 mm/yr over 3,700 yr.",
  },
  {
    id: "PC19",
    status: "explained",
    level: "U",
    statement:
      "India collided with Asia about 40–50 million years ago, and most of the uplift of the Himalayas and Tibet came in the last 10 million years.",
    sources: ["TDE-H", "TDE-U"],
    limits: "A year-bearing fact: same restriction as PC18 (D-W7-7E).",
  },
  {
    id: "PC20",
    status: "display",
    level: "S",
    statement:
      "The drawing is not to scale: heights and rock layers are stretched by the bound vertical exaggeration; crust depths are drawn at the bound crust scale, one factor for every crust depth.",
    sources: ["Params"],
    limits: "Both factors bound to the illustration's config (parameter rows 2 and 3), never typed.",
  },
  {
    id: "PC21",
    status: "explained",
    level: "U",
    statement:
      "Beneath real rifts, hot, low-density mantle also matters: the upper mantle under the Kenya Rift has very low seismic velocities.",
    sources: ["Kel94"],
    limits: "From 7A's draft university limits; the drawing does not show the mantle's temperature.",
  },
  {
    id: "PC22",
    status: "explained",
    level: "U",
    statement:
      "Real mountain ranges are held up partly by the bending strength of the plate, which spreads their support (and root) more widely than directly beneath the range.",
    sources: ["TS14"],
    limits: "From 7A's draft university limits; TS14 not re-read this session (standard relation).",
  },
  // ---- The illustration's own statements (display) --------------------------------------------------------
  {
    id: "PD1",
    status: "display",
    level: "S",
    statement:
      "The scene is an illustration: its shapes are authored, drawn from real examples (the Himalaya and Tibet, the East African Rift, the San Andreas at Wallace Creek). They do not form in the scene.",
    sources: ["Params", "Claims"],
    limits: "D-L2-1 decision 2. The one label line on the page says it; the disclosure says it in full.",
  },
  {
    id: "PD2",
    status: "display",
    level: "S",
    statement: "The stage goes from early to late: an ordering of shapes, not a clock. It shows no years.",
    sources: ["Params"],
    limits: "Parameter row 5; D-L2-1 decision 8.",
  },
  {
    id: "PD3",
    status: "display",
    level: "S",
    statement:
      "Continental settings only: volcanoes and magma, earthquakes, oceans and one plate sinking under another (subduction) are left out on purpose.",
    sources: ["Claims", "TDE-U"],
    limits: "D-L2-1 decision 3; 7A's NT6. Plates also meet beneath the oceans (TDE-U).",
  },
  {
    id: "PD4",
    status: "display",
    level: "S",
    statement:
      "No erosion: in the illustration the land is only raised, lowered or moved sideways. Real ranges are cut by rivers and glaciers, and real rifts fill with sediment and lakes.",
    sources: ["Params", "Kel94"],
    limits: "D-L2-1 decision 5. Kel94: rift infill 3–5 km in Kenya (context only).",
  },
  {
    id: "PD5",
    status: "display",
    level: "S",
    statement: "The rock layers are generic, in natural colours: not a map of real rocks.",
    sources: ["Params"],
    limits: "Parameter row 14.",
  },
  {
    id: "PD6",
    status: "display",
    level: "S",
    statement:
      "The shapes are simplified: the range is much narrower than the Himalaya, the sideways offset is much larger than Wallace Creek's and much smaller than the fault's total, the rift's steps are symmetric, and the boundary is one line where real boundaries are zones of many faults.",
    sources: ["Params", "Cho05", "TDE-U", "SJ84"],
    limits:
      "Parameter rows 20, 27, 34, 36 (ARTISTIC CHOICE). The starting ridges' height is also artistic (D-W7-7R).",
  },
  {
    id: "PD7",
    status: "display",
    level: "S",
    statement:
      "Every boundary starts from the same starting landscape; choosing a boundary goes back to it, and the landform's shape is shown from early to late.",
    sources: ["Params"],
    limits: "Stage 0 is identical for all three boundaries (7C's relief tests).",
  },
  {
    id: "PD8",
    status: "display",
    level: "S",
    statement:
      "Boundaries already viewed appear as labelled ghost outlines on the front face at the same stage, for comparison.",
    sources: ["Params"],
    limits: "D-L2-1 decision 8. View only.",
  },
  // ---- Not taught: the copy must never make these ---------------------------------------------------------
  {
    id: "NT1",
    status: "not-taught",
    level: "—",
    statement: "The mountains (rift, offset) form, grow, are simulated or are calculated in the scene.",
    sources: ["Claims"],
    limits: "Never, at any level (D-L2-1).",
  },
  {
    id: "NT2",
    status: "not-taught",
    level: "—",
    statement: "Any opening rate for the East African Rift or convergence rate for India and Asia.",
    sources: ["Claims", "Sar14"],
    limits: "Not verified (Sar14 not read for rates).",
  },
  {
    id: "NT3",
    status: "not-taught",
    level: "—",
    statement: "The Himalayas are rising by a stated amount each year.",
    sources: ["Claims", "TDE-H"],
    limits: "A rising rate invites reading the stage scrubber as time.",
  },
  {
    id: "NT4",
    status: "not-taught",
    level: "—",
    statement: "Under large ranges the crust can be a hundred kilometres thick.",
    sources: ["Claims", "TDE-I"],
    limits: "Superseded by Nab09's values for Tibet.",
  },
  {
    id: "NT5",
    status: "not-taught",
    level: "—",
    statement:
      "Any size of the drawing stated as a fact (the drawn range's width, the drawn offset, the drawn root).",
    sources: ["Claims", "Params"],
    limits: "Scene values are artistic or relations; only real-world values are cited.",
  },
  {
    id: "NT6",
    status: "not-taught",
    level: "—",
    statement: "Volcanoes, magma, earthquakes as events, ocean ridges, trenches, subduction.",
    sources: ["Claims"],
    limits: "Out of scope (D-L2-1 decision 3); named only as left out.",
  },
  {
    id: "NT7",
    status: "not-taught",
    level: "—",
    statement: "Rifts or ranges are symmetric.",
    sources: ["Claims", "Cho05"],
    limits: "The drawing simplifies; see PC12.",
  },
];

/**
 * Cited-figure register: the only typed numbers the lesson allows, each a real-world value from a claim's
 * statement. They appear only in the deeper level and the teacher notes (never in a schema-validated page
 * field), and a paragraph may type one only if its annotation names one of the figure's claims.
 */
export const citedFigures: readonly { readonly figure: string; readonly claims: readonly string[] }[] = [
  { figure: "8,850", claims: ["PC4"] },
  { figure: "4,600", claims: ["PC5"] },
  { figure: "70", claims: ["PC7", "PC11"] },
  { figure: "40", claims: ["PC7", "PC8", "PC19"] },
  { figure: "30", claims: ["PC8"] },
  { figure: "41", claims: ["PC8"] },
  { figure: "46", claims: ["PC8"] },
  { figure: "5,000", claims: ["PC11"] },
  { figure: "50", claims: ["PC11", "PC19"] },
  { figure: "0.5", claims: ["PC12"] },
  { figure: "2", claims: ["PC12"] },
  { figure: "35", claims: ["PC13"] },
  { figure: "20", claims: ["PC13"] },
  { figure: "1,300", claims: ["PC15"] },
  { figure: "5", claims: ["PC15"] },
  { figure: "130", claims: ["PC16"] },
  { figure: "300", claims: ["PC17"] },
  { figure: "34", claims: ["PC18"] },
  { figure: "10", claims: ["PC19"] },
];

/** Claims that carry years or rates: only in the deeper level's real-time-scales paragraph (D-W7-7E). */
export const YEAR_CLAIMS: readonly string[] = ["PC15", "PC18", "PC19"];
