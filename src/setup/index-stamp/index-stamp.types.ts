/** Written next to an index by its index script: what tree the index was built from. */
export type IndexStamp = {
  /** The indexer, e.g. `zoekt`, `codesearch`, `codebase-memory`. */
  tool: string;
  /** Absolute path of the checkout that was indexed. */
  checkout: string;
  /** Superproject HEAD at index time. */
  sha: string;
  /**
   * `git status --porcelain --ignore-submodules=none` lines at index time, so untracked files and a
   * submodule off its gitlink count. The index scripts refuse to run unless this is empty.
   */
  dirty: string[];
  /** ISO-8601 UTC time the index finished. */
  builtAt: string;
};

/** The checkout's HEAD and what `git status` reports, including submodules. */
export type TreeState = {
  sha: string;
  dirty: string[];
};
