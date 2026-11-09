/**
 * Preset metadata beyond the state itself: where the river starts and the outlet's base level.
 *
 * `TerrainPreset.create` returns only a `TerrainState`. The model also needs the outlet face and its fixed
 * base level (docs/science/model.md, "State, units and boundaries": "Record that base level in the preset
 * metadata"), and probes and the page need the declared river source (validation-spec.md, "Channel/profile":
 * channel tracing starts at the declared spring).
 */
import type { Cell, SpringOp, TerrainPreset } from "../contract/index";

/** The inputs every preset builds from, exactly what `TerrainPreset.create` receives. */
export type PresetConfig = Parameters<TerrainPreset["create"]>[0];

/** The edge face of the outlet cell through which water and sediment leave the grid. */
export type OutletFace = "north" | "south" | "east" | "west";

export interface PresetLayout {
  /** The outlet cell; equal to `create(config).outlet`. */
  readonly outlet: Cell;
  /** The open face of the outlet cell. Every other boundary face is closed. */
  readonly outletFace: OutletFace;
  /**
   * Fixed receiving water surface at the outlet (unit: metres): the initial ground elevation of the outlet
   * cell, `bedrockM + sedimentM` as stored in the created state (docs/science/model.md).
   */
  readonly baseLevelM: number;
  /**
   * The declared river source, as a spring op the host applies after every reset
   * (`solver.applyTool(layout.source)`). Channel probes start their trace here.
   */
  readonly source: SpringOp;
  /** The cell that contains `source.at`. */
  readonly sourceCell: Cell;
}

/** A preset that also describes its outlet and river source. */
export interface PresetWithLayout extends TerrainPreset {
  /** Metadata for this config. Deterministic, and consistent with `create(config)`. */
  layout(config: PresetConfig): PresetLayout;
}
