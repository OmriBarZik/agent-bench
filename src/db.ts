import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join } from "node:path";
import type {
  ChangedFile,
  ClaudeResult,
  ClaudeUsage,
  Config,
  RunArtifact,
  RunBranchRow,
  RunBranchSql,
  RunStart,
  Score,
  Task,
  ToolCall,
} from "./db.types";
import { BENCH_DIR } from "./paths";

export const DB_PATH = process.env.BENCH_DB_PATH ?? join(BENCH_DIR, "data", "bench.sqlite");
const SCHEMA = readFileSync(join(BENCH_DIR, "db", "schema.sql"), "utf8");

/** JSON value -> TEXT column (null stays NULL). */
const toJson = (value: unknown) => (value == null ? null : JSON.stringify(value));

/**
 * Opens the results DB, a single SQLite file (data/bench.sqlite) with no server to start. Creates the file and
 * applies the idempotent schema on first use.
 *
 *   const db = openDb();
 *   startRun({ db, run: { runId, taskId, configId, repeat, claudeVersion, model } });
 *   // ...run `claude -p ... --output-format json`...
 *   finishRun({ db, runId, result, score: { success: true } });
 *   db.close();
 */
export function openDb(path = DB_PATH): Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true, strict: true });
  // WAL + busy_timeout: hook processes write while the runner holds the DB open.
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");
  db.run("PRAGMA foreign_keys = ON");
  db.run(SCHEMA);
  // CREATE TABLE IF NOT EXISTS will not add columns to a database that already exists.
  ensureRunColumns(db);

  return db;
}

/** Columns added after the first bench.sqlite. Idempotent so opening an old file keeps working. */
function ensureRunColumns(db: Database) {
  const present = new Set((db.query("PRAGMA table_info(runs)").all() as { name: string }[]).map((row) => row.name));
  const added = [
    ["branch", "TEXT"],
    ["commit_sha", "TEXT"],
    ["changed_files", "TEXT"],
    ["total_tokens", "INTEGER"],
    ["cache_creation_tokens", "INTEGER"],
  ] as const;
  for (const [name, definition] of added) {
    if (present.has(name)) {
      continue;
    }

    db.run(`ALTER TABLE runs ADD COLUMN ${name} ${definition}`);

    if (name === "total_tokens") {
      backfillTotalTokens(db);
    }

    if (name === "cache_creation_tokens") {
      backfillCacheCreationTokens(db);
    }
  }
}

/** Fills cache_creation_tokens on old runs from the stored Claude JSON. Runs once, when the column is added. */
function backfillCacheCreationTokens(db: Database) {
  db.run(
    `UPDATE runs SET cache_creation_tokens = json_extract(raw_result, '$.usage.cache_creation_input_tokens')
     WHERE cache_creation_tokens IS NULL AND json_extract(raw_result, '$.usage') IS NOT NULL`,
  );
}

/** Fills total_tokens on old runs from the stored Claude JSON. Runs once, when the column is added. */
function backfillTotalTokens(db: Database) {
  db.run(
    `UPDATE runs SET total_tokens =
       COALESCE(json_extract(raw_result, '$.usage.input_tokens'), 0) +
       COALESCE(json_extract(raw_result, '$.usage.cache_creation_input_tokens'), 0) +
       COALESCE(json_extract(raw_result, '$.usage.cache_read_input_tokens'), 0) +
       COALESCE(json_extract(raw_result, '$.usage.output_tokens'), 0)
     WHERE total_tokens IS NULL AND json_extract(raw_result, '$.usage') IS NOT NULL`,
  );
}

