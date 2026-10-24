import type { ChangedFile } from "../db/db.types";
import type { RunChoice } from "./select-state.types";

/** One list row: when, status, score, file count, and task × config. */
export function choiceLabel(choice: RunChoice): string {
  const started = startedLabel(choice.startedAt);
  const status = choice.status.slice(0, 7).padEnd(7);
  const scoreText = scoreLabel(choice.score);
  const files = filesLabel(choice).padEnd(8);

  return `${started}  ${status}  ${scoreText}  ${files}  ${choice.taskId} × ${choice.configId}`;
}

/** One changed path, with git's name-status letter. */
export function changedFileLine(file: ChangedFile): string {
  if (file.previousPath) {
    return `${file.status} ${file.previousPath} -> ${file.path}`;
  }

  return `${file.status} ${file.path}`;
}

/** Five-character judge score, or n/a when the judge did not return one. Three decimals, so 0.743 stays 0.743. */
export function scoreLabel(score: number | null): string {
  if (score == null) {
    return "  n/a";
  }

  return score.toFixed(3);
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
