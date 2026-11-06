/** How far a build log has been read, the finished lines, and the line ninja is still updating. */
export type LogCursor = {
  /** Bytes already consumed from the file. */
  offset: number;
  /** A CSI sequence split across two reads. It is not shown until the rest arrives. */
  held: string;
  /** The current line, not yet ended by a newline. */
  pending: string;
  /** Where the next character lands. `\r` moves this to the start without erasing the line. */
  column: number;
  /** Lines ended by a newline, oldest first, capped by the caller. */
  lines: string[];
};
