import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  listExportBuilds,
  listExportPhases,
  listExportRuns,
  listExportToolTrouble,
  listExportToolUsage,
} from "../db/export/export-queries";
import type { ExportRunRow } from "../db/export/export-queries.types";
import type { BenchCheck, JudgeRecord, RunRecord } from "./run-records.types";

/** Most denied or failed calls kept per run, so one noisy run does not swamp the export. */
const MAX_TROUBLE_PER_RUN = 40;

/** Builds one record per run from the DB and runs/<run_id>/bench-checks.json. Reads only. */
export function buildRunRecords({ db, runsDir }: { db: Database; runsDir: string }): RunRecord[] {
  const phases = Map.groupBy(listExportPhases(db), (row) => row.runId);
  const builds = Map.groupBy(listExportBuilds(db), (row) => row.runId);
  const toolUsage = Map.groupBy(listExportToolUsage(db), (row) => row.runId);
  const toolTrouble = Map.groupBy(listExportToolTrouble(db), (row) => row.runId);

  return listExportRuns(db).map((run) => ({
    runId: run.runId,
    taskId: run.taskId,
    configId: run.configId,
    repeat: run.repeat,
    promptVersion: run.promptVersion,
    judgePromptVersion: run.judgePromptVersion,
    agent: {
      model: run.model,
      claudeVersion: run.claudeVersion,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      durationMs: run.durationMs,
      numTurns: run.numTurns,
      costUsd: run.costUsd,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      cacheCreationTokens: run.cacheCreationTokens,
      cacheReadTokens: run.cacheReadTokens,
      totalTokens: run.totalTokens,
      permissionDenials: run.permissionDenials,
      autoReview: toBoolean(run.autoReview),
      finalMessage: run.finalMessage,
    },
    judge: toJudgeRecord(run),
    benchChecks: readBenchChecks(join(runsDir, run.runId, "bench-checks.json")),
    branch: run.branch,
    commitSha: run.commitSha,
    changedFiles: parseJson(run.changedFiles),
    phases: (phases.get(run.runId) ?? []).map(({ runId, ...phase }) => phase),
    builds: (builds.get(run.runId) ?? []).map(({ runId, ...build }) => build),
    toolUsage: (toolUsage.get(run.runId) ?? []).map(({ runId, ...usage }) => usage),
    toolTrouble: (toolTrouble.get(run.runId) ?? []).slice(0, MAX_TROUBLE_PER_RUN).map((trouble) => ({
      tool: trouble.tool,
      programs: trouble.programs,
      command: trouble.command,
      ran: trouble.ran === 1,
      failed: trouble.isError === 1,
    })),
  }));
}

function toJudgeRecord(run: ExportRunRow): JudgeRecord {
  return {
    status: run.judgeStatus,
    model: run.judgeModel,
    decision: run.decision,
    success: toBoolean(run.success),
    reason: run.reason,
    error: run.judgeError,
    blocked: toBoolean(run.blocked),
    blockers: parseJson(run.blockers),
    costUsd: run.judgeCostUsd,
    durationMs: run.judgeDurationMs,
  };
}

function toBoolean(value: number | null): boolean | null {
  return value == null ? null : value === 1;
}

function parseJson(text: string | null): unknown {
  if (text == null) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    // A malformed column is still worth exporting, so keep the raw text.
    return text;
  }
}

function readBenchChecks(path: string): BenchCheck[] | null {
  if (!existsSync(path)) {
    return null;
  }

  const checks = parseJson(readFileSync(path, "utf8"));

  return Array.isArray(checks) ? checks : null;
}
