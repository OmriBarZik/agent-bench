/** One gitlink row from `git diff --raw -z`. */
export type GitlinkChange = {
  /** Path relative to the repo the diff was run in. */
  path: string;
  /** Commit before the change, or null when the gitlink was added. */
  previousSha: string | null;
  /** Commit after the change, or null when the gitlink was removed. */
  sha: string | null;
};

/** A submodule commit this machine has that the builder needs before it can check the branch out. */
export type SubmoduleCommit = {
  /** Path relative to the Chromium checkout. */
  path: string;
  sha: string;
};
