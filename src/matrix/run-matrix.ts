#!/usr/bin/env bun
import { $ } from "bun";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { countCurrentRuns, deleteRun, openDb, runOutcome } from "../db/db";
import { BENCH_DIR } from "../paths";
import { loadSelection } from "../runner/bench-config/bench-config";
import { waitUntilReady } from "./guards";
import { planRuns } from "./matrix-plan";
import { runCell } from "./run-cell";

const MAX_INFRA_FAILURES = 3;
const COOLDOWN_MS = 20 * 60_000;

/**
 * Fills the benchmark matrix: runs every task × config until each has `--repeats` current runs (not archived,
 * finished or crashed), one run at a time through the normal runner, round by round. It archives stale runs as
 * `pilot` first, so only runs of today's prompts and setups count, and it can be stopped and started again: it
 * always runs only what is missing.
 *
 * Before each run it waits for the build Mac (SSH, battery) and a working `claude -p`, and frees disk with
 * `--prune-apps`. A run that hits the Cloudflare 403 or crashes at $0 is an infrastructure failure: it is deleted
 * from the DB and retried after 20 minutes, at most three times per cell. A run the judge gave no decision is kept
 * and logged, to re-judge from the Runs tab. Destructive like `bun run start`, and billed.
 *
 *   caffeinate -i bun run matrix [--repeats 2] [--only-task id,id] [--only-config id,id] [--dry-run]
 *                                [--timeout-min 60] [--build-location remote|local]
 *
 * The log goes to runs/matrix/<time>.log; each run's own output is in it too.
 */
async function main() {
  const { values: args } = parseArgs({
    options: {
      repeats: { type: "string", default: "2" },
      "only-task": { type: "string" },
      "only-config": { type: "string" },
      "timeout-min": { type: "string" },
      "build-location": { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const selection = await loadSelection({
    tasksPath: join(BENCH_DIR, "configs/benchmark-tasks.json"),
    configsPath: join(BENCH_DIR, "configs/benchmark-setup.json"),
    onlyTasks: args["only-task"]?.split(","),
    onlyConfigs: args["only-config"]?.split(","),
  });
  const taskIds = selection.tasks.map((task) => task.taskId);
  const configIds = selection.configs.map((config) => config.configId);
  const repeats = Number(args.repeats);
  const extraArgs = [
    ...(args["timeout-min"] ? ["--timeout-min", args["timeout-min"]] : []),
    ...(args["build-location"] ? ["--build-location", args["build-location"]] : []),
  ];
  const logDir = join(BENCH_DIR, "runs/matrix");
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, `${new Date().toISOString().replaceAll(":", "-")}.log`);
  const log = (line: string) => {
    const stamped = `${new Date().toISOString()} ${line}`;
    console.log(stamped);
    appendFileSync(logPath, `${stamped}\n`);
  };
  const controller = new AbortController();
  process.on("SIGINT", () => controller.abort());

  await $`bun ${join(BENCH_DIR, "src/archive/archive-pilot.ts")} ${args["dry-run"] ? ["--dry-run"] : []}`.cwd(
    BENCH_DIR,
  );
  const db = openDb();
  const failures = new Map<string, number>();
  const plan = () =>
    planRuns({ taskIds, configIds, repeats, counts: countCurrentRuns(db) }).filter(
      (run) => (failures.get(`${run.taskId}/${run.configId}`) ?? 0) < MAX_INFRA_FAILURES,
    );
  log(`matrix: ${plan().length} runs missing for ${taskIds.length} tasks × ${configIds.length} configs × ${repeats}`);

  if (args["dry-run"]) {
    for (const run of plan()) {
      log(`  would run ${run.taskId} × ${run.configId} #${run.repeat}`);
    }

    db.close();

    return;
  }

  for (let next = plan()[0]; next && !controller.signal.aborted; next = plan()[0]) {
    const cellKey = `${next.taskId}/${next.configId}`;

    if (!(await waitUntilReady({ log, signal: controller.signal }))) {
      break;
    }

    await $`bun ${join(BENCH_DIR, "src/main.ts")} --prune-apps --min-free-gb 60`.cwd(BENCH_DIR).nothrow().quiet();
    log(`start ${cellKey} #${next.repeat} (${plan().length} missing)`);
    const cell = await runCell({ run: next, extraArgs, logPath });
    const outcome = cell.runId ? runOutcome({ db, runId: cell.runId }) : null;
    const zeroCostCrash = outcome?.status === "crashed" && (outcome.costUsd ?? 0) === 0;

    if (cell.cloudflare403 || zeroCostCrash || (outcome?.status === "cancelled" && !controller.signal.aborted)) {
      failures.set(cellKey, (failures.get(cellKey) ?? 0) + 1);
      log(`infra failure on ${cellKey} (${cell.runId ?? "no run"}), deleting it and cooling down 20 min`);

      if (cell.runId) {
        deleteRun({ db, runId: cell.runId });
      }

      await Bun.sleep(COOLDOWN_MS);
      continue;
    }

    const minutes = Math.round((outcome?.durationMs ?? 0) / 60_000);
    const cost = (outcome?.costUsd ?? 0).toFixed(2);
    log(`${cell.runId} ${outcome?.status} in ${minutes} min, $${cost}, decision ${outcome?.decision ?? "n/a"}`);
  }

  for (const [cellKey, count] of failures) {
    if (count >= MAX_INFRA_FAILURES) {
      log(`gave up on ${cellKey} after ${count} infrastructure failures`);
    }
  }

  log(`matrix stopped: ${plan().length} runs still missing`);
  db.close();
}

if (import.meta.main) {
  await main();
}
