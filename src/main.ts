#!/usr/bin/env bun
/**
 * Benchmark runner: tasks × configs × repeats, one `claude -p` session per run.
 *
 *   bun src/main.ts [--tasks tasks.json] [--configs configs.json] [--repeats 3]
 *                     [--only-task id] [--only-config id] [--timeout-min 60] [--sync] [--force]
 *
 * tasks.json:   [{ "taskId", "prompt", "chromiumSha", "title"?, "difficulty"?, "scoring"? }]
 * configs.json: [{ "configId", "description"?, "model"?, "mcpConfig"?: [paths],
 *                  "strictMcpConfig"?, "allowedTools"?: [..], "disallowedTools"?: [..],
 *                  "permissionMode"?, "extraFiles"?: [paths hashed into config_hash] }]
 *
 * Per run (src/runner/run-one.ts): reset src/ to the task's SHA, startRun, run claude with
 * BENCH_RUN_ID + the tool-log hooks, copy the transcript into runs/<run_id>/, finishRun.
 * Scoring is not done here: success/score stay NULL.
 */
import { join } from "node:path";
import { parseArgs } from "node:util";
import { openDb, upsertConfig, upsertTask } from "./db";
import { BENCH_DIR, CHROMIUM_SRC } from "./paths";
import { loadSelection, toConfigRow } from "./runner/bench-config";
import { hasUncommittedChanges } from "./runner/chromium";
import { claudeVersion } from "./runner/claude";
import { runOne } from "./runner/run-one";

const { values: args } = parseArgs({
  options: {
    tasks: { type: "string", default: join(BENCH_DIR, "tasks.json") },
    configs: { type: "string", default: join(BENCH_DIR, "configs.json") },
    repeats: { type: "string", default: "1" },
    "only-task": { type: "string" },
    "only-config": { type: "string" },
    "timeout-min": { type: "string", default: "60" },
    sync: { type: "boolean", default: false }, // run `gclient sync -D` after each checkout
    force: { type: "boolean", default: false }, // allow wiping uncommitted changes in src/
  },
});

async function main() {
  const { tasks, configs } = await loadSelection({
    tasksPath: args.tasks,
    configsPath: args.configs,
    onlyTask: args["only-task"],
    onlyConfig: args["only-config"],
  });
  const repeats = Number(args.repeats);

  if (!args.force && (await hasUncommittedChanges())) {
    throw new Error(`${CHROMIUM_SRC} has uncommitted changes; commit/stash them or pass --force`);
  }

  const options = {
    claudeVersion: await claudeVersion(),
    timeoutMs: Number(args["timeout-min"]) * 60_000,
    sync: args.sync,
  };
  const db = openDb();
  for (const task of tasks) upsertTask({ db, task });
  for (const benchConfig of configs) upsertConfig({ db, config: await toConfigRow(benchConfig) });

  const total = tasks.length * configs.length * repeats;
  let runIndex = 0;
  for (const task of tasks) {
    for (const config of configs) {
      for (let repeat = 0; repeat < repeats; repeat++) {
        console.log(`[${++runIndex}/${total}] ${task.taskId} × ${config.configId} #${repeat}`);
        const { runId, result, seconds } = await runOne({ db, task, config, repeat, options });
        const cost = result.total_cost_usd != null ? `, $${result.total_cost_usd.toFixed(2)}` : "";
        console.log(`  ${runId} ${result.is_error ? "crashed" : "done"} in ${seconds}s${cost}`);
      }
    }
  }
  db.close();
}

if (import.meta.main) {
  await main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
