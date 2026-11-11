import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { abandonOpenBuilds, cancelRun, finishRun, listToolTrouble, saveJudgeRun } from "../../db/db";
import type { ClaudeResult, JudgeMetrics, RunArtifact, Task, ToolTrouble } from "../../db/db.types";
import { AGENT_LIVE_LOG_FILE, CHROMIUM_SRC } from "../../paths";
import type { BenchConfig } from "../bench-config/bench-config.types";
import { claudeArgs, runClaude } from "../claude/claude";
import { readClaudeOutput } from "../claude/claude-result";
import { languageServerPathEntries } from "../claude/language-server-path";
import { followTranscript } from "../claude/live/follow-transcript";
import { runBenchChecks } from "../judge/checks/bench-checks";
import type { BenchCheck } from "../judge/checks/bench-checks.types";
import { judgeRun } from "../judge/judge";
import { cancelledJudgeMetrics, failedJudgeMetrics } from "../judge/result/judge-result";
import type { RunOneResult, RunOptions } from "./run-one.types";
import { commitAgentWork, restoreTree, saveTranscript } from "./run-tree";
import type { CommittedWork } from "./run-tree.types";

const emptyArtifact: RunArtifact = { commitSha: null, changedFiles: [] };

/** Runs claude while writing its live log, copies the transcript, and commits the checkout. */
export async function runAndCommitAgent({
  db,
  task,
  config,
  runId,
  outDir,
  started,
  options,
  signal,
  onAgentPaused,
}: {
  db: Database;
  task: Task;
  config: BenchConfig;
  runId: string;
  outDir: string;
  started: number;
  options: RunOptions;
  signal: AbortSignal;
  onAgentPaused: (paused: boolean) => void;
}): Promise<CommittedWork> {
  const sessionId = randomUUID();
  const liveLog = followTranscript({ sessionId, logPath: join(outDir, AGENT_LIVE_LOG_FILE) });
  const result = await runAgent({
    task,
    config,
    sessionId,
    runId,
    outDir,
    started,
    options,
    signal,
    onAgentPaused,
  }).finally(() => {
    liveLog.stop();
  });
  // A killed chrome-validate server cannot close its last build, so the runner does.
  abandonOpenBuilds({ db, runId });
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
  const benchChecks = await runBenchChecks({
    input: {
      task,
      runId,
      commitSha: committed.artifact.commitSha,
      changedFiles: committed.artifact.changedFiles,
      chromiumSrc: CHROMIUM_SRC,
    },
    outDir,
  });

  for (const check of benchChecks) {
    console.log(`  check ${check.status.padEnd(7)} ${check.name}: ${check.detail}`);
  }

  console.log(`  judging with ${options.judgeModel}`);
  const judge = await scoreRun({
    task,
    result: committed.result,
    artifact: committed.artifact,
    toolTrouble: listToolTrouble({ db, runId }),
    benchChecks,
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
  benchChecks,
  outDir,
  options,
  signal,
}: {
  task: Task;
  result: ClaudeResult;
  artifact: RunArtifact;
  toolTrouble: ToolTrouble[];
  benchChecks: BenchCheck[];
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
      benchChecks,
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
  onAgentPaused,
}: {
  task: Task;
  config: BenchConfig;
  sessionId: string;
  runId: string;
  outDir: string;
  started: number;
  options: RunOptions;
  signal: AbortSignal;
  onAgentPaused: (paused: boolean) => void;
}): Promise<ClaudeResult> {
  try {
    return await runClaude({
      command: claudeArgs({
        task,
        config,
        sessionId,
        runId,
        autoReview: options.autoReview,
        buildTimeoutMs: options.buildTimeoutMs,
      }),
      runId,
      outDir,
      timeoutMs: options.timeoutMs,
      buildTimeoutMs: options.buildTimeoutMs,
      signal,
      autoReview: options.autoReview,
      pathEntries: languageServerPathEntries({ pluginDirs: config.pluginDirs }),
      onPaused: onAgentPaused,
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
