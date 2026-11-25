import type { Database } from "bun:sqlite";
import { join } from "node:path";
import { listRunsWithoutSetupHash } from "../db/db";
import { RUNS_DIR } from "../paths";
import { setupHash } from "../runner/setup-hash/setup-hash";

/**
 * The setup_hash of every run that has none, read from the command.json the runner saved next to it, keyed by run
 * id. A run with no command.json (it stopped before claude started) is left out. Nothing is written.
 */
export async function missingSetupHashes(db: Database): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();

  for (const run of listRunsWithoutSetupHash(db)) {
    const file = Bun.file(join(run.artifactsPath ?? join(RUNS_DIR, run.runId), "command.json"));

    if (!(await file.exists())) {
      continue;
    }

    const command: string[] = await file.json();
    hashes.set(run.runId, setupHash(command));
  }

  return hashes;
}
