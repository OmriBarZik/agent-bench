/** One file's part of a run's patch. Paths inside a submodule are prefixed with the submodule directory. */
export type FileDiff = {
  path: string;
  /** git name-status letter: M, A, D, R, C, T, or B for a binary file. */
  status: string;
  /** Set for a rename or copy. */
  previousPath?: string;
  added: number;
  removed: number;
  /** The patch lines for this file, starting at its `diff --git` header. Tabs are expanded. */
  lines: string[];
};

/** What a run's diff viewer shows: the list of changed files, or one file's patch. */
export type DiffMode = "files" | "patch";

/** The run diff open over the Runs list. */
export type DiffViewer = {
  runId: string;
  /** `task × config` of the run, shown in the title. */
  label: string;
  /** Short base..tip shas, shown under the title. */
  range: string;
  files: FileDiff[];
  mode: DiffMode;
  /** Highlighted file in the list, and the file whose patch is open. */
  selected: number;
  /** First file row shown in the list. */
  listScroll: number;
  /** First patch line shown. */
  patchScroll: number;
};

/** What one key did in the diff viewer: stay open with a new state, or close back to the runs. */
export type DiffKeyResult = { kind: "stay"; viewer: DiffViewer } | { kind: "close" };

/** Where a run's diff comes from: the task's pinned revision and the run's committed tip. */
export type DiffRange = {
  baseSha: string;
  tipSha: string;
};
