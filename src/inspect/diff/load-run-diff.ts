import { $ } from "bun";
import { openDb, taskChromiumSha } from "../../db/db";
import type { RunChoice } from "../list/select-state.types";
import type { DiffRange } from "./run-diff.types";

/**
 * The task's pinned revision and the run's committed tip. Throws with a message for the notice line
 * when there is no diff to show. Reads git objects only, so the checkout and its branch stay as they are.
 */
export function runDiffRange(choice: RunChoice): DiffRange {
  if (!choice.commitSha) {
    throw new Error("this run committed no changes");
  }

  const baseSha = pinnedSha(choice.taskId);

  if (!baseSha) {
    throw new Error(`task ${choice.taskId} has no pinned Chromium SHA in the database`);
  }

  return { baseSha, tipSha: choice.commitSha };
}

/** `git diff` for a run's patch. `--submodule=diff` expands a moved gitlink into that submodule's own files. */
export function runDiffCommand(range: DiffRange): string[] {
  return [
    "git",
    "-c",
    "core.quotePath=false",
    "diff",
    "--no-color",
    "--no-ext-diff",
    "--no-textconv",
    "--find-renames",
    "--submodule=diff",
    range.baseSha,
    range.tipSha,
    "--",
  ];
}

/** The run's whole patch as `git diff` prints it, read without checking anything out. */
export async function readRunPatch({ repo, range }: { repo: string; range: DiffRange }): Promise<string> {
  const result = await $`${runDiffCommand(range)}`.cwd(repo).nothrow().quiet();

  if (result.exitCode !== 0) {
    const reason = result.stderr.toString().trim().split("\n")[0] ?? "";

    throw new Error(`git diff failed in ${repo}${reason === "" ? "" : `: ${reason}`}`);
  }

  return result.stdout.toString();
}

function pinnedSha(taskId: string): string | null {
  const db = openDb();

  try {
    return taskChromiumSha({ db, taskId });
  } finally {
    db.close();
  }
}
