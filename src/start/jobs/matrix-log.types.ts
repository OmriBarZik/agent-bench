/** A writable matrix progress log for the Start tab and disk. */
export type MatrixLog = {
  /** Absolute path of the log file. */
  path: string;
  /** Append one status line (also written to disk). */
  append: (line: string) => void;
  /** Recent lines for the Start-tab status panel (newest last). */
  recent: (limit: number) => string[];
};
