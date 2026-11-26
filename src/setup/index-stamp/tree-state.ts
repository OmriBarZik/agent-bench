import { $ } from "bun";
import type { TreeState } from "./index-stamp.types";

/**
 * Reads HEAD and every status line of the checkout. `--ignore-submodules=none` overrides Chromium's
 * `diff.ignoreSubmodules=dirty`, so a submodule with edits, untracked files, or a HEAD off its gitlink is listed.
 */
export async function readTreeState(checkout: string): Promise<TreeState> {
  const sha = (await $`git rev-parse HEAD`.cwd(checkout).text()).trim();
  const status = await $`git status --porcelain --untracked-files=normal --ignore-submodules=none`.cwd(checkout).text();
  const dirty = status.split("\n").filter((line) => line.trim() !== "");

  return { sha, dirty };
}
