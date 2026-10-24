import { existsSync } from "node:fs";
import { join } from "node:path";
import { listRunBranches, openDb } from "../db";
import type { RunBranchRow } from "../db.types";
import { RUNS_DIR } from "../paths";
import { currentBranch, listLocalBranches } from "../runner/chromium";
import type { RunChoice } from "./select-state.types";

/** Runs from SQLite, marked with whether the Chromium checkout still has that branch. */
export async function loadChoices(): Promise<RunChoice[]> {
  const rows = readRows();
  const branches = new Set(await listLocalBranches());
  const current = await currentBranch();

  return rows.map((row) => toChoice({ row, branches, current }));
}

function readRows(): RunBranchRow[] {
  const db = openDb();

  try {
    return listRunBranches(db);
  } finally {
    db.close();
  }
}

function toChoice({
  row,
  branches,
  current,
}: {
  row: RunBranchRow;
  branches: Set<string>;
  current: string | null;
}): RunChoice {
  return {
    ...row,
    present: branches.has(row.branch),
    current: row.branch === current,
    transcriptPath: transcriptFile(row),
  };
}

/** The copied session log for a run, or null when that file was not saved. */
function transcriptFile(row: RunBranchRow): string | null {
  const directory = row.artifactsPath ? row.artifactsPath : join(RUNS_DIR, row.runId);
  const path = join(directory, "transcript.jsonl");

  if (!existsSync(path)) {
    return null;
  }

  return path;
}
