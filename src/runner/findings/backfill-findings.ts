#!/usr/bin/env bun
import { join } from "node:path";
import { parseArgs } from "node:util";
import { listRunsWithoutFindings, openDb } from "../../db/db";
import { BENCH_DIR, RUNS_DIR } from "../../paths";
import type { BenchConfigEntry } from "../bench-config/bench-config.types";
import { storeRunFindings } from "./store-findings";

/**
 * Fills run_findings for finished runs that have none, from runs/<run_id>/transcript.jsonl and tool_calls.
 * Safe to run again: it only reads and adds rows. New runs get their row from the runner.
 *
 *   bun run findings:backfill [--runs-dir path]   # BENCH_DB_PATH picks another database
 */
async function main() {
  const { values: args } = parseArgs({ options: { "runs-dir": { type: "string", default: RUNS_DIR } } });
  const configs: BenchConfigEntry[] = await Bun.file(join(BENCH_DIR, "configs/benchmark-setup.json")).json();
  const setupToolsById = new Map(configs.map((config) => [config.configId, config.setupTools]));
  const db = openDb();
  const runs = listRunsWithoutFindings(db);
  let stored = 0;

  for (const run of runs) {
    const outDir = join(args["runs-dir"], run.runId);

    if (storeRunFindings({ db, runId: run.runId, outDir, setupTools: setupToolsById.get(run.configId) })) {
      stored += 1;
    }
  }

  db.close();
  console.log(`stored findings for ${stored} of ${runs.length} runs (the rest have no transcript)`);
}

if (import.meta.main) {
  await main();
}
