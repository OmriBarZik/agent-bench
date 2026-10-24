import { $ } from "bun";

/**
 * Commits the index when it differs from HEAD.
 * Returns false when there is nothing staged. Hooks and signing are skipped:
 * depot_tools rejects anything that is not a Chromium CL, and a signing prompt would stall the run.
 */
export async function commitStaged({ repo, message }: { repo: string; message: string }): Promise<boolean> {
  // `all` would hide a staged submodule gitlink. `none` still ignores a dirty worktree when comparing the index.
  const staged = await $`git diff --cached --quiet --ignore-submodules=none`.cwd(repo).nothrow().quiet();

  if (staged.exitCode === 1) {
    await $`git -c user.name=agent-bench -c user.email=agent-bench@localhost -c commit.gpgsign=false commit --no-verify -m ${message}`
      .cwd(repo)
      .quiet();

    return true;
  }

  if (staged.exitCode !== 0) {
    throw new Error(`git diff --cached --quiet failed in ${repo} (exit ${staged.exitCode})`);
  }

  return false;
}
