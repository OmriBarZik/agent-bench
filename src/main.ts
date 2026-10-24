#!/usr/bin/env bun
import { join } from "node:path";
import { parseArgs } from "node:util";
import { openDb, upsertConfig, upsertTask } from "./db/db";
import { BENCH_DIR, CHROMIUM_SRC } from "./paths";
import { loadSelection, toConfigRow } from "./runner/bench-config/bench-config";
import { claudeVersion } from "./runner/claude/claude";
import { hasUncommittedChanges } from "./runner/chromium/chromium";
import { judgementText } from "./runner/judge/judge-result";
import { runOne } from "./runner/run-one/run-one";
import { BenchmarkShutdown, watchForShutdown } from "./runner/shutdown/shutdown";

const { values: args } = parseArgs({
  options: {
    tasks: { type: "string", default: join(BENCH_DIR, "configs/benchmark-tasks.json") },
    configs: { type: "string", default: join(BENCH_DIR, "configs/benchmark-setup.json") },
    repeats: { type: "string", default: "1" },
    "only-task": { type: "string" },
    "only-config": { type: "string" },
    "timeout-min": { type: "string", default: "60" },
    "judge-model": { type: "string", default: "claude-sonnet-5-5" },
    sync: { type: "boolean", default: false }, // run `gclient sync -D` after each checkout
    force: { type: "boolean", default: false }, // allow wiping uncommitted changes in src/
  },
});

/**
 * Benchmark runner: tasks × configs × repeats, one `claude -p` session per run.
 *
 *   bun src/main.ts [--tasks configs/benchmark-tasks.json] [--configs configs/benchmark-setup.json] [--repeats 3]
 *                     [--only-task id] [--only-config id] [--timeout-min 60] [--judge-model claude-sonnet-5-5]
 *                     [--sync] [--force]
 *
 * configs/benchmark-tasks.json: [{ "taskId", "promptFile", "judgePromptFile", "successThreshold",
 *                              "chromiumSha", "title"?, "difficulty"?, "scoring"? }]
 * configs/benchmark-setup.json: [{ "configId", "description"?, "model"?, "mcpConfig"?: [paths],
 *                              "strictMcpConfig"?, "allowedTools"?: [..], "disallowedTools"?: [..],
 *                              "permissionMode"?, "extraFiles"?: [paths hashed into config_hash] }]
 *
 * Per run (src/runner/run-one/run-one.ts): reset src/ to the task's SHA, check out a branch named
 * after the run id, startRun, run claude with BENCH_RUN_ID + the tool-log hooks, copy the
 * transcript into runs/<run_id>/, commit the checkout onto that branch, finishRun, then a
 * second read-only claude session scores the tree with a decimal from 0 to 1 (for example 0.2 or 0.743).
 * That session is a judge_runs row: its own cost, tokens, and duration. success is 1 when the
 * score is at least the task's successThreshold. The judge does not record tool calls.
 *
 * Ctrl+C stops the benchmark. The run in progress is stored as cancelled (finished time, duration,
 * and any cost, turns, and tokens already reported) and later runs are not started. Exit code 130.
 * A second Ctrl+C exits immediately.
 */
async function main() {
  let db: ReturnType<typeof openDb> | undefined;
  const shutdown = watchForShutdown({
    onFirst: () => {
      console.error("\nStopping the benchmark. Press Ctrl+C again to force exit.");
    },
    onForce: () => {
      console.error("\nForced exit.");
      try {
        db?.close();
      } catch {
        // The process is exiting. A close failure must not replace the cancel.
      }
      process.exit(130);
    },
  });
  let stopped = false;

  try {
    const { tasks, configs } = await loadSelection({
      tasksPath: args.tasks,
      configsPath: args.configs,
      onlyTask: args["only-task"],
      onlyConfig: args["only-config"],
    });
    const repeats = Number(args.repeats);

    if (shutdown.signal.aborted) {
      stopped = true;
    } else if (!args.force && (await hasUncommittedChanges())) {
      throw new Error(`${CHROMIUM_SRC} has uncommitted changes; commit/stash them or pass --force`);
    } else {
      const options = {
        claudeVersion: await claudeVersion(),
        timeoutMs: Number(args["timeout-min"]) * 60_000,
        sync: args.sync,
        judgeModel: args["judge-model"] ?? "claude-sonnet-5-5",
      };
      db = openDb();
      for (const task of tasks) upsertTask({ db, task });
      for (const benchConfig of configs) upsertConfig({ db, config: await toConfigRow(benchConfig) });

      const total = tasks.length * configs.length * repeats;
      let runIndex = 0;
      for (const task of tasks) {
        for (const config of configs) {
          for (let repeat = 0; repeat < repeats; repeat++) {
            if (shutdown.signal.aborted) {
              stopped = true;
              break;
            }

            console.log(`[${++runIndex}/${total}] ${task.taskId} × ${config.configId} #${repeat}`);
            const { runId, result, seconds, artifact, judge, cancelled } = await runOne({
              db,
              task,
              config,
              repeat,
              options,
              signal: shutdown.signal,
            });
            const cost = result.total_cost_usd != null ? `, $${result.total_cost_usd.toFixed(2)}` : "";
            const files =
              artifact.changedFiles.length === 0 ? "no file changes" : `${artifact.changedFiles.length} files`;

            if (cancelled || !judge) {
              const judgeNote = judge ? ", judge cancelled" : "";
              console.log(`  ${runId} cancelled in ${seconds}s${cost}, ${files}${judgeNote}`);
              stopped = true;
              break;
            }

            const judged = judgementText({ judge, successThreshold: task.successThreshold });
            console.log(
              `  ${runId} ${result.is_error ? "crashed" : "done"} in ${seconds}s${cost}, ${files}, ${judged}`,
            );

            if (shutdown.signal.aborted) {
              stopped = true;
              break;
            }
          }

          if (stopped) {
            break;
          }
        }

        if (stopped) {
          break;
        }
      }
    }
  } catch (error) {
    if (!shutdown.signal.aborted) {
      throw error;
    }

    if (!(error instanceof BenchmarkShutdown)) {
      console.error(error instanceof Error ? error.message : error);
    }

    stopped = true;
  } finally {
    db?.close();
    shutdown.stop();
  }

  if (stopped) {
    process.exit(130);
  }
}

if (import.meta.main) {
  await main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
