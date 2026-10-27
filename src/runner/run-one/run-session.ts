import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { cancelRun, finishRun, listToolTrouble, saveJudgeRun } from "../../db/db";
import type { ClaudeResult, JudgeMetrics, RunArtifact, Task, ToolTrouble } from "../../db/db.types";
import type { BenchConfig } from "../bench-config/bench-config.types";
import { claudeArgs, runClaude } from "../claude/claude";
import { readClaudeOutput } from "../claude/claude-result";
import { judgeRun } from "../judge/judge";
import { cancelledJudgeMetrics, failedJudgeMetrics } from "../judge/result/judge-result";
import type { RunOneResult, RunOptions } from "./run-one.types";
import { commitAgentWork, restoreTree, saveTranscript } from "./run-tree";
import type { CommittedWork } from "./run-tree.types";

const emptyArtifact: RunArtifact = { commitSha: null, changedFiles: [] };

/** Runs claude, copies the transcript, and commits the checkout. */
export async function runAndCommitAgent({
  db,
  task,
  config,
  runId,
  outDir,
  started,
  options,
  signal,
}: {
  db: Database;
  task: Task;
  config: BenchConfig;
  runId: string;
  outDir: string;
  started: number;
  options: RunOptions;
  signal: AbortSignal;
}): Promise<CommittedWork> {
  const sessionId = randomUUID();
  const result = await runAgent({ task, config, sessionId, runId, outDir, started, options, signal });
  saveTranscript({ sessionId: result.session_id ?? sessionId, outDir });
  const committed = await commitAgentWork({ runId, baseSha: task.chromiumSha, result });
  finishRun({
    db,
    runId,
    result: committed.result,
    artifact: committed.artifact,
    status: signal.aborted ? "cancelled" : undefined,
  });

  return committed;
}

/** Scores the checkout, or stores a cancelled judge when the user stops it. */
export async function judgeAndStore({
  db,
  task,
  runId,
  outDir,
  started,
  options,
  signal,
  committed,
}: {
  db: Database;
  task: Task;
  runId: string;
  outDir: string;
  started: number;
  options: RunOptions;
  signal: AbortSignal;
  committed: CommittedWork;
}): Promise<RunOneResult> {
  console.log(`  judging with ${options.judgeModel}`);
  const judge = await scoreRun({
    task,
    result: committed.result,
    artifact: committed.artifact,
    toolTrouble: listToolTrouble({ db, runId }),
    outDir,
    options,
    signal,
  });

  if (signal.aborted && judge.status !== "done") {
    const cancelledJudge = cancelledJudgeMetrics({
      judgeModel: options.judgeModel,
      judge,
    });
    cancelRun({ db, runId });
    saveJudgeRun({ db, runId, judge: cancelledJudge });
    await restoreTree({ signal, commitSha: committed.artifact.commitSha });

    return outcome({
      runId,
      result: committed.result,
      started,
      artifact: committed.artifact,
      judge: cancelledJudge,
      cancelled: true,
    });
  }

  saveJudgeRun({ db, runId, judge });
  await restoreTree({ signal, commitSha: committed.artifact.commitSha });

  if (committed.commitError) {
    throw committed.commitError;
  }

  return outcome({
    runId,
    result: committed.result,
    started,
    artifact: committed.artifact,
    judge,
    cancelled: false,
  });
}

/** Closes a run that threw after startRun because the user hit Ctrl+C. */
export function storeInterruptedRun({
  db,
  runId,
  started,
  error,
}: {
  db: Database;
  runId: string;
  started: number;
  error: unknown;
}): RunOneResult {
  const stderr = error instanceof Error ? error.message : String(error);
  const result = readClaudeOutput({
    stdout: "",
    stderr,
    exitCode: null,
    signalCode: null,
    startedAt: started,
    aborted: true,
  });
  finishRun({ db, runId, result, artifact: emptyArtifact, status: "cancelled" });

  return outcome({ runId, result, started, artifact: emptyArtifact, judge: null, cancelled: true });
}

/** The judge session, or a crashed row when the judge itself throws. The agent run is already stored. */
async function scoreRun({
  task,
  result,
  artifact,
  toolTrouble,
  outDir,
  options,
  signal,
}: {
  task: Task;
  result: ClaudeResult;
  artifact: RunArtifact;
  toolTrouble: ToolTrouble[];
  outDir: string;
  options: RunOptions;
  signal: AbortSignal;
}): Promise<JudgeMetrics> {
  try {
    return await judgeRun({
      task,
      result,
      artifact,
      toolTrouble,
      outDir,
      judgeModel: options.judgeModel,
      timeoutMs: options.timeoutMs,
      signal,
    });
  } catch (error) {
    if (signal.aborted) {
      return cancelledJudgeMetrics({
        judgeModel: options.judgeModel,
      });
    }

    return failedJudgeMetrics({
      judgeModel: options.judgeModel,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function runAgent({
  task,
  config,
  sessionId,
  runId,
  outDir,
  started,
  options,
  signal,
}: {
  task: Task;
  config: BenchConfig;
  sessionId: string;
  runId: string;
  outDir: string;
  started: number;
  options: RunOptions;
  signal: AbortSignal;
}): Promise<ClaudeResult> {
  try {
    return await runClaude({
      command: claudeArgs({ task, config, sessionId }),
      runId,
      outDir,
      timeoutMs: options.timeoutMs,
      signal,
    });
  } catch (error) {
    if (!signal.aborted) {
      throw error;
    }

    const stderr = error instanceof Error ? error.message : String(error);

    return readClaudeOutput({
      stdout: "",
      stderr,
      exitCode: null,
      signalCode: null,
      startedAt: started,
      aborted: true,
    });
  }
}

function outcome({
  runId,
  result,
  started,
  artifact,
  judge,
  cancelled,
}: {
  runId: string;
  result: ClaudeResult;
  started: number;
  artifact: RunArtifact;
  judge: JudgeMetrics | null;
  cancelled: boolean;
}): RunOneResult {
  return {
    runId,
    result,
    seconds: Math.round((Date.now() - started) / 1000),
    artifact,
    judge,
    cancelled,
  };
}
