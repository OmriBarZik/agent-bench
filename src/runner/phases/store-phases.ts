import type { Database } from "bun:sqlite";
import { saveRunPhases } from "../../db/db";
import { readRunPhases } from "./read-phases";

/**
 * Splits a finished run's transcript into discovery and validation and stores both rows. Never throws: the
 * split is a dashboard extra, so a missing or unreadable transcript only logs a warning. Returns whether it stored.
 */
export function storeRunPhases({
  db,
  runId,
  outDir,
  costUsd,
}: {
  db: Database;
  runId: string;
  outDir: string;
  costUsd: number | null;
}): boolean {
  try {
    const phases = readRunPhases({ outDir, costUsd });

    if (!phases) {
      return false;
    }

    saveRunPhases({ db, runId, phases });

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  phase split for ${runId} was not stored: ${message}`);

    return false;
  }
}
