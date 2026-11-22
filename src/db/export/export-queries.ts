import type { Database } from "bun:sqlite";
import type {
  ExportBuildRow,
  ExportConfigRow,
  ExportPhaseRow,
  ExportRunRow,
  ExportTaskRow,
  ExportToolTroubleRow,
  ExportToolUsageRow,
} from "./export-queries.types";

export function listExportTasks(db: Database): ExportTaskRow[] {
  return db
    .query(
      `SELECT task_id AS taskId, title, difficulty, prompt, prompt_version AS promptVersion,
              judge_prompt AS judgePrompt, judge_prompt_version AS judgePromptVersion,
              chromium_sha AS chromiumSha, scoring
       FROM tasks ORDER BY task_id`,
    )
    .all() as ExportTaskRow[];
}

export function listExportConfigs(db: Database): ExportConfigRow[] {
  return db
    .query(
      `SELECT config_id AS configId, description, config_hash AS configHash, tools, permissions
       FROM configs ORDER BY config_id`,
    )
    .all() as ExportConfigRow[];
}

/**
 * Every run with its judge session; the agent's final message comes from raw_result. testingStartedAt is the first
 * chrome-validate call (start_build, wait_build, run_chrome), the same point where run_phases starts validation.
 */
export function listExportRuns(db: Database): ExportRunRow[] {
  return db
    .query(
      `SELECT r.run_id AS runId, r.task_id AS taskId, r.config_id AS configId, r.repeat,
              r.prompt_version AS promptVersion, r.judge_prompt_version AS judgePromptVersion,
              r.claude_version AS claudeVersion, r.model, r.started_at AS startedAt, r.finished_at AS finishedAt,
              (SELECT MIN(t.ts) FROM tool_calls t
               WHERE t.run_id = r.run_id AND t.phase = 'pre' AND t.tool GLOB 'mcp__chrome-validate__*')
                AS testingStartedAt,
              r.status, r.duration_ms AS durationMs, r.num_turns AS numTurns, r.cost_usd AS costUsd,
              r.input_tokens AS inputTokens, r.output_tokens AS outputTokens,
              r.cache_creation_tokens AS cacheCreationTokens, r.cache_read_tokens AS cacheReadTokens,
              r.total_tokens AS totalTokens, r.permission_denials AS permissionDenials,
              r.auto_review AS autoReview, r.branch, r.commit_sha AS commitSha, r.changed_files AS changedFiles,
              json_extract(r.raw_result, '$.result') AS finalMessage,
              j.status AS judgeStatus, j.model AS judgeModel, j.cost_usd AS judgeCostUsd,
              j.duration_ms AS judgeDurationMs, j.finished_at AS judgeFinishedAt, j.decision, j.success, j.reason, j.error AS judgeError,
              j.blocked, j.blockers
       FROM runs r LEFT JOIN judge_runs j ON j.run_id = r.run_id
       ORDER BY r.task_id, r.config_id, r.started_at`,
    )
    .all() as ExportRunRow[];
}

export function listExportPhases(db: Database): ExportPhaseRow[] {
  return db
    .query(
      `SELECT run_id AS runId, phase, turns, duration_ms AS durationMs, total_tokens AS totalTokens,
              cost_usd AS costUsd
       FROM run_phases ORDER BY run_id, phase`,
    )
    .all() as ExportPhaseRow[];
}

export function listExportBuilds(db: Database): ExportBuildRow[] {
  return db
    .query(
      `SELECT run_id AS runId, build_number AS buildNumber, status, failed_step AS failedStep,
              started_at AS startedAt, finished_at AS finishedAt,
              duration_ms AS durationMs, substr(error, 1, 1500) AS error
       FROM builds ORDER BY run_id, build_number`,
    )
    .all() as ExportBuildRow[];
}

/** Tool attempts per run, counted by tool and (for Bash) by program. */
export function listExportToolUsage(db: Database): ExportToolUsageRow[] {
  return db
    .query(
      `SELECT run_id AS runId, tool, program, COUNT(*) AS calls, SUM(ran = 0) AS notRan, SUM(is_error) AS failed
       FROM tool_attempts GROUP BY run_id, tool, program ORDER BY run_id, calls DESC`,
    )
    .all() as ExportToolUsageRow[];
}

/** Tool calls that never ran (denied) or ran and failed, one row per tool_use_id. */
export function listExportToolTrouble(db: Database): ExportToolTroubleRow[] {
  return db
    .query(
      `SELECT run_id AS runId, tool, group_concat(DISTINCT program) AS programs,
              substr(MIN(command), 1, 400) AS command, MAX(ran) AS ran, MAX(is_error) AS isError
       FROM tool_attempts WHERE ran = 0 OR is_error = 1
       GROUP BY run_id, tool_use_id ORDER BY run_id`,
    )
    .all() as ExportToolTroubleRow[];
}
