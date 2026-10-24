import type { ClaudeResult, ClaudeUsage, JudgeMetrics } from "../../db/db.types";
import type { JudgeVerdict } from "./judge-result.types";

/** Turns a finished judge session into the judge_runs row. A missing score leaves score and success null. */
export function judgeMetrics({
  result,
  judgeModel,
  successThreshold,
}: {
  result: ClaudeResult;
  judgeModel: string;
  successThreshold: number;
}): JudgeMetrics {
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
    successThreshold,
    score: verdict?.score ?? null,
    success: verdict == null ? null : verdict.score >= successThreshold,
    reason: reason === "" ? null : reason,
    error: verdict ? null : judgeError(result),
  };
}

/**
 * A judge session the user stopped. Drops the score so an aborted verdict is not stored as success.
 * Keeps whatever duration, cost, and tokens were already captured.
 */
export function cancelledJudgeMetrics({
  judgeModel,
  successThreshold,
  judge,
}: {
  judgeModel: string;
  successThreshold: number;
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
    successThreshold: judge?.successThreshold ?? successThreshold,
    score: null,
    success: null,
    reason: null,
    error: "cancelled",
  };
}

/** A judge session that threw before it returned JSON. The agent run is already stored. */
export function failedJudgeMetrics({
  judgeModel,
  successThreshold,
  error,
}: {
  judgeModel: string;
  successThreshold: number;
  error: string;
}): JudgeMetrics {
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
    successThreshold,
    score: null,
    success: null,
    reason: null,
    error,
  };
}

/** One line for the runner log: the decimal score, whether it met the threshold, and the judge's own time and cost. */
export function judgementText({ judge, successThreshold }: { judge: JudgeMetrics; successThreshold: number }): string {
  const verdict = verdictText({ judge, successThreshold });
  const usage = usageText(judge);

  if (!usage) {
    return verdict;
  }

  return `${verdict}, ${usage}`;
}

function verdictText({ judge, successThreshold }: { judge: JudgeMetrics; successThreshold: number }): string {
  if (judge.score == null) {
    return "score n/a";
  }

  const text = judge.score.toFixed(3);

  if (judge.success) {
    return `score ${text} success`;
  }

  return `score ${text} below ${successThreshold}`;
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
  const structured = readVerdict(result.structured_output);

  if (structured) {
    return structured;
  }

  return readVerdict(result.result);
}

function readVerdict(value: unknown): JudgeVerdict | null {
  if (typeof value === "string") {
    return verdictFromText(value);
  }

  return verdictFromUnknown(value);
}

function verdictFromText(text: string): JudgeVerdict | null {
  const trimmed = text.trim();
  const direct = parseVerdict(trimmed);

  if (direct) {
    return direct;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);

  if (fenced?.[1]) {
    const fromFence = parseVerdict(fenced[1]);

    if (fromFence) {
      return fromFence;
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end <= start) {
    return null;
  }

  return parseVerdict(trimmed.slice(start, end + 1));
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

  const record = value as { reason?: unknown; score?: unknown };
  const score = asScore(record.score);

  if (score == null) {
    return null;
  }

  const reason = typeof record.reason === "string" ? record.reason.trim() : "";

  return { score, reason };
}

function asScore(value: unknown): number | null {
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const numeric = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    return null;
  }

  return numeric;
}

function judgeError(result: ClaudeResult): string {
  if (typeof result.error === "string" && result.error !== "") {
    return result.error;
  }

  if (result.is_error) {
    return "judge session failed";
  }

  return "judge returned no score";
}
