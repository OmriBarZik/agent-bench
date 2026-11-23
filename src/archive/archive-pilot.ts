#!/usr/bin/env bun
import { join } from "node:path";
import { parseArgs } from "node:util";
import { archiveRuns, listRunVersions, openDb, promptVersion } from "../db/db";
import { BENCH_DIR } from "../paths";
import { loadSelection } from "../runner/bench-config/bench-config";
import { staleRunIds } from "./stale-runs";

/**
 * Tags every run whose agent prompt or judge prompt is not the task's current one as `pilot`: kept in the DB and
 * in the Runs tab, but left out of the dashboard snapshot and `bun run export`. The current versions are hashed
 * from the prompt files, so run this after editing a prompt and before the new batch. Nothing is deleted.
 *
 *   bun run runs:archive [--dry-run]   # BENCH_DB_PATH picks another database
 */
async function main() {
  const { values: args } = parseArgs({ options: { "dry-run": { type: "boolean", default: false } } });
  const selection = await loadSelection({
    tasksPath: join(BENCH_DIR, "configs/benchmark-tasks.json"),
    configsPath: join(BENCH_DIR, "configs/benchmark-setup.json"),
  });
  const current = selection.tasks.map((task) => ({
    taskId: task.taskId,
    promptVersion: promptVersion(task.prompt),
    judgePromptVersion: promptVersion(task.judgePrompt),
  }));
  const db = openDb();
  const stale = staleRunIds({ runs: listRunVersions(db), current });

  for (const group of stale.groups) {
    console.log(`  ${group.label}: ${group.count}`);
  }

  if (args["dry-run"]) {
    console.log(`would archive ${stale.runIds.length} runs as pilot`);
    db.close();

    return;
  }

  const changed = archiveRuns({ db, runIds: stale.runIds, batch: "pilot" });
  db.close();
  console.log(`archived ${changed} runs as pilot`);
}

if (import.meta.main) {
  await main();
}
