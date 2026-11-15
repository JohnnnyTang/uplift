/**
 * ILLUSTRATION — authored relief, NOT a simulation (owner exception D-L2-1, lesson 2 only).
 *
 * The one typed config for lesson 2's boundary relief. Every value is transcribed from session 7A's
 * parameter table (`docs/science/plates/parameters.md`, machine-readable copy `parameters.json`); the
 * comment on each names its row there, where the source or the ARTISTIC CHOICE label lives. A test keeps
 * this file and `parameters.json` in step. Nothing here is a model output, and no value may be typed on the
 * page: the page cites real-world figures from 7A's claim register and binds the two display scales.
 */

/** The three continental plate boundaries of the lesson (D-L2-1, decision 3). */
export type PlateBoundary = "convergent" | "divergent" | "transform";

/** In picker order (the wave plan's §1: convergent, divergent, transform). */
export const PLATE_BOUNDARIES: readonly PlateBoundary[] = Object.freeze([
  "convergent",
  "divergent",
  "transform",
]);

/** One rock layer of the starting stack, top first. */
export interface PlatesLayer {
  /** Stable key, matching `parameters.json` (`start.layers[].name`). */
  readonly key: string;
  /** Thickness before deformation (unit: metres). Drawn with the surface's vertical exaggeration. */
  readonly thicknessM: number;
  /** Presentation id on the snapshot's `rockId` (not science; the diorama maps it to a look). */
  readonly rockId: number;
}

/** Every value: docs/science/plates/parameters.md row N (source or ARTISTIC CHOICE). */
export interface PlatesReliefConfig {
  /** Row 6. Seeds the noise only. */
  readonly seed: number;
  /** Row 1. `columns` across the boundary, `rows` along it (row 0 at the back). */
  readonly grid: { readonly columns: number; readonly rows: number; readonly metresPerCell: number };
  readonly display: {
    /** Row 2. Surface and rock layers (unit: none; 1 = true scale). The stage's `reliefScale`. Bound. */
    readonly surfaceVerticalExaggeration: number;
    /** Row 3. Crust depths, compressed (unit: none; 1 = true depth). Bound. */
    readonly crustVerticalExaggeration: number;
    /** Row 4. One fixed block base for every boundary and stage (unit: metres below sea level, real). */
    readonly blockBaseDepthBelowSeaLevelM: number;
  };
  readonly start: {
    /** Row 7. */
    readonly lowlandElevationM: number;
    /** Row 8. Downhill towards +x (unit: metres per kilometre). */
    readonly regionalTiltMPerKm: number;
    /** Row 9. */
    readonly ridgeSpacingM: number;
    /** Row 10. Crest to trough. */
    readonly ridgeReliefM: number;
    /** Row 11. */
    readonly ridgeMeanderAmplitudeM: number;
    /** Row 11. */
    readonly ridgeMeanderWavelengthM: number;
    /** Row 12. */
    readonly streamChannelDepthM: number;
    /** Row 12. */
    readonly streamChannelWidthM: number;
    /** Row 13. */
    readonly surfaceNoiseAmplitudeM: number;
    /** Row 13. */
    readonly surfaceNoiseWavelengthM: number;
    /** Row 14. Top first. */
    readonly layers: readonly PlatesLayer[];
    /** Row 14. The crystalline crust under the layers (presentation id). */
    readonly basement: { readonly key: string; readonly rockId: number };
  };
  readonly crust: {
    /** Row 15. At the lowland level. */
    readonly normalThicknessM: number;
    /** Row 16. */
    readonly crustDensityKgPerM3: number;
    /** Row 17. */
    readonly mantleDensityKgPerM3: number;
    /** Row 18. DERIVED: ρc / (ρm − ρc) (unit: metres of root per metre of uplift). */
    readonly airyRootPerMetreOfUplift: number;
  };
  readonly convergent: {
    /** Row 19. Smooth crest at stage 1. */
    readonly rangeCrestElevationM: number;
    /** Row 20. Base to base at stage 1. */
    readonly rangeWidthM: number;
    /** Row 21. Each flank at stage 1. */
    readonly rangeFlankWidthM: number;
    /** Row 22. Width at stage 0 as a fraction of row 20 (unit: none). */
    readonly rangeWidthAtStageZeroFraction: number;
    /** Row 23. Peaks and saddles as a fraction of the local uplift (unit: none). */
    readonly peakNoiseFraction: number;
    /** Row 24. */
    readonly peakNoiseWavelengthM: number;
  };
  readonly divergent: {
    /** Row 25. Between the outer faults. */
    readonly riftWidthM: number;
    /** Row 26. Inside the innermost faults. */
    readonly riftFloorWidthM: number;
    /** Row 27 (unit: count). */
    readonly scarpsPerSide: number;
    /** Row 27. Share of the floor drop per scarp, outermost first (unit: none; sums to 1). */
    readonly scarpDropFractions: readonly number[];
    /** Row 28. Below the start, at stage 1. */
    readonly floorDropM: number;
    /** Row 29. Above the start, at stage 1. */
    readonly shoulderHeightM: number;
    /** Row 30. e-folding distance away from the outer fault. */
    readonly shoulderDecayM: number;
    /** Row 31. Each scarp is a smoothstep across this width. */
    readonly scarpFaceWidthM: number;
    /** Row 32. At the axis, at stage 1. */
    readonly crustThicknessAtAxisM: number;
    /** Row 33. */
    readonly thinningHalfWidthM: number;
  };
  readonly transform: {
    /** Row 34. Total offset across the fault at stage 1. */
    readonly offsetM: number;
    /** Row 35. The right half (x > 0) moves towards the reader (+z, increasing row). */
    readonly sense: "right-lateral";
    /** Row 36. Half-width of the `tanh` drag zone. */
    readonly faultZoneHalfWidthM: number;
  };
  /** Rows 37, 38. Dressing colours only (7D); never on the page. */
  readonly dressing: { readonly snowlineM: number; readonly treelineM: number };
}

