import type { RunBranchRow } from "../../db/db.types";

/** A run from the database, plus whether its branch and transcript are on this machine. */
export type RunChoice = RunBranchRow & {
  /** False when the runs row names a branch the Chromium repo does not have. */
  present: boolean;
  /** True when this branch is the one currently checked out. */
  current: boolean;
  /** Absolute path to the agent transcript, or null when this run has no saved transcript. */
  transcriptPath: string | null;
  /** Absolute path to the judge transcript, or null when that session was not saved. */
  judgeTranscriptPath: string | null;
  /** Chromium.app this run can launch, or null when no build left one on disk. */
  chromiumAppPath: string | null;
  /**
   * True when a per-run Chromium.app folder exists under the build directory.
   * The shared out/Default app does not count — deleting that would break local builds.
   */
  hasAppCopy: boolean;
};

/** Filter text, the highlighted row, and runs checked for an action that takes more than one. */
export type SelectState = {
  query: string;
  selected: number;
  scroll: number;
  /** Checked run ids, in the order they were checked. Empty means the highlighted run alone. */
  marked: string[];
};

/** What the run list should do after one keypress. */
export type SelectAction =
  | "stay"
  | "menu"
  | "transcript"
  | "judge"
  | "checkout"
  | "build"
  | "chromium"
  | "decide"
  | "delete"
  | "refresh"
  | "quit";

/** What one keypress did to the run list. */
export type SelectResult = {
  state: SelectState;
  action: SelectAction;
};
