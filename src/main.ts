#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { openDb, upsertConfig, upsertTask } from "./db/db";
import { checkOutNamedRun, checkOutRun } from "./inspect/checkout/checkout-run";
import { CHROMIUM_SRC } from "./paths";
import { toConfigRow } from "./runner/bench-config/bench-config";
import { claudeVersion } from "./runner/claude/claude";
import { confirmDiscardUncommittedChanges } from "./runner/chromium/confirm-discard";
import { uncommittedStatus } from "./runner/chromium/chromium";
import { blockerAlert } from "./runner/judge/result/judge-blockers";
import { judgementText } from "./runner/judge/result/judge-result";
import { runOne } from "./runner/run-one/run-one";
import { BenchmarkShutdown, watchForShutdown } from "./runner/shutdown/shutdown";
import { DEFAULT_CONFIGS_PATH, DEFAULT_TASKS_PATH, resolveStart } from "./start/resolve-start";
import { openRunClock } from "./terminal/run-clock";
import { setTerminalTitle } from "./terminal/terminal-title";
import { benchEndTitle } from "./terminal/title-text";

const { values: args } = parseArgs({
  allowNegative: true,
  options: {
    tasks: { type: "string", default: DEFAULT_TASKS_PATH },
    configs: { type: "string", default: DEFAULT_CONFIGS_PATH },
    repeats: { type: "string" }, // no default, so the picker knows whether it was passed
    "only-task": { type: "string", multiple: true },
    "only-config": { type: "string", multiple: true },
    "timeout-min": { type: "string", default: "60" },
    "judge-model": { type: "string", default: "claude-sonnet-5-5" },
    sync: { type: "boolean", default: false }, // run `gclient sync -D` after each checkout
    "auto-review": { type: "boolean", default: true }, // chrome-validate: the agent builds and checks its change
    force: { type: "boolean", default: false }, // wipe uncommitted changes in src/ without asking
    interactive: { type: "boolean", short: "i", default: false }, // open the TUI even with selection flags
    runs: { type: "boolean", default: false }, // open the TUI on the Runs tab
    setups: { type: "boolean", default: false }, // open the TUI on the Setups tab
    checkout: { type: "string" }, // check this run's branch out and exit, no TUI
    cli: { type: "boolean", default: false }, // never open the TUI
  },
});

/**
 * Benchmark runner: tasks × configs × repeats, one `claude -p` session per run.
 *
 *   bun run start [--tasks configs/benchmark-tasks.json] [--configs configs/benchmark-setup.json] [--repeats 3]
 *                     [--only-task id[,id]] [--only-config id[,id]] [--timeout-min 60] [--judge-model claude-sonnet-5-5]
 *                     [--sync] [--auto-review | --no-auto-review] [--force] [--interactive | --runs | --setups | --cli]
 *   bun run start --checkout <branch or run id> [--force]
 *
 * On a terminal with none of --only-task, --only-config, or --repeats, it opens a TUI with four tabs;
 * tab and shift-tab switch between them, and esc quits.
 *   Start: check the tasks and configs to run, set repeats, timeout, sync, and auto review, then enter starts. It prints
 *     the equivalent --cli command first.
 *   Runs: the runs in the database. Enter opens a menu of every action below, with submenus; esc goes back.
 *     Ctrl-o opens the run transcript in the browser, ctrl-e the judge session.
 *     Ctrl-r reloads the runs from the database. Left and right arrows do nothing.
 *     Ctrl-b then l builds on this Mac, r on the build Mac in configs/builder/remote.yaml. A failed compile
 *     asks whether to mark that run failed. Ctrl-f sets the judge
 *     decision (1–4 or enter). Ctrl-x twice removes the run from the database; the branch and artifact files stay.
 *     Ctrl-g checks the branch out in CHROMIUM_SRC and exits. Type to filter.
 *   Build: the log of the remote build the agent requested. It follows the tail while that build runs.
 *     Up and down scroll. End follows the tail again.
 *   Setups: every config, the checks in its setup.json, and how many runs it has. r reloads.
 * While the agent session runs in a terminal, that same log takes the screen once the agent requests a
 * remote build. Esc hides it until the next build. Ctrl-C still stops the benchmark.
 * --interactive opens the TUI with the flags as the Start tab's values, --runs opens it on the Runs tab
 * (`bun run start:inspect`), --setups opens it on the Setups tab (`bun run start:setups`), and --cli (or no terminal)
 * skips it and runs exactly what the flags say.
 * --auto-review (the default) gives the agent the chrome-validate tools, so it builds the change and checks it in
 * Chromium. --no-auto-review starts the session without those tools. The Start tab has the same checkbox.
 * --only-task and --only-config take comma-separated ids and may be repeated. --checkout skips the TUI
 * and checks that run's branch out. Checking out or building refuses uncommitted tracked changes unless --force.
 *
 * Uncommitted tracked changes in the Chromium checkout block the run. On a terminal the runner
 * asks whether to delete them and continue. Answering no, or running without a terminal, exits
 * with an error. --force deletes them without asking.
 *
 * configs/benchmark-tasks.json: [{ "taskId", "promptFile", "judgePromptFile",
 *                              "chromiumSha", "title"?, "difficulty"?, "scoring"? }]
 * configs/benchmark-setup.json: [{ "configId", "description"?, "model"?, "mcpConfig"?: [paths],
 *                              "pluginDirs"?: [paths], "toolPromptFile"?: path, "strictMcpConfig"?,
 *                              "allowedTools"?: [..], "disallowedTools"?: [..], "permissionMode"?,
 *                              "extraFiles"?: [paths hashed into config_hash] }]
 *
 * toolPromptFile is markdown, relative to the repo root. It names the tools that config adds
 * and tells the agent it must use them. The text is appended after the baseline prompt. Its contents
 * are part of config_hash. pluginDirs are plugin directories, relative to the repo root, passed to
 * claude --plugin-dir. Each directory's .claude-plugin/plugin.json is part of config_hash.
 *
 * Per run (src/runner/run-one/run-one.ts): reset src/ to the task's SHA, check out a branch named
 * after the run id, startRun, run claude with BENCH_RUN_ID, the tool-log hooks, and the
 * baseline guard (no cd, no shell file edits), copy the
 * transcript into runs/<run_id>/, commit the checkout onto that branch, finishRun, then a
 * second read-only claude session decides the tree: failed, partially-failed, partially-pass, or pass.
 * That session is a judge_runs row: its own cost, tokens, and duration. success is 1 for pass and
 * partially-pass. The judge does not record tool calls. The judge is also shown the agent's blocked and
 * failed tool calls and reports whether a missing, denied, or failing tool stopped the agent; the runner
 * prints a BLOCKED alert for those runs, and they fill the dashboard's Blockers section.
 *
 * Ctrl+C stops the benchmark. The run in progress is stored as cancelled (finished time, duration,
 * and any cost, turns, and tokens already reported) and later runs are not started. Exit code 130.
 * A second Ctrl+C exits immediately.
 */
