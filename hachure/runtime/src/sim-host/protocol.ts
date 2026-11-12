import type { AuthoredTerrainInitial } from "../reader/contracts";
import type {
  ChannelResult,
  StateSnapshot,
  TerrainConfig,
  ToolOp,
  ToolResult,
  TunableConfig,
} from "@hachure/terrain";
import type { LandscapeTimeApproval } from "../bindings/index";

export type LandscapeTimeStatus =
  LandscapeTimeApproval | { readonly status: "pending" | "failed"; readonly recordId?: string };
export interface HostSample {
  readonly diagnostics?: { readonly kind: "unavailable"; readonly reason: string };
  readonly snapshot: StateSnapshot;
  readonly config: TerrainConfig;
  /** Fixed initial route and newly traced route must never be substituted for one another. */
  readonly paths: { readonly baseline: ChannelResult; readonly current: ChannelResult };
  readonly probes: { readonly incisionDepth: number | null; readonly sedimentOut: number };
  readonly calibration: LandscapeTimeStatus;
  readonly observationBaseline: { readonly kind: "reset"; readonly step: number };
  readonly snapshotMs: number;
}
export type HostCommand =
  | {
      readonly kind: "init";
      readonly config: Partial<TerrainConfig>;
      readonly calibration?: LandscapeTimeStatus;
      readonly initial?: AuthoredTerrainInitial;
    }
  | { readonly kind: "advance"; readonly steps: number; readonly sample: boolean }
  | { readonly kind: "sample" }
  | { readonly kind: "configure"; readonly patch: Partial<TunableConfig> }
  | { readonly kind: "tool"; readonly op: ToolOp }
  | { readonly kind: "reset" };
export interface HostReply {
  readonly sample?: HostSample;
  readonly toolResult?: ToolResult;
  readonly processingMs: number;
  readonly batch?: { readonly steps: number; readonly computeMs: number };
}
export interface HostTransport {
  request(command: HostCommand): Promise<HostReply>;
  dispose(): void;
}
export interface WorkerRequest {
  readonly id: number;
  readonly command: HostCommand;
}
export type WorkerReply =
  { readonly id: number; readonly reply: HostReply } | { readonly id: number; readonly error: string };
