import type { JudgeDecision } from "../../db/judge-decision.types";

/** The four judge decisions, with one highlighted, for the run Ctrl-F opened. */
export type DecisionDialog = {
  /** The run this dialog will update. */
  runId: string;
  /** Index into the judge decisions, from failed to pass. */
  selected: number;
};

/** What one keypress did inside the decision dialog. */
export type DecisionKeyResult = { kind: "stay"; dialog: DecisionDialog } | { kind: "choose"; decision: JudgeDecision };
