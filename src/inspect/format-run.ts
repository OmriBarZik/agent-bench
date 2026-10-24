import type { ChangedFile } from "../db.types";
import type { RunChoice } from "./select-state.types";

/** One list row: when, status, file count, and task × config. */
export function choiceLabel(choice: RunChoice): string {
  const started = startedLabel(choice.startedAt);
  const status = choice.status.slice(0, 7).padEnd(7);
  const files = filesLabel(choice).padEnd(8);

  return `${started}  ${status}  ${files}  ${choice.taskId} × ${choice.configId}`;
}

/** One changed path, with git's name-status letter. */
export function changedFileLine(file: ChangedFile): string {
  if (file.previousPath) {
    return `${file.status} ${file.previousPath} -> ${file.path}`;
  }

  return `${file.status} ${file.path}`;
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
