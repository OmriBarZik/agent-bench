import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { ClaudeResult, JudgeMetrics, RunArtifact, Task } from "../../db/db.types";
import { JUDGE_DECISION_MEANING, JUDGE_DECISIONS } from "../../db/judge-decision";
import { CHROMIUM_SRC, JUDGE_TRANSCRIPT_FILE } from "../../paths";
import { copyTranscript } from "../claude/claude";
import { captureClaude } from "../claude/claude-process";
import { buildJudgePrompt } from "./judge-prompt";
import { judgeMetrics } from "./judge-result";
import { diffAgainst } from "./worktree-diff";

/** Structured output the session must return. The schema is enforced; the prompt does not describe it. */
const JUDGE_SCHEMA = JSON.stringify({
  type: "object",
  additionalProperties: false,
  properties: {
    decision: {
      type: "string",
      enum: [...JUDGE_DECISIONS],
      description: JUDGE_DECISIONS.map((decision) => `${decision}: ${JUDGE_DECISION_MEANING[decision]}`).join(" "),
    },
    reason: {
      type: "string",
      description: "What is present and what is missing.",
    },
  },
  required: ["decision", "reason"],
});

/**
 * Scores one finished run with a second, read-only claude session.
 * The session does not set BENCH_RUN_ID, so its tool calls are not recorded as the agent's.
 * Copies the session log to judge-transcript.jsonl so the TUI can open it.
 * A failed session returns metrics with error set and no decision.
 */
export async function judgeRun({
  task,
  result,
  artifact,
  outDir,
  judgeModel,
  timeoutMs,
  signal,
}: {
  task: Task;
  result: ClaudeResult;
  artifact: RunArtifact;
  outDir: string;
  judgeModel: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<JudgeMetrics> {
  const diff = await diffAgainst(task.chromiumSha);
  const prompt = buildJudgePrompt({
    taskPrompt: task.prompt,
    judgePrompt: task.judgePrompt,
    changedFiles: artifact.changedFiles,
    diff,
    agentReport: reportedText(result),
  });
  const sessionId = randomUUID();
  const command = judgeCommand({ prompt, judgeModel, sessionId });
  const judged = await runJudgeClaude({ command, outDir, timeoutMs, signal });
  saveJudgeTranscript({ sessionId: judged.session_id ?? sessionId, outDir });

  return judgeMetrics({ result: judged, judgeModel });
}

/** Copies the judge session log. A missing log is only a warning: the decision is already in hand. */
function saveJudgeTranscript({ sessionId, outDir }: { sessionId: string; outDir: string }) {
  try {
    const copied = copyTranscript({
      sessionId,
      destDir: outDir,
      fileName: JUDGE_TRANSCRIPT_FILE,
      sessionDirName: "judge-session",
    });

    if (copied) {
      return;
    }

    console.warn(`  judge transcript for session ${sessionId} not found`);
  } catch (error) {
    // The verdict is already computed. A copy failure must not turn a finished judge into a crash.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  judge transcript for session ${sessionId} was not copied: ${message}`);
  }
}

function reportedText(result: ClaudeResult): string {
  if (typeof result.result !== "string") {
    return "";
  }

  return result.result;
}

/** The `claude -p` command for the judge. The session is persisted so its jsonl can be opened later. */
export function judgeCommand({
  prompt,
  judgeModel,
  sessionId,
}: {
  prompt: string;
  judgeModel: string;
  sessionId: string;
}): string[] {
  return [
    "claude",
    "-p",
    prompt,
    "--output-format",
    "json",
    "--json-schema",
    JUDGE_SCHEMA,
    "--model",
    judgeModel,
    "--session-id",
    sessionId,
    "--tools",
    "Read,Grep,Glob",
    "--restricted",
    "--strict-mcp-config",
    "--permission-mode",
    "dontAsk",
    "--permission-prompts",
    "none",
  ];
}

/**
 * Spawns the judge. Never throws: a crash, timeout, or unparseable output becomes a result with is_error set.
 * Writes judge-command.json, judge-result.json, and judge-stderr.log next to the agent's artifacts.
 */
async function runJudgeClaude({
  command,
  outDir,
  timeoutMs,
  signal,
}: {
  command: string[];
  outDir: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<ClaudeResult> {
  await Bun.write(join(outDir, "judge-command.json"), JSON.stringify(command, null, 2));
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.BENCH_RUN_ID;
  const captured = await captureClaude({
    command,
    cwd: CHROMIUM_SRC,
    env,
    timeoutMs,
    signal,
  });
  await Bun.write(join(outDir, "judge-result.json"), captured.stdout);
  await Bun.write(join(outDir, "judge-stderr.log"), captured.stderr);

  return captured.result;
}
