/**
 * <!-- expert-review -->
 * Claim/source register of "From V to U" (machine-readable; the human-readable register with full
 * discussion is docs/science/glacial/lesson/README.md). Every paragraph of reader text names its claims in a
 * `<!-- claims: … | sources: … -->` comment; the tests check that each named claim is registered here, that
 * each taught claim has literature and model evidence, and that every registered verdict it relies on
 * passed in the registered run (docs/review/glacial/model/summary.json).
 *
 * Status: `taught` (on the page), `explained` (deeper level, teacher notes or a conditional note),
 * `not-taught` (registered as unsupported; text must not make it), `display` (a view choice, not a claim).
 */
import type { SourceKey } from "./sources";

export type ClaimStatus = "taught" | "explained" | "not-taught" | "display";

export type Evidence =
  /** A registered verdict that passed (id as in summary.json). */
  | { readonly kind: "verdict"; readonly id: string }
  /**
   * A component of registered verdicts that holds although the verdicts fail overall (`pattern` matches
   * their ids); `holds` names the registered component, checked against each verdict's detail.
   */
  | { readonly kind: "component"; readonly pattern: string; readonly holds: "b-rise" | "floor-unchanged" }
  /** A guard in the code or in this spread's tests (path relative to the repository root). */
  | { readonly kind: "test"; readonly path: string }
  /** A documented model property or record (path and section). */
  | { readonly kind: "record"; readonly path: string };

export interface Claim {
  readonly id: string;
  readonly status: ClaimStatus;
  readonly statement: string;
  readonly sources: readonly SourceKey[];
  readonly evidence: readonly Evidence[];
  /** Limits of the claim: where it does not hold, or what it does not say. */
  readonly limits: string;
}

const SUMMARY = "docs/review/glacial/model/summary.json";
const LESSON_TEST = "uplift/spreads/geomorph.u-valley/lesson.test.ts";

