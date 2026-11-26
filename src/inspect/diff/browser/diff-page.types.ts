import type { FileDiff } from "../run-diff.types";

/** What the browser diff page shows: a heading, the commit range under it, and the run's patch. */
export type DiffPageInput = {
  title: string;
  subtitle: string;
  patch: string;
  /** The patch split per file, in `git diff` order, so the side tree matches the rendered files one to one. */
  files: FileDiff[];
  /** Key for the viewed checkboxes kept in the browser's localStorage. The run id and tip sha. */
  storageKey: string;
};

/** One file as the page script reads it: enough for the side tree, without the patch lines. */
export type PageFile = {
  path: string;
  status: string;
  previousPath?: string;
  added: number;
  removed: number;
};

/** The page's static parts, read from this folder. */
export type PageAssets = {
  css: string;
  script: string;
};
