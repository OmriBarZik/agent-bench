import type { ChangedFile } from "../../db/db.types";
import type { JudgeDecision } from "../../db/judge-decision.types";
import type { RunChoice } from "../list/select-state.types";

const LONGEST_DECISION = "partially-failed";
/** Width of the chrome-build column (`chrome` when a Chromium.app is on disk). */
const CHROME_COLUMN = "chrome";

/** One list row: when, status, decision, file count, chrome build, and task × config. */
export function choiceLabel(choice: RunChoice): string {
  const started = startedLabel(choice.startedAt);
  const status = choice.status.slice(0, 9).padEnd(9);
  const verdict = verdictLabel({ decision: choice.decision, score: choice.score, status: choice.status });
  const files = filesLabel(choice).padEnd(8);
  const chrome = chromeLabel(choice);

  return `${started}  ${status}  ${verdict}  ${files}  ${chrome}  ${choice.taskId} × ${choice.configId}`;
}

/**
 * Whether this run can open a Chromium.app (^P / Open Chromium).
 * `chrome` means a build left one on disk; `—` means build first.
 */
export function chromeLabel(choice: RunChoice): string {
  if (choice.chromiumAppPath) {
    return CHROME_COLUMN;
  }

  return "—".padEnd(CHROME_COLUMN.length);
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
 * A run that is still going, or finished without a judge, shows a short placeholder.
 */
export function verdictLabel({
  decision,
  score,
  status,
}: {
  decision: JudgeDecision | null;
  score: number | null;
  /** When `running`, the placeholder reads as in progress instead of n/a. */
  status?: string;
}): string {
  if (decision) {
    return decision.padEnd(LONGEST_DECISION.length);
  }

  if (score != null) {
    return score.toFixed(3).padEnd(LONGEST_DECISION.length);
  }

  if (status === "running") {
    return "pending".padEnd(LONGEST_DECISION.length);
  }

  return "n/a".padEnd(LONGEST_DECISION.length);
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