export const claims: readonly Claim[] = [
  {
    id: "C1",
    status: "taught",
    statement: "A river cuts a narrow valley shaped like a V.",
    sources: ["BE10"],
    evidence: [{ kind: "record", path: "docs/science/glacial/model.md §1 (authored starting V-valley)" }],
    limits: "Background, not a model result: the starting V is authored, identical for every run.",
  },
  {
    id: "C2",
    status: "taught",
    statement: "Sliding ice wears the rock away; erosion grows with sliding speed.",
    sources: ["Hal79", "Her15", "Model"],
    evidence: [
      { kind: "verdict", id: "K1-no-ice" },
      { kind: "verdict", id: "K2-no-erosion" },
      { kind: "record", path: "docs/science/glacial/model.md §4" },
    ],
    limits: "Abrasion and quarrying are lumped into one law; the exponent is a field estimate (Her15).",
  },
  {
    id: "C3",
    status: "taught",
    statement:
      "Under the ice the floor is lowered and the lower walls are cut back: the cross-section changes from a V towards a U, by shape.",
    sources: ["HHR88", "Har92", "Sed09", "Results"],
    evidence: [
      { kind: "component", pattern: "^E-T1-", holds: "b-rise" },
      { kind: "verdict", id: "R4-deeper" },
      { kind: "test", path: LESSON_TEST },
    ],
    limits:
      "Full T1 trough fails in 8 of 9 arms (granite misses the 30 m lowering; shale's U later opens into a broad trough as its walls retreat). Taught as a change of shape, not a finished U (D-W5-R1 item 3).",
  },
  {
    id: "C4",
    status: "explained",
    statement:
      "Where there is no ice (below the snout), nothing wears the valley: the river's V stays as it was.",
    sources: ["Hal79", "Model", "Protocol"],
    evidence: [
      { kind: "component", pattern: "^T2-", holds: "floor-unchanged" },
      { kind: "verdict", id: "K1-no-ice" },
    ],
    limits:
      "T2 fails in shale seeds 2–3 only because the growing glacier reached the control section; where the ice did not reach, the floor is unchanged in every arm.",
  },
  {
    id: "C5",
    status: "taught",
    statement: "Soft rock wears away faster (eroded area shale > sandstone > granite at matched time).",
    sources: ["Protocol", "Results", "Rocks", "Sel80"],
    evidence: [
      { kind: "verdict", id: "R1-rate" },
      { kind: "verdict", id: "E-R1-rate" },
    ],
    limits: "Relative erodibility values are teaching choices; only the ordering is sourced.",
  },
  {
    id: "C6",
    status: "taught",
    statement: "Soft rock is worn deeper (floor lowering shale > sandstone > granite at matched model time).",
    sources: ["Protocol", "Results", "Har92", "Sel80"],
    evidence: [{ kind: "verdict", id: "R4-deeper" }],
    limits:
      "At matched time only. At equal eroded area the lowering gaps are too small (E-R4 fails); depth means floor lowering, not rim-to-floor depth.",
  },
  {
    id: "C7",
    status: "taught",
    statement: "Hard rock keeps steeper walls (after equal erosion, and at the end of the run).",
    sources: ["Protocol", "Results", "Aug92", "Sel80"],
    evidence: [
      { kind: "verdict", id: "S1-shape" },
      { kind: "verdict", id: "E-R3-steeper" },
      { kind: "test", path: LESSON_TEST },
    ],
    limits:
      "Not at early matched times: R3 fails at 100 and 200 model years, when granite has barely been eroded. The flap and teacher notes say so.",
  },
  {
    id: "C8",
    status: "taught",
    statement: "Shale is soft, sandstone medium, granite hard (rock-mass strength ordering).",
    sources: ["Rocks", "Sel80", "Aug92"],
    evidence: [{ kind: "record", path: "docs/science/glacial/rock-types.md" }],
    limits: "Real rock masses of one name vary widely with jointing and weathering.",
  },
  {
    id: "C9",
    status: "explained",
    statement:
      "Where the floor at the cut lies below the floor further down-valley (adverse slope), the glacier has carved an overdeepened basin; valley glaciers carve such basins.",
    sources: ["CS12", "Model"],
    evidence: [
      { kind: "test", path: LESSON_TEST },
      { kind: "record", path: "docs/science/glacial/model.md §7" },
    ],
    limits:
      "Depth uncalibrated. In the recorded runs (averaged sections) the note triggers only in shale's lower trough at late times, never in granite or at the valley head. CS12 verified at abstract level only.",
  },
  {
    id: "C10",
    status: "explained",
    statement: "Time is model years with erosion compressed; never geological years.",
    sources: ["Model"],
    evidence: [{ kind: "record", path: "docs/science/glacial/model.md §4" }],
    limits: "No calibration to a real valley is claimed.",
  },
  {
    id: "C11",
    status: "explained",
    statement: "Glacier ice flows by internal deformation (Glen's law) and basal sliding.",
    sources: ["CP10", "Wee57"],
    evidence: [{ kind: "record", path: "docs/science/glacial/model.md §2" }],
    limits: "Shallow-ice approximation; all ice temperate.",
  },
  {
    id: "C12",
    status: "explained",
    statement:
      "Side walls carry part of the ice's weight, so sliding is slowest on the axis and fastest on the lower walls; plain shallow ice keeps a V.",
    sources: ["Nye65", "HHR88", "Sed09", "Model", "Results"],
    evidence: [
      { kind: "test", path: "hachure/glacier/src/cpu/shape-factor.test.ts" },
      { kind: "record", path: "docs/science/glacial/feasibility.md (attempts A0, A2)" },
    ],
    limits: "Geometric area-method estimate, flagged for expert review; not a higher-order stress solution.",
  },
  {
    id: "C13",
    status: "not-taught",
    statement: "The soft-rock valley has a wider floor.",
    sources: ["Results"],
    evidence: [{ kind: "record", path: `${SUMMARY} (R2-wider and E-R2-wider fail)` }],
    limits:
      "Unsupported: floor width is not ordered at matched time, and hard rock is wider at equal erosion.",
  },
  {
    id: "C14",
    status: "not-taught",
    statement: "Every rock forms a complete U-shaped trough (T1) at one time or at equal erosion.",
    sources: ["Results"],
    evidence: [{ kind: "record", path: `${SUMMARY} (T1 fails 8 of 9 arms; E-T1 fails every arm)` }],
    limits: "Unsupported; the lesson teaches the V → U change by shape (C3).",
  },
  {
    id: "C15",
    status: "display",
    statement:
      "The default front face (grid column in U_VALLEY_VIEW, last snapshot) is a display choice; claims rest on the registered under-ice section.",
    sources: ["Lesson", "Protocol"],
    evidence: [
      { kind: "record", path: "DECISIONS.md D-W5-R1 item 4; D-5H-R1 2" },
      { kind: "test", path: LESSON_TEST },
    ],
    limits: "Picked after scanning the runs; never the basis of a claim.",
  },
  {
    id: "C16",
    status: "explained",
    statement:
      "Near the valley head every rock, granite included, is lowered far more than lower down, yet the floor still rises towards the headwall.",
    sources: ["Lesson", "Model"],
    evidence: [
      { kind: "record", path: "DECISIONS.md D-5H-R1 (b)" },
      { kind: "test", path: LESSON_TEST },
    ],
    limits: "A model observation in uncalibrated, compressed time; teacher notes only.",
  },
];
