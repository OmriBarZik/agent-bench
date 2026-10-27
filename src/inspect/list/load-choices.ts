import { existsSync } from "node:fs";
import { join } from "node:path";
import { listRunBranches, openDb } from "../../db/db";
import type { RunBranchRow } from "../../db/db.types";
import { JUDGE_TRANSCRIPT_FILE, RUNS_DIR, TRANSCRIPT_FILE } from "../../paths";
import { currentBranch, listLocalBranches } from "../../runner/chromium/chromium";
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
    transcriptPath: artifactFile({ row, fileName: TRANSCRIPT_FILE }),
    judgeTranscriptPath: artifactFile({ row, fileName: JUDGE_TRANSCRIPT_FILE }),
  };
}

/** A copied session log for a run, or null when that file was not saved. */
function artifactFile({ row, fileName }: { row: RunBranchRow; fileName: string }): string | null {
  const directory = row.artifactsPath ? row.artifactsPath : join(RUNS_DIR, row.runId);
  const path = join(directory, fileName);

  if (!existsSync(path)) {
    return null;
  }

  return path;
}
