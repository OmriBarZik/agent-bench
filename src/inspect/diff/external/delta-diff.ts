import { readRunPatch, runDiffRange } from "../load-run-diff";
import type { RunChoice } from "../../list/select-state.types";
import type { DeltaRun } from "./delta-diff.types";

/** How to install delta, shown when it is not on PATH. The Setups tab checks for it too. */
export const DELTA_INSTALL = "brew install git-delta";

/** Side by side with line numbers; `--navigate` makes n and N in the pager jump between files. */
export const DELTA_ARGS = ["--side-by-side", "--line-numbers", "--navigate", "--paging=always"];

/** delta's path, or a message saying how to install it. */
export function findDelta(): string {
  const delta = Bun.which("delta");

  if (!delta) {
    throw new Error(`delta is not installed · ${DELTA_INSTALL}`);
  }

  return delta;
}

/** delta and the patch it will show, both found before the TUI gives up the terminal so errors stay on screen. */
export async function prepareDelta({ choice, repo }: { choice: RunChoice; repo: string }): Promise<DeltaRun> {
  const delta = findDelta();
  const patch = await readRunPatch({ repo, range: runDiffRange(choice) });

  return { delta, patch, repo };
}

/**
 * Shows the patch in delta on the real terminal and waits until its pager is quit.
 * The caller must have handed the terminal over first; delta's pager reads keys from the tty itself.
 */
export async function runDelta({ delta, patch, repo }: DeltaRun): Promise<void> {
  const viewer = Bun.spawn([delta, ...DELTA_ARGS], {
    cwd: repo,
    stdin: new Blob([patch]),
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await viewer.exited;

  if (exitCode !== 0) {
    throw new Error(`delta exited ${exitCode}`);
  }
}
