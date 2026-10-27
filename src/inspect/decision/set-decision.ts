import { openDb, overrideJudgeDecision } from "../../db/db";
import { decisionSucceeds } from "../../db/judge-decision";
import type { JudgeDecision } from "../../db/judge-decision.types";
import type { RunChoice } from "../list/select-state.types";

/** Writes the chosen judge decision for this run and updates the row on screen. */
export function setListedDecision({ chosen, decision }: { chosen: RunChoice; decision: JudgeDecision }): string {
  try {
    chosen.judgeNote = recordDecision({ runId: chosen.runId, decision });
  } catch (error) {
    const message = error instanceof Error ? error.message : "could not set the decision";

    return message;
  }

  chosen.decision = decision;
  chosen.success = decisionSucceeds(decision);
  chosen.score = null;

  return `set ${chosen.taskId} × ${chosen.configId} to ${decision}`;
}

function recordDecision({ runId, decision }: { runId: string; decision: JudgeDecision }): string {
  const db = openDb();

  try {
    return overrideJudgeDecision({ db, runId, decision });
  } finally {
    db.close();
  }
}
