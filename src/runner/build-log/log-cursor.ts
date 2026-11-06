import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import type { LogCursor } from "./log-cursor.types";
import { playLogText } from "./play/play-log";

/** One read of a growing log. A multi-megabyte ninja log is not reread from the start. */
const MAX_CHUNK = 256 * 1024;

/** An empty cursor at the start of a log file. */
export function createLogCursor(): LogCursor {
  return { offset: 0, held: "", pending: "", column: 0, lines: [] };
}

/**
 * Appends one chunk. `\r` moves to the start of the line so the next characters overwrite it, which is how ninja updates progress.
 * The cursor's `offset` is left unchanged; the file reader advances it.
 */
export function appendLogText({
  cursor,
  text,
  maxLines,
}: {
  cursor: LogCursor;
  text: string;
  maxLines: number;
}): LogCursor {
  const written = playLogText({ text: cursor.held + text, line: cursor.pending, column: cursor.column });
  const lines = cursor.lines.concat(written.finished);
  const overflow = Math.max(0, lines.length - maxLines);

  return {
    offset: cursor.offset,
    held: written.held,
    pending: written.line,
    column: written.column,
    lines: overflow > 0 ? lines.slice(overflow) : lines,
  };
}

/** Finished lines plus the line still being written. */
export function linesOfLog(cursor: LogCursor): string[] {
  if (cursor.pending === "") {
    return cursor.lines;
  }

  return [...cursor.lines, cursor.pending];
}

/**
 * Reads whatever was appended to `path` since `cursor.offset`.
 * A missing file, or one replaced by a shorter one, leaves the screen waiting rather than throwing.
 */
export function pullLogFile({
  cursor,
  path,
  maxLines,
}: {
  cursor: LogCursor;
  path: string;
  maxLines: number;
}): LogCursor {
  let handle: number;

  try {
    handle = openSync(path, "r");
  } catch {
    // The builds row can exist before the first write, and the screen keeps waiting.
    return cursor;
  }

  try {
    const size = fstatSync(handle).size;
    const start = size < cursor.offset ? createLogCursor() : cursor;

    if (size <= start.offset) {
      return start;
    }

    const length = Math.min(size - start.offset, MAX_CHUNK);
    const buffer = Buffer.alloc(length);
    const read = readSync(handle, buffer, 0, length, start.offset);
    const next = appendLogText({ cursor: start, text: buffer.toString("utf8", 0, read), maxLines });

    return { ...next, offset: start.offset + read };
  } finally {
    closeSync(handle);
  }
}
