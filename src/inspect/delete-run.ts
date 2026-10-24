import { deleteRun, openDb } from "../db/db";
import type { DeleteIntent } from "./delete-run.types";
import type { RunChoice, SelectAction } from "./select-state.types";

/**
 * First ctrl-x arms the highlighted run. A second ctrl-x on that same run removes it.
 * Any other key, or ctrl-x on a different run, does not remove the armed one.
 */
export function deleteIntent({
  armedRunId,
  action,
  runId,
}: {
  armedRunId: string | null;
  action: SelectAction;
  runId: string | null;
}): DeleteIntent {
  if (action !== "delete" || runId == null) {
    return { armedRunId: null, remove: false };
  }

  if (armedRunId === runId) {
    return { armedRunId: null, remove: true };
  }

  return { armedRunId: runId, remove: false };
}

/** Deletes the run from the database and drops it from the on-screen list. Returns the notice to show. */
export function removeListedRun({ choices, chosen }: { choices: RunChoice[]; chosen: RunChoice }): string {
  try {
    forgetRun(chosen.runId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "could not remove the run";

    return message;
  }

  const index = choices.indexOf(chosen);

  if (index !== -1) {
    choices.splice(index, 1);
  }

  return `removed ${chosen.taskId} × ${chosen.configId} from the database`;
}

function forgetRun(runId: string) {
  const db = openDb();

  try {
    deleteRun({ db, runId });
  } finally {
    db.close();
  }
}
