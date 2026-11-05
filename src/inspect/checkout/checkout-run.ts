import { CHROMIUM_SRC } from "../../paths";
import { checkoutBranch, hasUncommittedChanges } from "../../runner/chromium/chromium";
import { loadChoices } from "../list/load-choices";
import type { RunChoice } from "../list/select-state.types";
import { changedFileLine } from "../render/format-run";

/** Finds a run by branch or run id in the database and checks its branch out (`bun run start --checkout`). */
export async function checkOutNamedRun({ name, force }: { name: string; force: boolean }): Promise<void> {
  const choices = await loadChoices();
  const chosen = choices.find((choice) => choice.branch === name || choice.runId === name);

  if (!chosen) {
    throw new Error(`no run with branch ${name} in the database`);
  }

  await checkOutRun({ choice: chosen, force });
}

/**
 * Checks the run's branch out in CHROMIUM_SRC and prints what it changed.
 * Refuses when the tree has uncommitted tracked changes, unless `force`, which discards them.
 */
export async function checkOutRun({ choice, force }: { choice: RunChoice; force: boolean }): Promise<void> {
  if (!choice.present) {
    throw new Error(`branch ${choice.branch} does not exist in ${CHROMIUM_SRC}`);
  }

  if (!force && (await hasUncommittedChanges())) {
    throw new Error(`${CHROMIUM_SRC} has uncommitted changes; commit/stash them or pass --force`);
  }

  await checkoutBranch({ branch: choice.branch, force });
  printCheckedOut(choice);
}

function printCheckedOut(choice: RunChoice) {
  const count = choice.changedFiles.length;
  const files = count === 1 ? "1 file" : `${count} files`;
  console.log(`Checked out ${choice.branch}`);
  console.log(`${CHROMIUM_SRC}`);
  console.log(`${choice.taskId} × ${choice.configId} · ${choice.status} · ${files}`);

  for (const file of choice.changedFiles.slice(0, 20)) {
    console.log(`  ${changedFileLine(file)}`);
  }

  if (count > 20) {
    console.log(`  ${count - 20} more`);
  }
}
