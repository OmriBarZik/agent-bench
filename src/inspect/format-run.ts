import type { ChangedFile } from "../db/db.types";
import type { JudgeDecision } from "../db/judge-decision.types";
import type { RunChoice } from "./select-state.types";

const LONGEST_DECISION = "partially-failed";

/** One list row: when, status, decision, file count, and task × config. */
export function choiceLabel(choice: RunChoice): string {
  const started = startedLabel(choice.startedAt);
  const status = choice.status.slice(0, 9).padEnd(9);
  const verdict = verdictLabel({ decision: choice.decision, score: choice.score });
  const files = filesLabel(choice).padEnd(8);

  return `${started}  ${status}  ${verdict}  ${files}  ${choice.taskId} × ${choice.configId}`;
}

/** One changed path, with git's name-status letter. */
export function changedFileLine(file: ChangedFile): string {
  if (file.previousPath) {
    return `${file.status} ${file.previousPath} -> ${file.path}`;
  }

  return `${file.status} ${file.path}`;
}

/**
 * The judge decision, padded so list columns line up.
 * An older row with only a decimal still shows that decimal.
 */
export function verdictLabel({ decision, score }: { decision: JudgeDecision | null; score: number | null }): string {
  if (decision) {
    return decision.padEnd(LONGEST_DECISION.length);
  }

  if (score == null) {
    return "n/a".padEnd(LONGEST_DECISION.length);
  }

  return score.toFixed(3).padEnd(LONGEST_DECISION.length);
}

function filesLabel(choice: RunChoice): string {
  if (!choice.present) {
    return "missing";
  }

  const count = choice.changedFiles.length;

  if (count === 1) {
    return "1 file";
  }

  return `${count} files`;
}

function startedLabel(startedAt: string): string {
  if (startedAt.length < 16) {
    return "unknown".padEnd(16);
  }

  return startedAt.slice(0, 16).replace("T", " ");
}
