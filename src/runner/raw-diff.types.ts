/** One record from `git diff --raw -z`. */
export type RawDiffEntry = {
  /** Mode before the change. `000000` when the path was added. `160000` is a submodule gitlink. */
  oldMode: string;
  /** Mode after the change. `000000` when the path was deleted. */
  newMode: string;
  oldSha: string;
  newSha: string;
  /** Name-status token, including a rename or copy score (`R100`). */
  status: string;
  path: string;
  /** Set for a rename or copy. The path before the change. */
  previousPath?: string;
};
