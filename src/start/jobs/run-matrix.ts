import { openDb, upsertConfig, upsertTask } from "../../db/db";
import { CHROMIUM_SRC } from "../../paths";
import { toConfigRow } from "../../runner/bench-config/bench-config";
import { claudeVersion } from "../../runner/claude/claude";
import { confirmDiscardUncommittedChanges } from "../../runner/chromium/confirm-discard";
import { uncommittedStatus } from "../../runner/chromium/chromium";
import { blockerAlert } from "../../runner/judge/result/judge-blockers";
import { judgementText } from "../../runner/judge/result/judge-result";
import { runOne } from "../../runner/run-one/run-one";
import { BenchmarkShutdown } from "../../runner/shutdown/shutdown";
import { openRunClock } from "../../terminal/run-clock";
import { setTerminalTitle } from "../../terminal/terminal-title";
import { benchEndTitle } from "../../terminal/title-text";
import type { MatrixProgress, RunMatrixOptions, RunMatrixResult } from "./run-matrix.types";

/**
 * Runs tasks × configs × repeats once. Shared by `--cli` and the Start-tab job.
 * Does not install a SIGINT handler; the caller passes `signal`.
 */
export async function runMatrix({
  plan,
  force,
  judgeModel,
  signal,
  askDiscard = true,
  presentation = "console",
  onProgress = () => {},
  watchBuildLog = presentation === "console",
}: RunMatrixOptions): Promise<RunMatrixResult> {
  const quiet = presentation === "quiet";
  let db: ReturnType<typeof openDb> | undefined;
  let stopped = false;
  let total = 0;
  let finished = 0;

  const emit = (progress: MatrixProgress) => {
    onProgress(progress);
  };

  try {
    const { tasks, configs, repeats } = plan;

    if (signal.aborted) {
      return { finished: 0, total: 0, stopped: true };
    }

    if (!force) {
      const status = await uncommittedStatus();

      if (status !== "") {
        if (!askDiscard) {
          throw new Error(`${CHROMIUM_SRC} has uncommitted changes; commit/stash them or pass --force`);
        }

        const discard = await confirmDiscardUncommittedChanges({ signal, status });

        if (signal.aborted) {
          return { finished: 0, total: 0, stopped: true };
        }

        if (!discard) {
          throw new Error(`${CHROMIUM_SRC} has uncommitted changes; commit/stash them or pass --force`);
        }

        const message = `Deleting uncommitted changes in ${CHROMIUM_SRC}.`;
        emit({ kind: "discard", text: message });

        if (!quiet) {
          console.log(message);
        }
      }
    }

    const options = {
      claudeVersion: await claudeVersion(),
      timeoutMs: plan.timeoutMin * 60_000,
      buildTimeoutMs: plan.buildTimeoutMin * 60_000,
      sync: plan.sync,
      autoReview: plan.autoReview,
      judgeModel,
      watchBuildLog,
    };
    db = openDb();

    for (const task of tasks) {
      upsertTask({ db, task });
    }

    for (const benchConfig of configs) {
      upsertConfig({ db, config: await toConfigRow(benchConfig) });
    }

    total = tasks.length * configs.length * repeats;
    let runIndex = 0;

    for (const task of tasks) {
      for (const config of configs) {
        for (let repeat = 0; repeat < repeats; repeat++) {
          if (signal.aborted) {
            stopped = true;
            break;
          }

          const index = ++runIndex;
          const startLine = `[${index}/${total}] ${task.taskId} × ${config.configId} #${repeat}`;
          emit({
            kind: "run-start",
            text: startLine,
            index,
            total,
            phase: "reset",
            taskId: task.taskId,
            configId: config.configId,
            repeat,
          });

          if (!quiet) {
            console.log(startLine);
          }

          const clock = quiet
            ? null
            : openRunClock({
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
            signal,
            onPhase: (phase) => {
              clock?.setPhase(phase);
              emit({
                kind: "run-start",
                text: `${startLine} · ${phase}`,
                index,
                total,
                phase,
                taskId: task.taskId,
                configId: config.configId,
                repeat,
              });
            },
            onAgentPaused: (paused) => {
              clock?.setPaused(paused);
              emit({
                kind: "run-start",
                text: paused ? `${startLine} · waiting on build` : startLine,
                index,
                total,
                phase: "agent",
                agentPaused: paused,
                taskId: task.taskId,
                configId: config.configId,
                repeat,
              });
            },
          }).finally(() => {
            clock?.stop();
          });
          const cost = result.total_cost_usd != null ? `, $${result.total_cost_usd.toFixed(2)}` : "";
          const files =
            artifact.changedFiles.length === 0 ? "no file changes" : `${artifact.changedFiles.length} files`;

          if (cancelled || !judge) {
            const judgeNote = judge ? ", judge cancelled" : "";
            const line = `  ${runId} cancelled in ${seconds}s${cost}, ${files}${judgeNote}`;
            emit({ kind: "run-cancelled", text: line, index, total });

            if (!quiet) {
              console.log(line);
            }

            stopped = true;
            break;
          }

          finished++;
          const judged = judgementText({ judge });
          const doneLine = `  ${runId} ${result.is_error ? "crashed" : "done"} in ${seconds}s${cost}, ${files}, ${judged}`;
          emit({ kind: "run-done", text: doneLine, index, total });

          if (!quiet) {
            console.log(doneLine);
          }

          for (const line of blockerAlert({ runId, judge })) {
            emit({ kind: "blocker", text: line, index, total });

            if (!quiet) {
              console.warn(line);
            }
          }

          if (signal.aborted) {
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
  } catch (error) {
    if (!signal.aborted) {
      throw error;
    }

    if (!(error instanceof BenchmarkShutdown)) {
      const message = error instanceof Error ? error.message : String(error);
      emit({ kind: "message", text: message });

      if (!quiet) {
        console.error(message);
      }
    }

    stopped = true;
  } finally {
    db?.close();

    if (!quiet && total > 0) {
      setTerminalTitle(benchEndTitle({ finished, total, stopped: finished < total }));
    }
  }

  return { finished, total, stopped };
}
