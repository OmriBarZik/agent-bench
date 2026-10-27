import type { JudgeBlocker } from "../../../db/judge-blocker.types";
import type { JudgeDecision } from "../../../db/judge-decision.types";

/** The decision, explanation, and blockers parsed from a judge session. */
export type JudgeVerdict = {
  decision: JudgeDecision;
  reason: string;
  blocked: boolean;
  blockers: JudgeBlocker[];
};
