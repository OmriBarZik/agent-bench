/** Where a ctrl-b build runs: this Mac, or the build Mac in configs/builder/remote.yaml. */
export type BuildTarget = "local" | "remote";

/** What a finished build tells the run list. */
export type BuildFinish = {
  /** The line under the list once the log is dismissed. */
  notice: string;
  /** Runs whose compile failed. The list asks whether to mark each one failed. */
  failedRunIds: string[];
};

/** A build that is ready to run with the terminal handed to it. It resolves with the notice to show afterwards. */
export type BuildWork = (signal: AbortSignal) => Promise<BuildFinish>;
