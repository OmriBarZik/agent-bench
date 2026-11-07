import type { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { cancelRun, promptVersion, startRun } from "../../db/db";
import type { Task } from "../../db/db.types";
import { RUNS_DIR } from "../../paths";
import type { BenchConfig } from "../bench-config/bench-config.types";
import { watchAgentBuildLog } from "../build-log/screen/watch-build-log";
import type { RunOneResult, RunOptions, RunPhase } from "./run-one.types";
import { judgeAndStore, runAndCommitAgent, storeInterruptedRun } from "./run-session";
import { prepareCheckout } from "./run-tree";
import type { CommittedWork } from "./run-tree.types";

/** One benchmark run: reset onto the run branch, record it, run claude, commit the tree, store the result, then decide the checkout. */
export async function runOne({
  db,
  task,
  config,
  repeat,
  options,
  signal,
  onPhase = () => {},
  onAgentPaused = () => {},
}: {
  db: Database;
  task: Task;
  config: BenchConfig;
  repeat: number;
  options: RunOptions;
  /** Aborted on the first Ctrl+C. The run is stored as cancelled and the benchmark stops. */
  signal: AbortSignal;
  /** Called as each step starts, so the caller can show it (the terminal title). */
  onPhase?: (phase: RunPhase) => void;
  /** Called when the agent is stopped for a remote build, and when it runs again. */
  onAgentPaused?: (paused: boolean) => void;
}): Promise<RunOneResult> {
  const runId = `${task.taskId}__${config.configId}__r${repeat}__${Date.now().toString(36)}`;
  onPhase("reset");
  await prepareCheckout({ sha: task.chromiumSha, sync: options.sync, runId, signal });
  const outDir = join(RUNS_DIR, runId);
  mkdirSync(outDir, { recursive: true });

  // Insert the run row before claude starts so the hooks' tool_calls rows have a parent.
  startRun({
    db,
    run: {
      runId,
      taskId: task.taskId,
      configId: config.configId,
      repeat,
      promptVersion: promptVersion(task.prompt),
      judgePromptVersion: promptVersion(task.judgePrompt),
      claudeVersion: options.claudeVersion,
      model: config.model ?? "default",
      artifactsPath: outDir,
      branch: runId,
      autoReview: options.autoReview,
    },
  });

  const started = Date.now();
  let recorded = false;
  try {
    onPhase("agent");
    const logWatch =
      options.autoReview && options.watchBuildLog !== false ? watchAgentBuildLog({ db, runId, signal }) : null;
    let committed: CommittedWork;

    try {
      committed = await runAndCommitAgent({
        db,
        task,
        config,
        runId,
        outDir,
        started,
        options,
        signal,
        onAgentPaused,
      });
    } finally {
      await logWatch?.stop();
    }

    recorded = true;

    if (signal.aborted) {
      // The row may already say done if the signal flipped while finishRun was writing.
      cancelRun({ db, runId });

      return {
        runId,
        result: committed.result,
        seconds: Math.round((Date.now() - started) / 1000),
        artifact: committed.artifact,
        judge: null,
        cancelled: true,
      };
    }

    onPhase("judge");

    return await judgeAndStore({ db, task, runId, outDir, started, options, signal, committed });
  } catch (error) {
    if (recorded || !signal.aborted) {
      throw error;
    }

    return storeInterruptedRun({ db, runId, started, error });
  }
}
