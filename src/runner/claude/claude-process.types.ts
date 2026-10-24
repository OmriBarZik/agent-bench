import type { ClaudeResult } from "../../db/db.types";

/** Stdout, stderr, and the parsed result from one claude process. */
export type ClaudeCapture = {
  result: ClaudeResult;
  stdout: string;
  stderr: string;
};
