/** One run in a remote build queue, after it was built or skipped. */
export type QueueOutcome = {
  branch: string;
  /** True when Chromium.app was copied back for this run. */
  built: boolean;
  notice: string;
};
