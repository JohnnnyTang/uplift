import type { Level, ReaderSceneController, ReaderSpread } from "@hachure/runtime";

/** Shell owns navigation/focus; scenes own scene gestures and model resources. */
export interface ReaderEntry {
  readonly spread: ReaderSpread;
  readonly createScene: (level: Level) => ReaderSceneController;
}

export type ReaderPage = "spread" | "text" | "illustration";

export interface ReaderNavigation {
  readonly spreadId: string;
  /** Narrow screens show one page; zoom/reflow may scroll rather than force a spread. */
  readonly page: ReaderPage;
  readonly turning: boolean;
}

export interface ReaderTurnRequest {
  readonly direction: "previous" | "next";
  readonly via: "button" | "keyboard" | "swipe" | "wheel";
}

/** Absolute destination for contents links and browser history restoration. */
export interface ReaderTarget {
  readonly spreadId: string;
  readonly page: ReaderPage;
}

export interface ReaderShellController {
  navigation(): ReaderNavigation;
  /**
   * False at a boundary or while a scene gesture is active. Serialize turns,
   * await pauseAndSettle before detach, then mount/resume the retained target instance.
   * Questions, reveals and stamps never gate turns. Focus the incoming heading;
   * closing a disclosure restores its trigger's focus.
   */
  turn(request: ReaderTurnRequest): Promise<boolean>;
  /**
   * Absolute navigation (including popstate). During settlement/animation, retain
   * only the latest requested destination; never queue relative turns. turn computes
   * its destination from the currently displayed spread/page and uses this method.
   * A superseded request resolves false; the request actually displayed resolves true.
   * Invalid destinations reject. The shell owns URL updates and restores incoming
   * heading focus. All absolute requests (including history) defer/coalesce while a
   * scene gesture is captured, until pointerup/cancel; navigation never steals a drag.
   * Relative turn requests may return false while a gesture is captured.
   */
  navigate(target: ReaderTarget): Promise<boolean>;
  /** Changes both retained presentations without recreating/resetting models. */
  setLevel(level: Level): void;
  /** Settle/dispose both retained scenes. No HostSample-based restoration. */
  dispose(): Promise<void>;
}

/** Retain both scenes; only the visible scene is attached/running. */
export const READER_SCENE_LIMIT = 2;
