import type { JudgeDecision } from "../../db/judge-decision.types";

/** The decision and explanation parsed from a judge session. */
export type JudgeVerdict = {
  decision: JudgeDecision;
  reason: string;
};
