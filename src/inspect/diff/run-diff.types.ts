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

/** Where a run's diff comes from: the task's pinned revision and the run's committed tip. */
export type DiffRange = {
  baseSha: string;
  tipSha: string;
};
