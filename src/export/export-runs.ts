#!/usr/bin/env bun
import { join } from "node:path";
import { parseArgs } from "node:util";
import { openDb } from "../db/db";
import { BENCH_DIR, RUNS_DIR } from "../paths";
import { buildConfigRecords, buildTaskRecords } from "./catalog";
import { buildRunRecords } from "./run-records";
import { summarizeRuns } from "./summary";
import { writeExport } from "./write/write-export";

/**
 * Exports every task, config, and run in a form an AI agent can read: a README that explains the benchmark and
 * each field, a per task × config summary, tasks.json, configs.json, runs.jsonl, and bench-export.md with all of
 * it in one file to copy. Reads only; the database and runs/ are left as they are.
 *
 *   bun run export [--out exports/<timestamp>]   # BENCH_DB_PATH picks another database
 */
function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const { values: args } = parseArgs({
    options: { out: { type: "string", default: join(BENCH_DIR, "exports", stamp) } },
  });
  const db = openDb();
  const tasks = buildTaskRecords(db);
  const configs = buildConfigRecords(db);
  const runs = buildRunRecords({ db, runsDir: RUNS_DIR });
  db.close();

  const bundlePath = writeExport({ outDir: args.out, tasks, configs, runs, summary: summarizeRuns(runs) });
  console.log(`exported ${runs.length} runs to ${args.out}`);
  console.log(`one-file copy: ${bundlePath}`);
}

if (import.meta.main) {
  main();
}
