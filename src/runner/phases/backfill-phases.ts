#!/usr/bin/env bun
import { join } from "node:path";
import { parseArgs } from "node:util";
import { listRunsWithoutPhases, openDb } from "../../db/db";
import { RUNS_DIR } from "../../paths";
import { storeRunPhases } from "./store-phases";

/**
 * Fills run_phases for finished runs that have none, from runs/<run_id>/transcript.jsonl. Safe to run again:
 * it only reads transcripts and adds rows. New runs get their rows from the runner.
 *
 *   bun run phases:backfill [--runs-dir path]   # BENCH_DB_PATH picks another database
 */
function main() {
  const { values: args } = parseArgs({ options: { "runs-dir": { type: "string", default: RUNS_DIR } } });
  const runsDir = args["runs-dir"];
  const db = openDb();
  const runs = listRunsWithoutPhases(db);
  let stored = 0;

  for (const run of runs) {
    if (storeRunPhases({ db, runId: run.runId, outDir: join(runsDir, run.runId), costUsd: run.costUsd })) {
      stored += 1;
    }
  }

  db.close();
  console.log(`stored phases for ${stored} of ${runs.length} runs (the rest have no transcript in ${runsDir})`);
}

if (import.meta.main) {
  main();
}
