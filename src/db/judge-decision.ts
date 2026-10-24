import type { JudgeDecision } from "./judge-decision.types";

/** The decisions a judge may return, from not done to fully done. */
export const JUDGE_DECISIONS = ["failed", "partially-failed", "partially-pass", "pass"] as const;

/** What each decision means. This lives on the output schema, not in the prompt. */
export const JUDGE_DECISION_MEANING: Record<JudgeDecision, string> = {
  failed: "The task was not done.",
  "partially-failed": "Some of the work is present, but the result does not meet the task.",
  "partially-pass": "The result meets the task, with something missing or only partly done.",
  pass: "Every requirement is met.",
};

/** True when the value is one of the four decisions. */
export function isJudgeDecision(value: unknown): value is JudgeDecision {
  if (typeof value !== "string") {
    return false;
  }

  return (JUDGE_DECISIONS as readonly string[]).includes(value);
}

/** True for pass and partially-pass. The failed decisions are not success. */
export function decisionSucceeds(decision: JudgeDecision): boolean {
  return decision === "pass" || decision === "partially-pass";
}
