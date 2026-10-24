import { $ } from "bun";
import { CHROMIUM_SRC } from "../paths";

/** True when tracked files in the Chromium checkout are modified (untracked files are ignored). */
export async function hasUncommittedChanges(): Promise<boolean> {
  const status = await $`git status --porcelain --untracked-files=no`.cwd(CHROMIUM_SRC).text();

  return status.trim() !== "";
}

/** Discards tracked changes and untracked (non-ignored) files, then detaches at `sha`. */
export async function resetChromium({ sha, sync = false }: { sha: string; sync?: boolean }) {
  await $`git reset --hard --quiet`.cwd(CHROMIUM_SRC).quiet();
  await $`git clean -fdq`.cwd(CHROMIUM_SRC).quiet();
  await $`git checkout --quiet --force --detach ${sha}`.cwd(CHROMIUM_SRC).quiet();
  if (sync) {
    await $`gclient sync -D --force`.cwd(CHROMIUM_SRC).quiet();
  }
}
