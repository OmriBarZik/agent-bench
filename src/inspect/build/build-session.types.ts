/** Where a ctrl-b build runs: this Mac, or the build Mac in configs/builder/remote.yaml. */
export type BuildTarget = "local" | "remote";

/** A build that is ready to run with the terminal handed to it. It resolves with the notice to show afterwards. */
export type BuildWork = (signal: AbortSignal) => Promise<string>;