/** Fresh input, cache write, cache read and output: the counts behind total_cost_usd. Null when Claude reported no usage. */
function totalTokens(usage: ClaudeUsage): number | null {
  const counts = [
    usage.input_tokens,
    usage.cache_creation_input_tokens,
    usage.cache_read_input_tokens,
    usage.output_tokens,
  ];
  if (counts.every((count) => count == null)) {
    return null;
  }

  let total = 0;
  for (const count of counts) {
    total += count ?? 0;
  }

  return total;
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
                       machine, artifacts_path, branch)
     VALUES ($runId, $taskId, $configId, $repeat, $claudeVersion, $model,
             $machine, $artifactsPath, $branch)`,
  ).run({
    runId: run.runId,
    taskId: run.taskId,
    configId: run.configId,
    repeat: run.repeat,
    claudeVersion: run.claudeVersion,
    model: run.model,
    machine: hostname(),
    artifactsPath: run.artifactsPath ?? null,
    branch: run.branch,
  });
}

export function finishRun({
  db,
  runId,
  result,
  score = {},
  artifact = { commitSha: null, changedFiles: [] },
}: {
  db: Database;
  runId: string;
  result: ClaudeResult;
  score?: Score;
  artifact?: RunArtifact;
}) {
  const usage = result.usage ?? {};
  db.query(
    `UPDATE runs SET
       finished_at        = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       status             = $status,
       duration_ms        = $durationMs,
       num_turns          = $numTurns,
       cost_usd           = $costUsd,
       input_tokens          = $inputTokens,
       output_tokens         = $outputTokens,
       cache_creation_tokens = $cacheCreationTokens,
       cache_read_tokens     = $cacheReadTokens,
       total_tokens          = $totalTokens,
       permission_denials = $permissionDenials,
       success            = $success,
       score              = $score,
       score_details      = $scoreDetails,
       raw_result         = $rawResult,
       commit_sha         = $commitSha,
       changed_files      = $changedFiles
     WHERE run_id = $runId`,
  ).run({
    runId,
    status: result.is_error ? "crashed" : "done",
    durationMs: result.duration_ms ?? null,
    numTurns: result.num_turns ?? null,
    costUsd: result.total_cost_usd ?? null,
    inputTokens: usage.input_tokens ?? null,
    outputTokens: usage.output_tokens ?? null,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? null,
    cacheReadTokens: usage.cache_read_input_tokens ?? null,
    totalTokens: totalTokens(usage),
    permissionDenials: result.permission_denials?.length ?? 0,
    success: score.success ?? null,
    score: score.score ?? null,
    scoreDetails: toJson(score.details),
    rawResult: toJson(result),
    commitSha: artifact.commitSha,
    changedFiles: toJson(artifact.changedFiles),
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

/** Runs that recorded a branch, newest first. This is the list the inspect command shows. */
export function listRunBranches(db: Database): RunBranchRow[] {
  const rows = db
    .query(
      `SELECT runs.run_id, runs.task_id, runs.config_id, runs.repeat, runs.status, runs.started_at,
            runs.branch, runs.model, runs.commit_sha, runs.changed_files, runs.artifacts_path,
            tasks.title AS title
     FROM runs
     LEFT JOIN tasks ON tasks.task_id = runs.task_id
     WHERE runs.branch IS NOT NULL AND runs.branch != ''
     ORDER BY runs.started_at DESC`,
    )
    .all() as RunBranchSql[];

  return rows.map((row) => toRunBranchRow(row));
}

function toRunBranchRow(row: RunBranchSql): RunBranchRow {
  return {
    runId: row.run_id,
    taskId: row.task_id ?? "",
    configId: row.config_id ?? "",
    repeat: row.repeat ?? 0,
    status: row.status ?? "running",
    startedAt: row.started_at ?? "",
    branch: row.branch,
    model: row.model ?? "",
    title: row.title,
    commitSha: row.commit_sha,
    changedFiles: parseChangedFiles(row.changed_files),
    artifactsPath: row.artifacts_path,
  };
}

function parseChangedFiles(raw: string | null): ChangedFile[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as ChangedFile[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    // One corrupt cell should not stop the run list from opening.
    return [];
  }
}
