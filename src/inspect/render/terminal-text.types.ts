/** How a TUI line is painted. `live` is a streaming build log at its tail; `alert` is new output the user has not seen. */
export type LineKind = "plain" | "selected" | "dim" | "notice" | "hint" | "title" | "live" | "alert";
