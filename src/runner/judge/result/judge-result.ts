import type { ClaudeResult, ClaudeUsage, JudgeMetrics } from "../../../db/db.types";
import { decisionSucceeds, isJudgeDecision } from "../../../db/judge-decision";
import { readBlockers } from "./judge-blockers";
import type { JudgeVerdict } from "./judge-result.types";

/** Turns a finished judge session into the judge_runs row. A missing decision leaves decision and success null. */
export function judgeMetrics({ result, judgeModel }: { result: ClaudeResult; judgeModel: string }): JudgeMetrics {
  const verdict = verdictFromClaude(result);
  const usage = result.usage ?? {};
  const reason = verdict?.reason.trim() ?? "";

  return {
    model: judgeModel,
    status: result.is_error ? "crashed" : "done",
    durationMs: result.duration_ms ?? null,
    numTurns: result.num_turns ?? null,
    costUsd: result.total_cost_usd ?? null,
    inputTokens: usage.input_tokens ?? null,
    outputTokens: usage.output_tokens ?? null,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? null,
    cacheReadTokens: usage.cache_read_input_tokens ?? null,
    totalTokens: tokenTotal(usage),
    decision: verdict?.decision ?? null,
    success: verdict == null ? null : decisionSucceeds(verdict.decision),
    reason: reason === "" ? null : reason,
    error: verdict ? null : judgeError(result),
    blocked: verdict?.blocked ?? null,
    blockers: verdict?.blockers ?? [],
  };
}

/**
 * A judge session the user stopped. Drops the decision so an aborted verdict is not stored as success.
 * Keeps whatever duration, cost, and tokens were already captured.
 */
export function cancelledJudgeMetrics({
  judgeModel,
  judge,
}: {
  judgeModel: string;
  judge?: JudgeMetrics;
}): JudgeMetrics {
  return {
    model: judge?.model ?? judgeModel,
    status: "cancelled",
    durationMs: judge?.durationMs ?? null,
    numTurns: judge?.numTurns ?? null,
    costUsd: judge?.costUsd ?? null,
    inputTokens: judge?.inputTokens ?? null,
    outputTokens: judge?.outputTokens ?? null,
    cacheCreationTokens: judge?.cacheCreationTokens ?? null,
    cacheReadTokens: judge?.cacheReadTokens ?? null,
    totalTokens: judge?.totalTokens ?? null,
    decision: null,
    success: null,
    reason: null,
    error: "cancelled",
    blocked: null,
    blockers: [],
  };
}

/** A judge session that threw before it returned JSON. The agent run is already stored. */
export function failedJudgeMetrics({ judgeModel, error }: { judgeModel: string; error: string }): JudgeMetrics {
  return {
    model: judgeModel,
    status: "crashed",
    durationMs: null,
    numTurns: null,
    costUsd: null,
    inputTokens: null,
    outputTokens: null,
    cacheCreationTokens: null,
    cacheReadTokens: null,
    totalTokens: null,
    decision: null,
    success: null,
    reason: null,
    error,
    blocked: null,
    blockers: [],
  };
}

/** One line for the runner log: the decision, and the judge's own time and cost. */
export function judgementText({ judge }: { judge: JudgeMetrics }): string {
  const verdict = verdictText(judge);
  const usage = usageText(judge);

  if (!usage) {
    return verdict;
  }

  return `${verdict}, ${usage}`;
}

function verdictText(judge: JudgeMetrics): string {
  if (judge.decision == null) {
    return "decision n/a";
  }

  if (judge.blocked) {
    return `decision ${judge.decision}, BLOCKED`;
  }

  return `decision ${judge.decision}`;
}

function usageText(judge: JudgeMetrics): string | null {
  const parts: string[] = [];

  if (judge.durationMs != null) {
    parts.push(`${Math.round(judge.durationMs / 1000)}s`);
  }

  if (judge.costUsd != null) {
    parts.push(`$${judge.costUsd.toFixed(3)}`);
  }

  if (parts.length === 0) {
    return null;
  }

  return `judge ${parts.join(" ")}`;
}

function tokenTotal(usage: ClaudeUsage): number | null {
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

function verdictFromClaude(result: ClaudeResult): JudgeVerdict | null {
  return readVerdict(result.structured_output);
}

function readVerdict(value: unknown): JudgeVerdict | null {
  if (typeof value === "string") {
    return parseVerdict(value);
  }

  return verdictFromUnknown(value);
}

function parseVerdict(text: string): JudgeVerdict | null {
  try {
    return verdictFromUnknown(JSON.parse(text));
  } catch {
    return null;
  }
}

function verdictFromUnknown(value: unknown): JudgeVerdict | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as { decision?: unknown; reason?: unknown; blocked?: unknown; blockers?: unknown };

  if (!isJudgeDecision(record.decision)) {
    return null;
  }

  const reason = typeof record.reason === "string" ? record.reason.trim() : "";
  const blockers = readBlockers(record.blockers);

  return { decision: record.decision, reason, blocked: record.blocked === true || blockers.length > 0, blockers };
}

function judgeError(result: ClaudeResult): string {
  if (typeof result.error === "string" && result.error !== "") {
    return result.error;
  }

  if (result.is_error) {
    return "judge session failed";
  }

  return "judge returned no decision";
}