const freezeDeep = <T>(o: T): T => {
  if (o && typeof o === "object") {
    for (const v of Object.values(o)) freezeDeep(v);
    Object.freeze(o);
  }
  return o;
};

/**
 * The 7A parameter table as revised at the owner's look review (version `7R-1`, D-W7-7R: rows 10, 28 and
 * 29). Row numbers refer to `docs/science/plates/parameters.md`.
 */
export const PLATES_RELIEF_CONFIG: PlatesReliefConfig = freezeDeep({
  seed: 7, // row 6, ARTISTIC CHOICE
  grid: { columns: 160, rows: 160, metresPerCell: 1000 }, // row 1, ARTISTIC CHOICE (block scale; Nab09, TDE-H, Kel94, TDE-U)
  display: {
    surfaceVerticalExaggeration: 4, // row 2, ARTISTIC CHOICE (vertical exaggeration)
    crustVerticalExaggeration: 0.75, // row 3, ARTISTIC CHOICE (compressed crust depth; D-W7-7A)
    blockBaseDepthBelowSeaLevelM: 72_000, // row 4, ARTISTIC CHOICE (DERIVED margin below rows 15, 18, 19)
  },
  start: {
    lowlandElevationM: 400, // row 7, ARTISTIC CHOICE
    regionalTiltMPerKm: 1.5, // row 8, ARTISTIC CHOICE
    ridgeSpacingM: 20_000, // row 9, ARTISTIC CHOICE
    ridgeReliefM: 1_500, // row 10, ARTISTIC CHOICE (owner, D-W7-7R: 500 → 1,500 m so the transform offset reads)
    ridgeMeanderAmplitudeM: 1_000, // row 11, ARTISTIC CHOICE
    ridgeMeanderWavelengthM: 60_000, // row 11, ARTISTIC CHOICE
    streamChannelDepthM: 40, // row 12, ARTISTIC CHOICE
    streamChannelWidthM: 2_000, // row 12, ARTISTIC CHOICE
    surfaceNoiseAmplitudeM: 30, // row 13, ARTISTIC CHOICE
    surfaceNoiseWavelengthM: 6_000, // row 13, ARTISTIC CHOICE
    // row 14, ARTISTIC CHOICE (generic textbook layers; Kel94 for context only)
    layers: [
      { key: "sandstone", thicknessM: 600, rockId: 10 },
      { key: "shale", thicknessM: 600, rockId: 11 },
      { key: "limestone", thicknessM: 600, rockId: 12 },
    ],
    basement: { key: "crystalline crust", rockId: 13 }, // row 14
  },
  crust: {
    normalThicknessM: 35_000, // row 15, CITED inside the range (TDE-I, CM95, Kel94, Nab09)
    crustDensityKgPerM3: 2_800, // row 16, CITED (TS14, Fia, CM95)
    mantleDensityKgPerM3: 3_300, // row 17, CITED (TS14, Fia)
    airyRootPerMetreOfUplift: 5.6, // row 18, DERIVED ρc / (ρm − ρc) (Fia, TS14, CM95)
  },
  convergent: {
    rangeCrestElevationM: 5_500, // row 19, CITED inside the range (TDE-U)
    rangeWidthM: 80_000, // row 20, ARTISTIC CHOICE (compressed to about a third; Nab09)
    rangeFlankWidthM: 25_000, // row 21, ARTISTIC CHOICE
    rangeWidthAtStageZeroFraction: 0.5, // row 22, ARTISTIC CHOICE
    peakNoiseFraction: 0.3, // row 23, ARTISTIC CHOICE
    peakNoiseWavelengthM: 12_000, // row 24, ARTISTIC CHOICE
  },
  divergent: {
    riftWidthM: 50_000, // row 25, CITED (Cho05, Kel94)
    riftFloorWidthM: 20_000, // row 26, ARTISTIC CHOICE
    scarpsPerSide: 3, // row 27, ARTISTIC CHOICE (symmetric stepped graben; Cho05)
    scarpDropFractions: [0.4, 0.3, 0.3], // row 27, ARTISTIC CHOICE
    floorDropM: 1_500, // row 28, CITED total relief with row 29: 2,100 m, top of the range (Cho05; D-W7-7R); split ARTISTIC
    shoulderHeightM: 600, // row 29, ARTISTIC CHOICE (share of the 2,100 m relief, as before about 2/7; Cho05)
    shoulderDecayM: 20_000, // row 30, ARTISTIC CHOICE
    scarpFaceWidthM: 1_000, // row 31, ARTISTIC CHOICE
    crustThicknessAtAxisM: 25_000, // row 32, CITED inside the range (Kel94, Cho05)
    thinningHalfWidthM: 40_000, // row 33, ARTISTIC CHOICE (shape; Kel94)
  },
  transform: {
    offsetM: 8_000, // row 34, ARTISTIC CHOICE (compressed / enlarged offset; SJ84)
    sense: "right-lateral", // row 35, CITED (SJ84, TDE-U)
    faultZoneHalfWidthM: 1_000, // row 36, ARTISTIC CHOICE (narrowed; TDE-U)
  },
  dressing: {
    snowlineM: 5_700, // row 37, CITED (Owe09)
    treelineM: 4_000, // row 38, ARTISTIC CHOICE (dressing colour only)
  },
} satisfies PlatesReliefConfig);

/** Display scales derived from the config. Pages bind these (with the config), never type them. */
export interface PlatesSceneScales {
  /** The stage's single `reliefScale`: row 2 (unit: none). */
  readonly reliefScale: number;
  /**
   * Real Moho depth (metres below sea level) → snapshot `crustBaseM` (scene metres): multiply by
   * `−crustSceneFactor` = −row 3 / row 2. After the stage's `reliefScale` the Moho lands at row 3's
   * compressed depth (D-W7-7A, decision 3).
   */
  readonly crustSceneFactor: number;
  /** The fixed block base in scene metres, on the crust's scale (row 4 × row 3 / row 2). */
  readonly blockBaseSceneM: number;
}

export function platesSceneScales(config: PlatesReliefConfig = PLATES_RELIEF_CONFIG): PlatesSceneScales {
  const { surfaceVerticalExaggeration: surface, crustVerticalExaggeration: crust } = config.display;
  const crustSceneFactor = crust / surface;
  return {
    reliefScale: surface,
    crustSceneFactor,
    blockBaseSceneM: -config.display.blockBaseDepthBelowSeaLevelM * crustSceneFactor,
  };
}
