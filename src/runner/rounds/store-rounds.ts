import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { saveRunRounds } from "../../db/db";
import { TRANSCRIPT_FILE } from "../../paths";
import { splitRounds } from "./split-rounds";

/**
 * Splits a finished run's transcript into rounds and stores them. Never throws: the rounds are a dashboard extra,
 * so a missing or unreadable transcript only logs a warning. Returns whether it stored.
 */
export function storeRunRounds({
  db,
  runId,
  outDir,
  costUsd,
  setupTools = [],
  finalPaths,
}: {
  db: Database;
  runId: string;
  outDir: string;
  costUsd: number | null;
  setupTools?: string[];
  finalPaths: string[];
}): boolean {
  try {
    const transcriptPath = join(outDir, TRANSCRIPT_FILE);

    if (!existsSync(transcriptPath)) {
      return false;
    }

    const lines = readFileSync(transcriptPath, "utf8").split("\n");
    const rounds = splitRounds({ lines, costUsd, setupTools, finalPaths: new Set(finalPaths) });
    saveRunRounds({ db, runId, rounds });

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  round split for ${runId} was not stored: ${message}`);

    return false;
  }
}
