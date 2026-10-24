import { $ } from "bun";
import type { ChangedFile, RunArtifact } from "../db.types";
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

/** Points `branch` at the current HEAD (the task SHA) and checks it out. Call after resetChromium. */
export async function createRunBranch(branch: string) {
  await $`git switch --quiet -C ${branch}`.cwd(CHROMIUM_SRC).quiet();
}

/** Short names of local branches in the Chromium checkout. */
export async function listLocalBranches(): Promise<string[]> {
  // Bun shell parses "(" as syntax, so the git format string has to be a JS value.
  const format = "%(refname:short)";
  const raw = await $`git for-each-ref --format=${format} refs/heads`.cwd(CHROMIUM_SRC).text();

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

/** Checks out an existing local branch in the Chromium tree. `force` discards tracked changes that block the switch. */
export async function checkoutBranch({ branch, force = false }: { branch: string; force?: boolean }) {
  const branches = await listLocalBranches();

  if (!branches.includes(branch)) {
    throw new Error(`branch ${branch} does not exist in ${CHROMIUM_SRC}`);
  }

  if (force) {
    await $`git switch --quiet --force ${branch}`.cwd(CHROMIUM_SRC).quiet();

    return;
  }

  await $`git switch --quiet ${branch}`.cwd(CHROMIUM_SRC).quiet();
}

/**
 * Commits the checkout onto `branch` and returns every path that differs from `baseSha`.
 * The agent is not asked to do this. Hooks and signing are skipped: depot_tools rejects
 * anything that is not a Chromium CL, and a signing prompt would stall the run.
 */
export async function commitRunChanges({
  branch,
  baseSha,
  message,
}: {
  branch: string;
  baseSha: string;
  message: string;
}): Promise<RunArtifact> {
  await $`git switch --quiet ${branch}`.cwd(CHROMIUM_SRC).quiet();
  await $`git add -A`.cwd(CHROMIUM_SRC).quiet();
  // Index vs the task SHA, so files the agent already committed on this branch are included.
  const raw = await $`git diff --cached --name-status -z ${baseSha} --`.cwd(CHROMIUM_SRC).text();
  const staged = await $`git diff --cached --quiet`.cwd(CHROMIUM_SRC).nothrow().quiet();

  if (staged.exitCode === 1) {
    await $`git -c user.name=agent-bench -c user.email=agent-bench@localhost -c commit.gpgsign=false commit --no-verify -m ${message}`
      .cwd(CHROMIUM_SRC)
      .quiet();
  } else if (staged.exitCode !== 0) {
    throw new Error(`git diff --cached --quiet failed in ${CHROMIUM_SRC} (exit ${staged.exitCode})`);
  }

  const head = (await $`git rev-parse --verify HEAD`.cwd(CHROMIUM_SRC).text()).trim();
  const base = (await $`git rev-parse --verify ${baseSha}`.cwd(CHROMIUM_SRC).text()).trim();

  return { commitSha: head === base ? null : head, changedFiles: parseNameStatus(raw) };
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
