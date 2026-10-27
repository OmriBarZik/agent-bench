import { $ } from "bun";
import type { ChangedFile, RunArtifact } from "../../db/db.types";
import { CHROMIUM_SRC } from "../../paths";
import { changedFilesSince } from "./diff/changed-files";
import { commitStaged } from "./git-commit";
import { commitDirtySubmodules, discardSubmoduleChanges, syncSubmodulesToHead } from "./submodules/submodules";

/**
 * Tracked changes in the Chromium checkout, including inside a checked-out submodule.
 * Untracked files are ignored. `--ignore-submodules=untracked` is required because Chromium sets
 * `diff.ignoreSubmodules=dirty`, which hides those edits from a plain `git status`.
 * Empty when the tree is clean.
 */
export async function uncommittedStatus(repo: string = CHROMIUM_SRC): Promise<string> {
  const status = await $`git status --porcelain --untracked-files=no --ignore-submodules=untracked`.cwd(repo).text();

  return status.trim();
}

/** True when `uncommittedStatus` reports tracked changes. */
export async function hasUncommittedChanges(repo: string = CHROMIUM_SRC): Promise<boolean> {
  const status = await uncommittedStatus(repo);

  return status !== "";
}

/**
 * Discards tracked changes and untracked (non-ignored) files in the superproject and every checked-out
 * submodule, then detaches at `sha` and points those submodules at the gitlinks recorded there.
 */
export async function resetChromium({
  sha,
  sync = false,
  repo = CHROMIUM_SRC,
}: {
  sha: string;
  sync?: boolean;
  repo?: string;
}) {
  await discardSubmoduleChanges(repo);
  await $`git reset --hard --quiet`.cwd(repo).quiet();
  await $`git clean -fdq`.cwd(repo).quiet();
  await $`git checkout --quiet --force --detach ${sha}`.cwd(repo).quiet();
  await syncSubmodulesToHead({ repo, force: true });

  if (sync) {
    await $`gclient sync -D --force`.cwd(repo).quiet();
  }
}

/** Points `branch` at the current HEAD (the task SHA) and checks it out. Call after resetChromium. */
export async function createRunBranch(branch: string) {
  await $`git switch --quiet -C ${branch}`.cwd(CHROMIUM_SRC).quiet();
}

/** Short names of local branches in the Chromium checkout. */
export async function listLocalBranches(repo: string = CHROMIUM_SRC): Promise<string[]> {
  // Bun shell parses "(" as syntax, so the git format string has to be a JS value.
  const format = "%(refname:short)";
  const raw = await $`git for-each-ref --format=${format} refs/heads`.cwd(repo).text();

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** The branch checked out in the Chromium tree, or null when HEAD is detached. */
export async function currentBranch(): Promise<string | null> {
  const name = (await $`git branch --show-current`.cwd(CHROMIUM_SRC).text()).trim();

  if (name === "") {
    return null;
  }

  return name;
}

/**
 * Checks out an existing local branch and the submodule commits it records.
 * `force` discards tracked changes, including inside submodules, that block the switch.
 */
export async function checkoutBranch({
  branch,
  force = false,
  repo = CHROMIUM_SRC,
}: {
  branch: string;
  force?: boolean;
  repo?: string;
}) {
  const branches = await listLocalBranches(repo);

  if (!branches.includes(branch)) {
    throw new Error(`branch ${branch} does not exist in ${repo}`);
  }

  if (force) {
    await discardSubmoduleChanges(repo);
    await $`git switch --quiet --force ${branch}`.cwd(repo).quiet();
  } else {
    await $`git switch --quiet ${branch}`.cwd(repo).quiet();
  }

  await syncSubmodulesToHead({ repo, force });
}

/**
 * Commits the checkout onto `branch` and returns every path that differs from `baseSha`,
 * including files inside submodules (prefixed with the submodule path). Submodule checkouts
 * are committed first. The agent is not asked to do this. Hooks and signing are skipped.
 */
export async function commitRunChanges({
  branch,
  baseSha,
  message,
  repo = CHROMIUM_SRC,
}: {
  branch: string;
  baseSha: string;
  message: string;
  repo?: string;
}): Promise<RunArtifact> {
  await $`git switch --quiet ${branch}`.cwd(repo).quiet();
  await commitDirtySubmodules({ repo, message });
  await $`git add -A`.cwd(repo).quiet();
  // Index vs the task SHA, so files the agent already committed on this branch are included.
  const changedFiles = await changedFilesSince({ repo, baseSha });
  await commitStaged({ repo, message });
  const head = (await $`git rev-parse --verify HEAD`.cwd(repo).text()).trim();
  const base = (await $`git rev-parse --verify ${baseSha}`.cwd(repo).text()).trim();

  return { commitSha: head === base ? null : head, changedFiles };
}

/**
 * Drops anything written after the run commit, including inside submodules, so a judge cannot leave edits.
 * A commit made inside a submodule is moved back to the gitlink the run commit records.
 */
export async function restoreCommittedTree(repo: string = CHROMIUM_SRC) {
  await discardSubmoduleChanges(repo);
  await $`git reset --hard --quiet`.cwd(repo).quiet();
  await $`git clean -fdq`.cwd(repo).quiet();
  await syncSubmodulesToHead({ repo, force: true });
}

/** Parses `git diff --name-status -z` into the file list stored on a run. */
export function parseNameStatus(raw: string): ChangedFile[] {
  const parts = raw.split("\0");

  if (parts.at(-1) === "") {
    parts.pop();
  }

  const changedFiles: ChangedFile[] = [];
  let index = 0;
  while (index < parts.length) {
    const kind = (parts[index] ?? "").charAt(0);

    if (kind === "R" || kind === "C") {
      changedFiles.push({
        status: kind,
        path: parts[index + 2] ?? "",
        previousPath: parts[index + 1] ?? "",
      });
      index += 3;

      continue;
    }

    changedFiles.push({ status: kind, path: parts[index + 1] ?? "" });
    index += 2;
  }

  return changedFiles;
}
