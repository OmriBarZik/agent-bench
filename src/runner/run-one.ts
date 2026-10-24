import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { finishRun, saveScore, startRun } from "../db";
import type { ClaudeResult, RunArtifact, Score, Task } from "../db.types";
import { RUNS_DIR } from "../paths";
import type { BenchConfig } from "./bench-config.types";
import { commitRunChanges, createRunBranch, resetChromium, restoreCommittedTree } from "./chromium";
import { claudeArgs, copyTranscript, runClaude } from "./claude";
import { judgeRun } from "./judge";
import type { RunOneResult, RunOptions } from "./run-one.types";

/** One benchmark run: reset onto the run branch, record it, run claude, commit the tree, store the result, then score the checkout. */
export async function runOne({
  db,
  task,
  config,
  repeat,
  options,
}: {
  db: Database;
  task: Task;
  config: BenchConfig;
  repeat: number;
  options: RunOptions;
}): Promise<RunOneResult> {
  const runId = `${task.taskId}__${config.configId}__r${repeat}__${Date.now().toString(36)}`;
  await resetChromium({ sha: task.chromiumSha, sync: options.sync });
  await createRunBranch(runId);
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
      claudeVersion: options.claudeVersion,
      model: config.model ?? "default",
      artifactsPath: outDir,
      branch: runId,
    },
  });

  const started = Date.now();
  const sessionId = randomUUID();
  const result = await runClaude({
    command: claudeArgs({ task, config, sessionId }),
    runId,
    outDir,
    timeoutMs: options.timeoutMs,
  });

  if (!copyTranscript({ sessionId: result.session_id ?? sessionId, destDir: outDir })) {
    console.warn(`  transcript for session ${sessionId} not found`);
  }

  let artifact: RunArtifact = { commitSha: null, changedFiles: [] };
  let commitError: unknown;
  try {
    artifact = await commitRunChanges({
      branch: runId,
      baseSha: task.chromiumSha,
      message: `agent-bench ${runId}`,
    });
  } catch (error) {
    commitError = error;
  }

  finishRun({ db, runId, result, artifact });
  console.log(`  judging with ${options.judgeModel}`);
  const score = await scoreRun({ task, result, artifact, outDir, options });
  saveScore({ db, runId, score });

  if (artifact.commitSha) {
    await restoreCommittedTree();
  }

  if (commitError) {
    throw commitError;
  }

  return { runId, result, seconds: Math.round((Date.now() - started) / 1000), artifact, score };
}

/** The judge score, or an unscored result when the judge session itself throws. */
async function scoreRun({
  task,
  result,
  artifact,
  outDir,
  options,
}: {
  task: Task;
  result: ClaudeResult;
  artifact: RunArtifact;
  outDir: string;
  options: RunOptions;
}): Promise<Score> {
  try {
    return await judgeRun({
      task,
      result,
      artifact,
      outDir,
      judgeModel: options.judgeModel,
      successThreshold: task.successThreshold,
      timeoutMs: options.timeoutMs,
    });
  } catch (error) {
    return {
      details: {
        judgeModel: options.judgeModel,
        successThreshold: task.successThreshold,
        judgeError: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
