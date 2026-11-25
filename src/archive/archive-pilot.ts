#!/usr/bin/env bun
import { join } from "node:path";
import { parseArgs } from "node:util";
import { archiveRuns, listRunVersions, openDb, promptVersion, setRunSetupHashes } from "../db/db";
import { BENCH_DIR } from "../paths";
import { loadSelection } from "../runner/bench-config/bench-config";
import { currentSetups } from "./current-setups";
import { missingSetupHashes } from "./fill-setup-hashes";
import { staleRunIds } from "./stale-runs";

/**
 * Tags every run that no longer matches today's benchmark as `pilot`: kept in the DB and in the Runs tab, but left
 * out of the dashboard snapshot and `bun run export`. A run is stale when its agent prompt or judge prompt is not
 * the task's current one, or its setup is not the config's current one (`runs.config_hash`, and `runs.setup_hash`,
 * the hash of the claude command line). Runs with no setup_hash get one from their `command.json` first. The
 * current versions are hashed from the input files, so run this after editing a prompt or a config and before the
 * new batch. Nothing is deleted, and --dry-run writes nothing.
 *
 *   bun run runs:archive [--dry-run]   # BENCH_DB_PATH picks another database
 */
async function main() {
  const { values: args } = parseArgs({ options: { "dry-run": { type: "boolean", default: false } } });
  const dryRun = args["dry-run"];
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
  const filled = await missingSetupHashes(db);
  console.log(`${dryRun ? "would fill" : "filled"} setup_hash on ${filled.size} runs from command.json`);

  if (!dryRun) {
    setRunSetupHashes({ db, hashes: filled });
  }

  const runs = listRunVersions(db).map((run) => ({
    ...run,
    setupHash: run.setupHash ?? filled.get(run.runId) ?? null,
  }));
  const stale = staleRunIds({ runs, current, setups: await currentSetups(selection) });

  for (const group of stale.groups) {
    console.log(`  ${group.label}: ${group.count}`);
  }

  if (dryRun) {
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
