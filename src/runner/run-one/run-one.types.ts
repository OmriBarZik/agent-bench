import type { ClaudeResult, JudgeMetrics, RunArtifact } from "../../db/db.types";

/** Options shared by every run in a benchmark. */
export type RunOptions = {
  claudeVersion: string;
  timeoutMs: number;
  sync: boolean;
  /** Model for the read-only judge session. The same model scores every config. */
  judgeModel: string;
};

/** What runOne reports back to the run loop. */
export type RunOneResult = {
  runId: string;
  result: ClaudeResult;
  seconds: number;
  artifact: RunArtifact;
  /** Null when the user stopped the run before the judge started. */
  judge: JudgeMetrics | null;
  /** True when this run was stored as cancelled. */
  cancelled: boolean;
};
