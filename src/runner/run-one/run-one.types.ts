import type { ClaudeResult, JudgeMetrics, RunArtifact } from "../../db/db.types";

/** Options shared by every run in a benchmark. */
export type RunOptions = {
  claudeVersion: string;
  /** Agent work time. A remote build pauses this clock. */
  timeoutMs: number;
  /** How long one remote build may run before it fails and the agent resumes. */
  buildTimeoutMs: number;
  sync: boolean;
  /** Model for the read-only judge session. The same model scores every config. */
  judgeModel: string;
  /** Attach chrome-validate so the agent builds its change and checks it in Chromium. */
  autoReview: boolean;
};

/** The step a run is on: resetting the checkout, the agent session, or the judge session. */
export type RunPhase = "reset" | "agent" | "judge";

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
