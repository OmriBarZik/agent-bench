import { basename } from "node:path";
import { colorLine, fit } from "../../render/terminal-text";
import type { ClearAppProgress, ClearAppResult } from "./clear-app.types";

/** One-line notice for the Runs tab after a clear. */
export function clearAppNotice(result: ClearAppResult): string {
  if (result.removed.length === 0) {
    return result.skipped[0] ?? "no Chromium.app copies to delete";
  }

  const size = formatBytes(result.freedBytes);
  const count = result.removed.length;
  const noun = count === 1 ? "copy" : "copies";

  if (result.skipped.length === 0) {
    return `deleted ${count} Chromium.app ${noun} (${size})`;
  }

  return `deleted ${count} Chromium.app ${noun} (${size}); skipped ${result.skipped.length}`;
}

/**
 * One-line status while a clear runs in the background.
 * Includes a short bar and the current folder so the Runs list can stay interactive.
 */
export function clearAppProgressNotice(progress: ClearAppProgress): string {
  if (progress.phase === "done") {
    const noun = progress.removed.length === 1 ? "copy" : "copies";

    return `deleted ${progress.removed.length} Chromium.app ${noun} (${formatBytes(progress.freedBytes)})`;
  }

  const completed = progress.phase === "deleting" ? Math.max(progress.index - 1, 0) : progress.index;
  const bar = progressBar({ done: completed, total: progress.total, width: 10 });
  const left = progress.pending.length > 0 ? ` · ${progress.pending.length} left` : "";

  if (progress.phase === "skipped") {
    return `${bar} ${progress.index}/${progress.total} skip ${progress.runId}${left}`;
  }

  if (progress.phase === "deleted") {
    return `${bar} ${progress.index}/${progress.total} deleted ${progress.runId}${left}`;
  }

  return `${bar} ${progress.index}/${progress.total} deleting ${progress.runId}${left}`;
}

/**
 * Detail-pane lines for an in-flight clear: progress bar, current path, and a short done/pending list.
 * Especially useful when many copies are queued.
 */
export function clearAppProgressLines({
  progress,
  height,
  columns,
}: {
  progress: ClearAppProgress;
  height: number;
  columns: number;
}): string[] {
  const barWidth = Math.min(Math.max(columns - 16, 10), 40);
  const completed =
    progress.phase === "done" ? progress.total : progress.phase === "deleting" ? progress.index - 1 : progress.index;
  const bar = progressBar({ done: completed, total: progress.total, width: barWidth });
  const percent = progress.total === 0 ? 100 : Math.round((progress.removed.length / progress.total) * 100);
  const plain: string[] = [
    "Deleting Chromium.app copies",
    `${bar}  ${progress.removed.length}/${progress.total}  ${percent}%  ${formatBytes(progress.freedBytes)} freed`,
  ];

  if (progress.phase === "deleting" || progress.phase === "deleted" || progress.phase === "skipped") {
    const verb = progress.phase === "deleting" ? "deleting" : progress.phase === "deleted" ? "deleted " : "skipped ";
    plain.push(`${verb}  ${progress.runId}`);
    plain.push(`  ${progress.path}`);
  }

  const historyBudget = Math.max(height - plain.length - 1, 0);
  const doneNames = progress.removed.map((path) => basename(path));
  const pendingNames = progress.pending;
  const history: string[] = [];

  for (const name of doneNames.slice(-Math.min(3, historyBudget))) {
    history.push(`done     ${name}`);
  }

  const pendingRoom = Math.max(historyBudget - history.length, 0);

  for (const name of pendingNames.slice(0, pendingRoom)) {
    history.push(`pending  ${name}`);
  }

  const pendingShown = history.filter((line) => line.startsWith("pending")).length;

  if (pendingNames.length > pendingShown) {
    history.push(`pending  …and ${pendingNames.length - pendingShown} more`);
  }

  for (const line of history) {
    plain.push(line);
  }

  const lines: string[] = [];

  for (let index = 0; index < height; index++) {
    const text = plain[index] ?? "";
    const kind = index === 0 ? "title" : text.startsWith("deleting") ? "selected" : "plain";
    lines.push(colorLine({ text: fit({ text, width: columns }), kind }));
  }

  return lines;
}

/** ASCII progress bar filled for `done` of `total` steps. */
export function progressBar({ done, total, width }: { done: number; total: number; width: number }): string {
  const safeWidth = Math.max(width, 1);
  const filled = total <= 0 ? safeWidth : Math.min(safeWidth, Math.round((Math.min(done, total) / total) * safeWidth));

  return `[${"█".repeat(filled)}${"░".repeat(safeWidth - filled)}]`;
}

/** Human-readable size for clear notices and the progress pane. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
