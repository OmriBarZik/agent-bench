/**
 * How a TUI line is painted. `live` is a streaming build log at its tail; `alert` is new output the user has not seen.
 * `added`, `removed` and `hunk` are patch lines in the run diff viewer.
 */
export type LineKind =
  "plain" | "selected" | "dim" | "notice" | "hint" | "title" | "live" | "alert" | "added" | "removed" | "hunk";
