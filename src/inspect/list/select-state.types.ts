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
};

/** Filter text and which row of the filtered list is highlighted. */
export type SelectState = {
  query: string;
  selected: number;
  scroll: number;
};

/** What the run list should do after one keypress. */
export type SelectAction = "stay" | "transcript" | "judge" | "checkout" | "build" | "delete" | "quit";

/** What one keypress did to the run list. */
export type SelectResult = {
  state: SelectState;
  action: SelectAction;
};
