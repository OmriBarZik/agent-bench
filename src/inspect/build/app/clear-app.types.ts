/** What deleting one or more Chromium.app copies reports back to the Runs tab. */
export type ClearAppResult = {
  /** Paths that were removed. */
  removed: string[];
  /** Why a folder was skipped, when any were. */
  skipped: string[];
  /** Rough total bytes freed, when known. */
  freedBytes: number;
};

/** Live progress while Chromium.app copies are deleted one folder at a time. */
export type ClearAppProgress = {
  /** 1-based index of the folder being worked on; `total` when finished. */
  index: number;
  /** How many folders this clear will try. */
  total: number;
  /** Run id / folder name for the current step, empty when finished. */
  runId: string;
  /** Absolute path of the current folder. */
  path: string;
  /** Where this step is. */
  phase: "deleting" | "deleted" | "skipped" | "done";
  /** Folders removed so far. */
  removed: string[];
  /** Folders still waiting (not including the current one). */
  pending: string[];
  /** Skipped so far (missing or reserved). */
  skippedCount: number;
  /** Bytes freed so far. */
  freedBytes: number;
};

/** Options for deleting one or more per-run Chromium.app folders. */
export type ClearChromiumAppCopiesOptions = {
  buildDirectory: string;
  runIds: string[];
  /** Called before and after each folder so the TUI can show a progress bar. */
  onProgress?: (progress: ClearAppProgress) => void;
  /** When aborted between folders, the clear stops and returns what it already removed. */
  signal?: AbortSignal;
};
