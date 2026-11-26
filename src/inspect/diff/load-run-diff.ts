import { $ } from "bun";
import { openDb, taskChromiumSha } from "../../db/db";
import type { RunChoice } from "../list/select-state.types";
import { openDiffViewer } from "./diff-viewer";
import type { DiffRange, DiffViewer, FileDiff } from "./run-diff.types";
import { splitPatch } from "./split-patch";

/**
 * The task's pinned revision and the run's committed tip, or why there is no diff to show.
 * Reads git objects only, so the checkout and its branch stay as they are.
 */
export function runDiffRange(choice: RunChoice): DiffRange | string {
  if (!choice.commitSha) {
    return "this run committed no changes";
  }

  const baseSha = pinnedSha(choice.taskId);

  if (!baseSha) {
    return `task ${choice.taskId} has no pinned Chromium SHA in the database`;
  }

  return { baseSha, tipSha: choice.commitSha };
}

/**
 * Every file the run changed, with its patch, read from git without checking anything out.
 * `--submodule=diff` expands a moved gitlink into that submodule's own file diffs, prefixed with its path.
 */
export async function loadRunDiff({ repo, range }: { repo: string; range: DiffRange }): Promise<FileDiff[]> {
  const result =
    await $`git -c core.quotePath=false diff --no-color --no-ext-diff --no-textconv --find-renames --submodule=diff ${range.baseSha} ${range.tipSha} --`
      .cwd(repo)
      .nothrow()
      .quiet();

  if (result.exitCode !== 0) {
    const reason = result.stderr.toString().trim().split("\n")[0] ?? "";

    throw new Error(`git diff failed in ${repo}${reason === "" ? "" : `: ${reason}`}`);
  }

  return splitPatch(result.stdout.toString());
}

function pinnedSha(taskId: string): string | null {
  const db = openDb();

  try {
    return taskChromiumSha({ db, taskId });
  } finally {
    db.close();
  }
}

/** Loads `choice`'s diff into a viewer on its file list. Throws with a message for the notice line. */
export async function openRunDiff({ choice, repo }: { choice: RunChoice; repo: string }): Promise<DiffViewer> {
  const range = runDiffRange(choice);

  if (typeof range === "string") {
    throw new Error(range);
  }

  return openDiffViewer({ choice, range, files: await loadRunDiff({ repo, range }) });
}
