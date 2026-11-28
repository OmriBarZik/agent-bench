#!/usr/bin/env bun
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { ChangedFile } from "../../db/db.types";
import { listRunsWithoutRounds, openDb } from "../../db/db";
import { BENCH_DIR, RUNS_DIR } from "../../paths";
import { loadSelection } from "../bench-config/bench-config";
import { storeRunRounds } from "./store-rounds";

/**
 * Fills run_rounds, run_round_results and run_round_tools for finished runs that have none, from
 * runs/<run_id>/transcript.jsonl. Safe to run again: it only reads transcripts and adds rows. A config that is no
 * longer in configs/benchmark-setup.json has no setupTools, so its calls are stored with setup_tool = 0.
 *
 *   bun run rounds:backfill [--runs-dir path]   # BENCH_DB_PATH picks another database
 */
async function main() {
  const { values: args } = parseArgs({ options: { "runs-dir": { type: "string", default: RUNS_DIR } } });
  const runsDir = args["runs-dir"];
  const selection = await loadSelection({
    tasksPath: join(BENCH_DIR, "configs/benchmark-tasks.json"),
    configsPath: join(BENCH_DIR, "configs/benchmark-setup.json"),
  });
  const setupToolsByConfig = new Map(selection.configs.map((config) => [config.configId, config.setupTools ?? []]));
  const db = openDb();
  const runs = listRunsWithoutRounds(db);
  let stored = 0;

  for (const run of runs) {
    const changed = run.changedFiles ? (JSON.parse(run.changedFiles) as ChangedFile[]) : [];
    const finalPaths = changed.map((file) => file.path);
    const setupTools = setupToolsByConfig.get(run.configId) ?? [];

    if (
      storeRunRounds({
        db,
        runId: run.runId,
        outDir: join(runsDir, run.runId),
        costUsd: run.costUsd,
        setupTools,
        finalPaths,
      })
    ) {
      stored += 1;
    }
  }

  db.close();
  console.log(`stored rounds for ${stored} of ${runs.length} runs (the rest have no transcript in ${runsDir})`);
}

if (import.meta.main) {
  await main();
}
