import type { Level } from "../schema/spread";
import type { ReaderModelScope } from "../schema/spread";
import type { BindingEngine } from "../bindings/engine";
import type { Cell, RainSourceOp, SpringOp } from "@hachure/terrain";
export type { ReaderModelScope } from "../schema/spread";

/**
 * Serializable authored initial state (not a checkpoint). 5B clones and validates at
 * initialization and reset on every backend; never transfer the author's arrays away.
 * Exact domain is retained rather than resampled to a device tier. Sources are installed
 * exactly once after initialization/reset. Row-major arrays have gridSize squared entries.
 */
export interface AuthoredTerrainInitial {
  readonly id: string;
  readonly gridSize: number;
  readonly metresPerCell: number;
  readonly outlet: Cell;
  readonly bedrockM: Float32Array;
  readonly sedimentM: Float32Array;
  readonly hardness: Float32Array;
  readonly sources: readonly (SpringOp | RainSourceOp)[];
}

/** Read-only face of the existing binding engine; producers publish model/config values. */
export type ReaderBindings = Pick<BindingEngine, "render" | "subscribeText">;

/**
 * Terrain positions use PointM's x/y plane; the renderer maps plane y to world z.
 * Source selection/bindings reflect accepted, clamped host positions, not pointer requests.
 */
export type ReaderSelection =
  | { readonly kind: "none" }
  | { readonly kind: "contour"; readonly elevationM: number }
  | { readonly kind: "source"; readonly id: string; readonly xM: number; readonly yM: number };

/** View state only; neither a checkpoint nor permission to alter the model. */
export interface ReaderPresentation {
  readonly level: Level;
  readonly prediction:
    | { readonly kind: "absent" }
    | { readonly kind: "unanswered" }
    | { readonly kind: "answered"; readonly optionIndex: number };
  readonly explanationOpen: boolean;
  readonly liftFraction: number;
  readonly selection: ReaderSelection;
}

export type SceneReadiness =
  | { readonly kind: "loading" }
  | { readonly kind: "ready" }
  | { readonly kind: "fallback"; readonly reason: string }
  | { readonly kind: "error"; readonly reason: string }
  | { readonly kind: "disposed" };

export type ReaderGesture = "idle" | "lift" | "orbit" | "source";

/** Transient runtime status, not model state or a full solver checkpoint. */
export interface ReaderSceneStatus {
  readonly readiness: SceneReadiness;
  readonly gesture: ReaderGesture;
  readonly activity: "paused" | "playing" | "settling";
  readonly attached: boolean;
}

/**
 * Calls are serialized by the reader. No question or explanation gates readiness.
 * Implementations must reject new mutations once departure begins, drain already
 * accepted mutations, and retain the actual model instance across detach/mount.
 */
export interface ReaderSceneController {
  readonly scope: ReaderModelScope;
  /**
   * Scalar probes cover geometry quantities too (e.g. selected elevation/contour interval).
   * They must be declared and catalogue-validated exactly like live process probes.
   * Shell text subscribes here, so it never types values or reads renderer internals.
   */
  readonly bindings: ReaderBindings;
  readiness(): SceneReadiness;
  status(): ReaderSceneStatus;
  /** Immediately emits current status, then changes; unsubscribe is idempotent. */
  subscribe(listener: (status: ReaderSceneStatus) => void): () => void;
  mount(container: HTMLElement): Promise<void>;
  presentation(): ReaderPresentation;
  /**
   * Presentation changes work in loading, fallback and detached retained scenes too.
   * Rendering may defer until mount/readiness. A selected source does not place/move one.
   * Reject after disposal; question/reveal/level updates never require a live renderer.
   */
  present(state: ReaderPresentation): void;
  /** Stops scheduling, drains work and publishes a final consistent sample. */
  pauseAndSettle(): Promise<void>;
  /** Requires settlement; releases DOM/listeners, retains precision and clock state. */
  detach(): void;
  /**
   * Restores pre-departure play intent without wall-clock catch-up. Static scenes,
   * fallback and error states are a no-op, so a readable flat page remains navigable.
   */
  resume(): void;
  /**
   * Explicit reader action: settle; restore authored model/source, lift, selection and
   * unanswered/absent prediction defaults; close explanation; preserve level; remain paused.
   * Does not change shell navigation or grant challenge success.
   */
  reset(): Promise<void>;
  /** Idempotent; settles or cancels pending work before releasing resources. */
  dispose(): Promise<void>;
}
