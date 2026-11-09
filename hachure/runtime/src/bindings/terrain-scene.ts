import { simYearsPerStep, terrainWidthM, type TerrainConfig } from "@hachure/terrain";
import type { SceneSpec } from "../schema/index";
import { type BoundValue } from "./engine";
import { formatBoundNumber } from "./format";

/** Approval belongs to the calibration record, never inferred from the acceleration factor. */
export interface LandscapeTimeApproval {
  readonly status: "approved";
  readonly recordId: string;
  readonly approver: string;
  readonly approvedAt: string;
}
export interface TerrainSceneBindingInput {
  readonly config: TerrainConfig;
  readonly scene: Pick<SceneSpec, "stepsPerRealSecond" | "durations">;
  readonly stepCount: number;
  readonly speed?: number;
  readonly paused?: boolean;
  readonly calibration?: LandscapeTimeApproval;
}
/** Pure derived scene labels. Call alongside the host's probe/control sample. */
export function terrainSceneBindings(input: TerrainSceneBindingInput): Readonly<Record<string, BoundValue>> {
  const { config, scene, stepCount, calibration } = input;
  const speed = input.speed ?? 1;
  if (
    !Number.isInteger(stepCount) ||
    stepCount < 0 ||
    !Number.isFinite(speed) ||
    speed <= 0 ||
    !Number.isFinite(scene.stepsPerRealSecond) ||
    scene.stepsPerRealSecond <= 0
  )
    throw new RangeError("Invalid scene clock");
  const approved =
    calibration?.status === "approved" &&
    !!calibration.recordId.trim() &&
    !!calibration.approver.trim() &&
    !!calibration.approvedAt.trim();
  const pending = "Landscape time not calibrated";
  const yearsPerSecond = scene.stepsPerRealSecond * speed * simYearsPerStep(config);
  const timeScale = approved ? `1 s ≈ ${formatBoundNumber(yearsPerSecond, "years")}` : pending;
  const result: Record<string, BoundValue> = {
    timeScale: input.paused ? `${timeScale} (paused)` : timeScale,
    timeScaleLabel: input.paused ? `${timeScale} (paused)` : timeScale,
    simYearsPerRealSecond: approved ? formatBoundNumber(yearsPerSecond, "years/s") : pending,
    simYearsElapsed: approved
      ? `≈ ${formatBoundNumber(stepCount * simYearsPerStep(config), "years")}`
      : pending,
    scaleBar: formatBoundNumber(terrainWidthM(config), "m"),
    metresPerCell: formatBoundNumber(config.metresPerCell, "m"),
    terrainWidthM: formatBoundNumber(terrainWidthM(config), "m"),
    gridSize: formatBoundNumber(config.gridSize, "cells", 4),
  };
  for (const [id, duration] of Object.entries(scene.durations ?? {}))
    result[`duration.${id}`] = approved ? `≈ ${formatBoundNumber(duration.simYears, "years")}` : pending;
  return Object.freeze(result);
}
