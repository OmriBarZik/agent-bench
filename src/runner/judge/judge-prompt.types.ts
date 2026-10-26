import type { ChangedFile, ToolTrouble } from "../../db/db.types";

/** What the judge is told about one finished run. */
export type JudgePromptInput = {
  taskPrompt: string;
  judgePrompt: string;
  changedFiles: ChangedFile[];
  diff: string;
  agentReport: string;
  /** The agent's tool calls that never ran or failed, oldest first. */
  toolTrouble: ToolTrouble[];
};
