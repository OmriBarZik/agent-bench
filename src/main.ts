#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { checkOutNamedRun } from "./inspect/checkout/checkout-run";
import { runPruneCommand } from "./inspect/prune/prune-command";
import { DEFAULT_AGENT_TIMEOUT_MIN, DEFAULT_BUILD_TIMEOUT_MIN } from "./runner/claude/session/agent-pause";
import { watchForShutdown } from "./runner/shutdown/shutdown";
import { runMatrix } from "./start/jobs/run-matrix";
import { DEFAULT_CONFIGS_PATH, DEFAULT_TASKS_PATH, resolveStart } from "./start/resolve-start";

const { values: args } = parseArgs({
  allowNegative: true,
  options: {
    tasks: { type: "string", default: DEFAULT_TASKS_PATH },
    configs: { type: "string", default: DEFAULT_CONFIGS_PATH },
    repeats: { type: "string" }, // no default, so the picker knows whether it was passed
    "only-task": { type: "string", multiple: true },
    "only-config": { type: "string", multiple: true },
    "timeout-min": { type: "string", default: String(DEFAULT_AGENT_TIMEOUT_MIN) },
    "build-timeout-min": { type: "string", default: String(DEFAULT_BUILD_TIMEOUT_MIN) },
    "judge-model": { type: "string", default: "claude-sonnet-5-5" },
    sync: { type: "boolean", default: false }, // run `gclient sync -D` after each checkout
    "auto-review": { type: "boolean", default: true }, // chrome-validate: the agent builds and checks its change
    force: { type: "boolean", default: false }, // wipe uncommitted changes in src/ without asking
    interactive: { type: "boolean", short: "i", default: false }, // open the TUI even with selection flags
    runs: { type: "boolean", default: false }, // open the TUI on the Runs tab
    setups: { type: "boolean", default: false }, // open the TUI on the Setups tab
    checkout: { type: "string" }, // check this run's branch out and exit, no TUI
    cli: { type: "boolean", default: false }, // never open the TUI
    "prune-apps": { type: "boolean", default: false }, // delete finished runs' Chromium.app copies and exit
    "min-free-gb": { type: "string" }, // with --prune-apps: stop once this much disk is free
    "dry-run": { type: "boolean", default: false }, // with --prune-apps: only list what would go
  },
});

