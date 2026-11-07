/** Where a ctrl-b build runs: this Mac, or the build Mac in configs/builder/remote.yaml. */
export type BuildTarget = "local" | "remote";

/** What a finished build tells the run list. */
export type BuildFinish = {
  /** The line under the list once the log is dismissed. */
  notice: string;
  /** Runs whose compile failed. The list asks whether to mark each one failed. */
  failedRunIds: string[];
};

/** How a build writes output when the TUI keeps the terminal. */
export type BuildPresentation = {
  /** Append command stdout/stderr here instead of inheriting the terminal. */
  logPath?: string;
  /** When false, skip the cooked "Press enter" pause. Default true. */
  waitForReturn?: boolean;
};

/** Arguments every present* build receives. */
export type BuildWorkArgs = {
  signal: AbortSignal;
  presentation?: BuildPresentation;
};

/** A build ready to run. Under the TUI it pipes to a log and does not take the screen. */
export type BuildWork = (args: BuildWorkArgs) => Promise<BuildFinish>;
