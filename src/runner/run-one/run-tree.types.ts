import type { ClaudeResult, RunArtifact } from "../../db/db.types";

/** The agent commit, plus the error when git could not finish it. */
export type CommittedWork = {
  result: ClaudeResult;
  artifact: RunArtifact;
  commitError: unknown;
};
