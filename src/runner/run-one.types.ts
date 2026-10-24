import type { ClaudeResult, RunArtifact } from "../db.types";

/** Options shared by every run in a benchmark. */
export type RunOptions = {
  claudeVersion: string;
  timeoutMs: number;
  sync: boolean;
};

/** What runOne reports back to the run loop. */
export type RunOneResult = {
  runId: string;
  result: ClaudeResult;
  seconds: number;
  artifact: RunArtifact;
};
