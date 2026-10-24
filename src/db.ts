/**
 * Benchmark results DB: a single SQLite file (data/bench.sqlite), no server to start.
 *
 *   import { openDb, startRun, finishRun } from "./src/db";
 *   const db = openDb();                  // creates the file + schema on first use
 *   startRun({ db, run: { runId, taskId, configId, repeat, claudeVersion, model } });
 *   // ...run `claude -p ... --output-format json` ...
 *   finishRun({ db, runId, result, score: { success: true } });
 *   db.close();
 *
 * Uses Bun's built-in bun:sqlite — no npm dependencies.
 */
import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join } from "node:path";
import type { ClaudeResult, Config, RunStart, Score, Task, ToolCall } from "./db.types";
import { BENCH_DIR } from "./paths";

export const DB_PATH = process.env.BENCH_DB_PATH ?? join(BENCH_DIR, "data", "bench.sqlite");
const SCHEMA = readFileSync(join(BENCH_DIR, "db", "schema.sql"), "utf8");

/** JSON value -> TEXT column (null stays NULL). */
const toJson = (value: unknown) => (value == null ? null : JSON.stringify(value));

/** Open (or create) the DB and apply the idempotent schema. */
export function openDb(path = DB_PATH): Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true, strict: true });
  // WAL + busy_timeout: hook processes write while the runner holds the DB open.
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");
  db.run("PRAGMA foreign_keys = ON");
  db.run(SCHEMA);

  return db;
}

export function upsertTask({ db, task }: { db: Database; task: Task }) {
  db.query(
    `INSERT INTO tasks (task_id, title, difficulty, prompt, chromium_sha, scoring)
     VALUES ($taskId, $title, $difficulty, $prompt, $chromiumSha, $scoring)
     ON CONFLICT (task_id) DO UPDATE SET
       title = excluded.title, difficulty = excluded.difficulty, prompt = excluded.prompt,
       chromium_sha = excluded.chromium_sha, scoring = excluded.scoring`,
  ).run({
    taskId: task.taskId,
    title: task.title ?? null,
    difficulty: task.difficulty ?? null,
    prompt: task.prompt,
    chromiumSha: task.chromiumSha,
    scoring: toJson(task.scoring),
  });
}

export function upsertConfig({ db, config }: { db: Database; config: Config }) {
  db.query(
    `INSERT INTO configs (config_id, description, config_hash, tools, permissions)
     VALUES ($configId, $description, $configHash, $tools, $permissions)
     ON CONFLICT (config_id) DO UPDATE SET
       description = excluded.description, config_hash = excluded.config_hash,
       tools = excluded.tools, permissions = excluded.permissions`,
  ).run({
    configId: config.configId,
    description: config.description ?? null,
    configHash: config.configHash,
    tools: toJson(config.tools),
    permissions: toJson(config.permissions),
  });
}

/** sha256 of the files that define a tool setup (MCP config, skills, CLAUDE.md, settings). */
export async function hashFiles(paths: string[]): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for (const filePath of [...paths].sort()) {
    hasher.update(filePath);
    hasher.update(await Bun.file(filePath).arrayBuffer());
  }

  return hasher.digest("hex");
}

export function startRun({ db, run }: { db: Database; run: RunStart }) {
  db.query(
    `INSERT INTO runs (run_id, task_id, config_id, repeat, claude_version, model,
                       machine, artifacts_path)
     VALUES ($runId, $taskId, $configId, $repeat, $claudeVersion, $model,
             $machine, $artifactsPath)`,
  ).run({
    runId: run.runId,
    taskId: run.taskId,
    configId: run.configId,
    repeat: run.repeat,
    claudeVersion: run.claudeVersion,
    model: run.model,
    machine: hostname(),
    artifactsPath: run.artifactsPath ?? null,
  });
}

export function finishRun({
  db,
  runId,
  result,
  score = {},
}: {
  db: Database;
  runId: string;
  result: ClaudeResult;
  score?: Score;
}) {
  const usage = result.usage ?? {};
  db.query(
    `UPDATE runs SET
       finished_at        = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       status             = $status,
       duration_ms        = $durationMs,
       num_turns          = $numTurns,
       cost_usd           = $costUsd,
       input_tokens       = $inputTokens,
       output_tokens      = $outputTokens,
       cache_read_tokens  = $cacheReadTokens,
       permission_denials = $permissionDenials,
       success            = $success,
       score              = $score,
       score_details      = $scoreDetails,
       raw_result         = $rawResult
     WHERE run_id = $runId`,
  ).run({
    runId,
    status: result.is_error ? "crashed" : "done",
    durationMs: result.duration_ms ?? null,
    numTurns: result.num_turns ?? null,
    costUsd: result.total_cost_usd ?? null,
    inputTokens: usage.input_tokens ?? null,
    outputTokens: usage.output_tokens ?? null,
    cacheReadTokens: usage.cache_read_input_tokens ?? null,
    permissionDenials: result.permission_denials?.length ?? 0,
    success: score.success ?? null,
    score: score.score ?? null,
    scoreDetails: toJson(score.details),
    rawResult: toJson(result),
  });
}

export function logToolCall({ db, call }: { db: Database; call: ToolCall }) {
  db.query(
    `INSERT INTO tool_calls (run_id, session_id, tool_use_id, phase, tool, program,
                             command, is_error, response_preview)
     VALUES ($runId, $sessionId, $toolUseId, $phase, $tool, $program,
             $command, $isError, $responsePreview)`,
  ).run({
    runId: call.runId,
    sessionId: call.sessionId ?? null,
    toolUseId: call.toolUseId ?? null,
    phase: call.phase,
    tool: call.tool ?? null,
    program: call.program ?? null,
    command: call.command ?? null,
    isError: call.isError ?? null,
    responsePreview: call.responsePreview ?? null,
  });
}
