import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { countSetupToolCalls, saveRunFindings } from "../../db/db";
import { TRANSCRIPT_FILE } from "../../paths";
import { findFirstFiles } from "./find-files";

/**
 * Stores run_findings for a finished run: how often it called its setup's tools, and when it first opened the
 * game's sources and a DevTools panel registration. Never throws: these are dashboard extras, so a missing or
 * unreadable transcript only logs a warning. Returns whether it stored.
 */
export function storeRunFindings({
  db,
  runId,
  outDir,
  setupTools,
}: {
  db: Database;
  runId: string;
  outDir: string;
  setupTools?: string[];
}): boolean {
  try {
    const transcriptPath = join(outDir, TRANSCRIPT_FILE);

    if (!existsSync(transcriptPath)) {
      return false;
    }

    const files = findFirstFiles(readFileSync(transcriptPath, "utf8").split("\n"));
    const setupToolCalls = setupTools && setupTools.length > 0 ? countSetupToolCalls({ db, runId, setupTools }) : null;
    saveRunFindings({ db, runId, findings: { setupToolCalls, ...files } });

    if (setupToolCalls === 0) {
      console.warn(`  !! ${runId} never called its setup's tools (${setupTools?.join(", ")})`);
    }

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  findings for ${runId} were not stored: ${message}`);

    return false;
  }
}
