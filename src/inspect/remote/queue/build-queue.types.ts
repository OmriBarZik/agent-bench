/** One run in a remote build queue, after it was built or skipped. */
export type QueueOutcome = {
  runId: string;
  branch: string;
  /** True when Chromium.app was copied back for this run. */
  built: boolean;
  notice: string;
  /** True when the compile itself failed, so the list can offer to mark the run failed. */
  compileFailed: boolean;
};
