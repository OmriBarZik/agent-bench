import { $ } from "bun";
import { CHROMIUM_SRC } from "../../paths";

const DIFF_MAX_CHARS = 60_000;

/**
 * Unified diff from `baseSha` to the working tree, including submodule patches.
 * A long patch is cut so the judge prompt stays bounded; the stat summary is kept in front.
 * `--ignore-submodules=none` is required because Chromium sets `diff.ignoreSubmodules=dirty`,
 * which otherwise hides edits inside a submodule until its gitlink commit changes.
 */
export async function diffAgainst(baseSha: string): Promise<string> {
  const stat = (
    await $`git diff --stat --find-renames --submodule=diff --ignore-submodules=none ${baseSha}`
      .cwd(CHROMIUM_SRC)
      .text()
  ).trim();
  const patch = await $`git diff --find-renames --submodule=diff --ignore-submodules=none ${baseSha}`
    .cwd(CHROMIUM_SRC)
    .text();

  if (stat === "" && patch.trim() === "") {
    return "";
  }

  if (patch.length <= DIFF_MAX_CHARS) {
    return `${stat}\n\n${patch}`.trim();
  }

  return `${stat}\n\n${patch.slice(0, DIFF_MAX_CHARS)}\n…(diff truncated; read the changed files)`;
}
