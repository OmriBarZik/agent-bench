import type { JudgeBlockerKind } from "./judge-blocker.types";

/** The kinds of tool problem a judge may report as a blocker. */
export const JUDGE_BLOCKER_KINDS = ["missing-tool", "denied", "exec-failed"] as const;

/** What each kind means. This lives on the output schema, not in the prompt. */
export const JUDGE_BLOCKER_MEANING: Record<JudgeBlockerKind, string> = {
  "missing-tool":
    "A tool, MCP server or tool, or program the agent needed was not available: not installed, not connected, or not in its tool list.",
  denied:
    "A tool call or command was refused by a permission rule or the Bash guard, and the agent found no other way.",
  "exec-failed":
    "A tool or program ran but kept failing (error, crash, timeout, command not working), and the agent could not get past it.",
};

/** True when the value is one of the blocker kinds. */
export function isJudgeBlockerKind(value: unknown): value is JudgeBlockerKind {
  if (typeof value !== "string") {
    return false;
  }

  return (JUDGE_BLOCKER_KINDS as readonly string[]).includes(value);
}
