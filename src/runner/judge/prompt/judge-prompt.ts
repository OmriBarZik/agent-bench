import type { ChangedFile } from "../../../db/db.types";
import type { JudgePromptInput } from "./judge-prompt.types";
import { toolTroubleText } from "./tool-trouble-text";

const REPORT_MAX_CHARS = 4_000;

/** The user message for the judge session: the task, the rubric, and what the agent left behind. */
export function buildJudgePrompt({
  taskPrompt,
  judgePrompt,
  changedFiles,
  diff,
  agentReport,
  toolTrouble,
}: JudgePromptInput): string {
  const files = changedFiles.length === 0 ? "(no files changed)" : changedFiles.map(changedFileText).join("\n");
  const patch = diff.trim() === "" ? "(no diff; the tree matches the task commit)" : diff.trim();

  return [
    "You are judging a finished coding agent. The checkout is the agent's final tree.",
    "Do not edit files or finish the task yourself.",
    "",
    "## Task",
    taskPrompt.trim(),
    "",
    "## Requirements",
    judgePrompt.trim(),
    "",
    "## Files changed from the task commit",
    files,
    "",
    "## Diff",
    patch,
    "",
    "## Agent's final message",
    clipReport(agentReport),
    "",
    "## Agent tool calls that never ran or failed",
    toolTroubleText(toolTrouble),
    "",
    "If the diff is truncated, read the changed files.",
    "Judge the checkout, not what the agent claims.",
    "Also report whether a missing, denied, or failing tool or program stopped the agent from doing part of the task.",
    "A call the agent worked around is not a blocker.",
  ].join("\n");
}

function changedFileText(file: ChangedFile): string {
  if (file.previousPath) {
    return `${file.status} ${file.previousPath} -> ${file.path}`;
  }

  return `${file.status} ${file.path}`;
}

function clipReport(agentReport: string): string {
  const text = agentReport.trim();

  if (text === "") {
    return "(no final message)";
  }

  if (text.length <= REPORT_MAX_CHARS) {
    return text;
  }

  return `${text.slice(0, REPORT_MAX_CHARS)}\n…(message truncated)`;
}
