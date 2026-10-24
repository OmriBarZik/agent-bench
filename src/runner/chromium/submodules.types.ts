/** A submodule that has a checkout, relative to the superproject. */
export type SubmoduleCheckout = {
  path: string;
  /** True when that checkout has tracked edits or untracked files. */
  dirty: boolean;
};