async function main() {
  if (args.checkout) {
    await checkOutNamedRun({ name: args.checkout, force: args.force });

    return;
  }

  // The TUI opens before the Ctrl+C watcher, so Ctrl+C during a build in the Runs tab cancels only that build.
  const decision = await resolveStart({
    tasksPath: args.tasks,
    configsPath: args.configs,
    onlyTask: args["only-task"],
    onlyConfig: args["only-config"],
    repeats: args.repeats,
    timeoutMin: args["timeout-min"],
    sync: args.sync,
    autoReview: args["auto-review"],
    force: args.force,
    interactive: args.interactive,
    runs: args.runs,
    setups: args.setups,
    cli: args.cli,
  });

  if (decision.kind === "quit") {
    console.log("Nothing started.");

    return;
  }

  if (decision.kind === "checkout") {
    await checkOutRun({ choice: decision.choice, force: args.force });

    return;
  }

  const plan = decision.plan;
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
  let total = 0;
  let finished = 0;

  try {
    const { tasks, configs, repeats } = plan;

    if (shutdown.signal.aborted) {
      stopped = true;
    } else if (!args.force) {
      const status = await uncommittedStatus();

      if (status !== "") {
        const discard = await confirmDiscardUncommittedChanges({ signal: shutdown.signal, status });

        if (shutdown.signal.aborted) {
          stopped = true;
        } else if (!discard) {
          throw new Error(`${CHROMIUM_SRC} has uncommitted changes; commit/stash them or pass --force`);
        } else {
          console.log(`Deleting uncommitted changes in ${CHROMIUM_SRC}.`);
        }
      }
    }

    if (!stopped) {
      const options = {
        claudeVersion: await claudeVersion(),
        timeoutMs: plan.timeoutMin * 60_000,
        sync: plan.sync,
        autoReview: plan.autoReview,
        judgeModel: args["judge-model"] ?? "claude-sonnet-5-5",
      };
      db = openDb();
      for (const task of tasks) upsertTask({ db, task });
      for (const benchConfig of configs) upsertConfig({ db, config: await toConfigRow(benchConfig) });

      total = tasks.length * configs.length * repeats;
      let runIndex = 0;
      for (const task of tasks) {
        for (const config of configs) {
          for (let repeat = 0; repeat < repeats; repeat++) {
            if (shutdown.signal.aborted) {
              stopped = true;
              break;
            }

            const index = ++runIndex;
            console.log(`[${index}/${total}] ${task.taskId} × ${config.configId} #${repeat}`);
            const clock = openRunClock({
              index,
              total,
              taskId: task.taskId,
              configId: config.configId,
              repeat,
            });
            const { runId, result, seconds, artifact, judge, cancelled } = await runOne({
              db,
              task,
              config,
              repeat,
              options,
              signal: shutdown.signal,
              onPhase: (phase) => {
                clock.setPhase(phase);
              },
            }).finally(() => {
              clock.stop();
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

            finished++;
            const judged = judgementText({ judge });
            console.log(
              `  ${runId} ${result.is_error ? "crashed" : "done"} in ${seconds}s${cost}, ${files}, ${judged}`,
            );

            for (const line of blockerAlert({ runId, judge })) {
              console.warn(line);
            }

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

    // Left in place after exit, so a finished or stopped benchmark still shows in its tab.
    if (total > 0) {
      setTerminalTitle(benchEndTitle({ finished, total, stopped: finished < total }));
    }
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
