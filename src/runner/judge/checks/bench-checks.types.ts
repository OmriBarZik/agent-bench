import type { ChangedFile, Task } from "../../../db/db.types";

/**
 * What one bench check found. `fail` is a clear rule break, `review` is something the judge must look at in the
 * code, and `not-run` means the check could not decide (it proves nothing either way).
 */
export type BenchCheckStatus = "pass" | "fail" | "review" | "not-run";

/** One deterministic check the runner makes on the final tree after the agent stops. */
export type BenchCheck = {
  name: string;
  status: BenchCheckStatus;
  /** Plain sentences for the judge: what was compared and what was found. */
  detail: string;
};

/** What every bench check reads. The agent's changes are still in the working tree. */
export type BenchCheckInput = {
  task: Task;
  runId: string;
  /** The runner's commit of the agent's work, or null when the tree still matches the task SHA. */
  commitSha: string | null;
  changedFiles: ChangedFile[];
  chromiumSrc: string;
};

/** The newest successful agent build that was copied back to this Mac, and whether it is the final tree. */
export type FinalBuild = {
  buildNumber: number;
  snapshotSha: string;
  /** Folder that holds the copied build output for this run. */
  outputDir: string;
  /** Paths that differ between that build's snapshot and the final tree. Empty when they match. */
  differences: string[];
};

/** A DevTools view the agent registered with registerViewExtension. */
export type RegisteredView = {
  id: string;
  /** The location expression as written, such as `UI.ViewManager.ViewLocationValues.PANEL` or `'drawer-view'`. */
  location: string;
  file: string;
};

/** One read of the dino game state during the play check. */
export type PlayState = {
  playing: boolean;
  crashed: boolean;
  distance: number;
  trex: PlayTrex | null;
};

/** The T-Rex part of a play-check state read. */
export type PlayTrex = {
  yPos: number;
  jumping: boolean;
};

/** One check: reads the final tree and reports what it found. */
export type BenchCheckRun = (input: BenchCheckInput) => Promise<BenchCheck>;

/** A check and the name it reports under when it cannot run. */
export type NamedBenchCheck = {
  name: string;
  run: BenchCheckRun;
};

/** One try of the play check: it played, the game failed a user would see fail, or the bench could not tell. */
export type PlayOutcome = {
  status: "pass" | "fail" | "not-run";
  reason: string;
};