/**
 * Benchmark runner: tasks × configs × repeats, one `claude -p` session per run.
 *
 *   bun run start [--tasks configs/benchmark-tasks.json] [--configs configs/benchmark-setup.json] [--repeats 3]
 *                     [--only-task id[,id]] [--only-config id[,id]] [--timeout-min 60] [--build-timeout-min 90]
 *                     [--judge-model claude-sonnet-5-5]
 *                     [--sync] [--auto-review | --no-auto-review] [--force] [--interactive | --runs | --setups | --cli]
 *   bun run start --checkout <branch or run id> [--force]
 *   bun run start --prune-apps [--only-task id[,id]] [--only-config id[,id]] [--min-free-gb 60] [--dry-run]
 *
 * On a terminal with none of --only-task, --only-config, or --repeats, it opens a long-lived TUI with four tabs;
 * tab and shift-tab switch between them, and esc quits. Starting a matrix, a Runs-tab build, or a checkout
 * keeps the TUI open so you can navigate other tabs. Only one Chromium-touching job runs at a time.
 *   Start: check the tasks and configs to run, set repeats, agent timeout, build timeout, sync, and auto review, then enter starts
 *     the matrix as a background job. It shows the equivalent --cli command. Left and right change a number or a checkbox,
 *     digits type a number, and r resets to the defaults. The selection is saved in data/start-picker.json.
 *     --only-task, --only-config, and --repeats skip that file.
 *   Runs: the runs in the database. Enter opens a menu of every action below, with submenus; esc goes back.
 *     Ctrl-o opens the run transcript in the browser, ctrl-e the judge session.
 *     Ctrl-r reloads the runs from the database. Left and right arrows do nothing.
 *     Ctrl-b then l builds on this Mac, r on the build Mac in configs/builder/remote.yaml. Builds stream on the Build tab.
 *     A failed compile asks whether to mark that run failed. Ctrl-f sets the judge
 *     decision (1–4 or enter). Ctrl-x twice removes the run from the database; the branch and artifact files stay.
 *     The Enter menu can delete per-run Chromium.app copies under the build directory to free disk (never out/Default).
 *     Ctrl-g checks the branch out in CHROMIUM_SRC without leaving the TUI. Type to filter.
 *   Build: a list of past and present agent builds (plus a live inspect-build log when one is running). Enter opens a log;
 *     esc returns to the list; ←→ steps between builds. Up and down scroll the log; end follows the tail. Tab still switches tabs.
 *   Setups: every config, the checks in its setup.json, and how many runs it has. r reloads.
 * Ctrl-C cancels the active job; when idle, it quits the TUI. A second Ctrl-C force-exits.
 * --interactive opens the TUI with the flags as the Start tab's values, --runs opens it on the Runs tab
 * (`bun run start:inspect`), --setups opens it on the Setups tab (`bun run start:setups`), and --cli (or no terminal)
 * skips it and runs exactly what the flags say.
 * --auto-review (the default) gives the agent the chrome-validate tools, so it builds the change and checks it in
 * Chromium. --no-auto-review starts the session without those tools. The Start tab has the same checkbox.
 * --only-task and --only-config take comma-separated ids and may be repeated. --checkout skips the TUI
 * and checks that run's branch out. --prune-apps deletes per-run Chromium.app copies under the build directory
 * whose run is judged, cancelled, or no longer in the database, oldest first, and exits. --only-task and --only-config limit it to those runs. --min-free-gb stops once
 * that much disk is free. A run still working or waiting for its judge keeps its copy, so it is safe mid-matrix.
 * Checking out or building refuses uncommitted tracked changes unless --force.
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
 * On --cli, Ctrl+C stops the benchmark. The run in progress is stored as cancelled (finished time, duration,
 * and any cost, turns, and tokens already reported) and later runs are not started. Exit code 130.
 * A second Ctrl+C exits immediately.
 */
async function main() {
  if (args["prune-apps"]) {
    await runPruneCommand({
      onlyTask: args["only-task"],
      onlyConfig: args["only-config"],
      minFreeGb: args["min-free-gb"],
      dryRun: args["dry-run"],
    });

    return;
  }

  if (args.checkout) {
    await checkOutNamedRun({ name: args.checkout, force: args.force });

    return;
  }

  const decision = await resolveStart({
    tasksPath: args.tasks,
    configsPath: args.configs,
    onlyTask: args["only-task"],
    onlyConfig: args["only-config"],
    repeats: args.repeats,
    timeoutMin: args["timeout-min"],
    buildTimeoutMin: args["build-timeout-min"],
    sync: args.sync,
    autoReview: args["auto-review"],
    force: args.force,
    interactive: args.interactive,
    runs: args.runs,
    setups: args.setups,
    cli: args.cli,
    judgeModel: args["judge-model"] ?? "claude-sonnet-5-5",
  });

  if (decision.kind === "quit") {
    return;
  }

  const shutdown = watchForShutdown({
    onFirst: () => {
      console.error("\nStopping the benchmark. Press Ctrl+C again to force exit.");
    },
    onForce: () => {
      console.error("\nForced exit.");
      process.exit(130);
    },
  });

  try {
    const result = await runMatrix({
      plan: decision.plan,
      force: args.force,
      judgeModel: args["judge-model"] ?? "claude-sonnet-5-5",
      signal: shutdown.signal,
      presentation: "console",
      watchBuildLog: true,
    });

    if (result.stopped) {
      process.exit(130);
    }
  } finally {
    shutdown.stop();
  }
}

if (import.meta.main) {
  await main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
