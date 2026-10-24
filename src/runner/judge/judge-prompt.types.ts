import type { ChangedFile } from "../../db/db.types";

/** What the judge is told about one finished run. */
export type JudgePromptInput = {
  taskPrompt: string;
  judgePrompt: string;
  changedFiles: ChangedFile[];
  diff: string;
  agentReport: string;
};
