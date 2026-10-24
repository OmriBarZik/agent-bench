import type { ChangedFile } from "../db.types";
import type { JudgePromptInput } from "./judge-prompt.types";

const REPORT_MAX_CHARS = 4_000;

/** The user message for the judge session: the task, the rubric, and what the agent left behind. */
export function buildJudgePrompt({
  taskPrompt,
  judgePrompt,
  changedFiles,
  diff,
  agentReport,
}: JudgePromptInput): string {
  const files = changedFiles.length === 0 ? "(no files changed)" : changedFiles.map(changedFileText).join("\n");
  const patch = diff.trim() === "" ? "(no diff; the tree matches the task commit)" : diff.trim();

  return [
    "You are judging a finished coding agent. The checkout is the agent's final tree.",
    "Score how completely that tree does what the task asked. Do not edit files or finish the task yourself.",
    "",
    "## Task",
    taskPrompt.trim(),
    "",
    "## Scoring notes",
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
    "If the diff is truncated, read the changed files before you score.",
    "Base the score on the checkout, not on what the agent claims.",
    "score is a decimal from 0 to 1, such as 0.2 or 0.743, not only 0 or 1.",
    "0 means the task was not done. 1 means every requirement in the task and the scoring notes is met.",
    "Use a fraction for partial work. Do not round a partial result up to 1 or down to 0.",
    "reason is a short explanation of what is present and what is missing.",
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
