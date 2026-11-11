import type { AgentBuildView } from "../../db/db.types";
import { createLogCursor, linesOfLog, producedLines, pullLogFile } from "./log-cursor";
import type { LogScreenRequest, LogView } from "./log-view.types";

/** How many lines a screen keeps so the user can scroll back through recent output. */
export const MAX_LOG_LINES = 4000;

/** A screen that has not seen a build yet. */
export function createLogView(): LogView {
  return { buildId: null, cursor: createLogCursor(), above: 0, unseen: 0 };
}

/**
 * Reads new bytes of `build`'s log into `view`. A different build starts over at the top of that file.
 * At the tail the view follows new lines; scrolled up, it stays on the same lines and counts what arrived below.
 */
export function syncLogView({
  view,
  build,
  maxLines = MAX_LOG_LINES,
}: {
  view: LogView;
  build: AgentBuildView | null;
  maxLines?: number;
}): LogView {
  if (build == null) {
    return createLogView();
  }

  if (build.log_path == null) {
    return { buildId: build.id, cursor: createLogCursor(), above: 0, unseen: 0 };
  }

  if (view.buildId !== build.id) {
    const cursor = pullLogFile({ cursor: createLogCursor(), path: build.log_path, maxLines });

    return { buildId: build.id, cursor, above: 0, unseen: 0 };
  }

  return pullLogView({ view, path: build.log_path, maxLines });
}

/** Reads new bytes of `path` into a view already showing that file, keeping the window still while scrolled up. */
export function pullLogView({
  view,
  path,
  maxLines = MAX_LOG_LINES,
}: {
  view: LogView;
  path: string;
  maxLines?: number;
}): LogView {
  const cursor = pullLogFile({ cursor: view.cursor, path, maxLines });

  if (view.above === 0) {
    return { ...view, cursor, unseen: 0 };
  }

  const added = Math.max(0, producedLines(cursor) - producedLines(view.cursor));
  const maxAbove = Math.max(0, linesOfLog(cursor).length - 1);

  return { ...view, cursor, above: Math.min(view.above + added, maxAbove), unseen: view.unseen + added };
}

/** Moves the window. A positive delta shows older lines; zero or less clamps at the tail. */
export function scrollLog({ view, delta, lineCount }: { view: LogView; delta: number; lineCount: number }): LogView {
  const maxAbove = Math.max(0, lineCount - 1);
  const above = Math.min(Math.max(view.above + delta, 0), maxAbove);
  const unseen = Math.min(view.unseen, above);

  return { ...view, above, unseen };
}

/** Arrow keys, page up and down, home, and end. Any other key leaves the view as it is. */
export function applyLogKey({
  view,
  key,
  pageSize,
  lineCount,
}: {
  view: LogView;
  key: string;
  pageSize: number;
  lineCount: number;
}): LogView {
  if (isUp(key)) {
    return scrollLog({ view, delta: 1, lineCount });
  }

  if (isDown(key)) {
    return scrollLog({ view, delta: -1, lineCount });
  }

  if (isPageUp(key)) {
    return scrollLog({ view, delta: pageSize, lineCount });
  }

  if (isPageDown(key)) {
    return scrollLog({ view, delta: -pageSize, lineCount });
  }

  if (isHome(key)) {
    return scrollLog({ view, delta: lineCount, lineCount });
  }

  if (isEnd(key)) {
    return { ...view, above: 0, unseen: 0 };
  }

  return view;
}

/**
 * True while this build should own the terminal.
 * A finished build stays up until the user hides it or the agent session ends.
 * A build that is still running shows even after an older one was hidden.
 */
export function buildLogWanted({ buildId, dismissedBuildId, shownBuildId, status }: LogScreenRequest): boolean {
  if (buildId == null || buildId === dismissedBuildId || status == null) {
    return false;
  }

  if (status === "building") {
    return true;
  }

  return buildId === shownBuildId;
}

function isUp(key: string): boolean {
  return key === "\x1b[A" || key === "\x1bOA";
}

function isDown(key: string): boolean {
  return key === "\x1b[B" || key === "\x1bOB";
}

function isPageUp(key: string): boolean {
  return key === "\x1b[5~";
}

function isPageDown(key: string): boolean {
  return key === "\x1b[6~";
}

function isHome(key: string): boolean {
  return key === "\x1b[H" || key === "\x1b[1~" || key === "\x1bOH";
}

function isEnd(key: string): boolean {
  return key === "\x1b[F" || key === "\x1b[4~" || key === "\x1bOF";
}

/** Lines currently held, so a key handler can clamp the scroll. */
export function logLineCount(view: LogView): number {
  return linesOfLog(view.cursor).length;
}
