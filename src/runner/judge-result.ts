import type { ClaudeResult, Score } from "../db.types";
import type { JudgeVerdict } from "./judge-result.types";

/** Turns the judge session's JSON into the score stored on the run. A missing score leaves the run unscored. */
export function scoreFromJudgeOutput({
  result,
  judgeModel,
  successThreshold,
}: {
  result: ClaudeResult;
  judgeModel: string;
  successThreshold: number;
}): Score {
  const verdict = verdictFromClaude(result);
  const judgeCostUsd = result.total_cost_usd ?? null;

  if (!verdict) {
    return {
      details: {
        judgeModel,
        judgeCostUsd,
        successThreshold,
        judgeError: judgeError(result),
      },
    };
  }

  return {
    score: verdict.score,
    success: verdict.score >= successThreshold,
    details: {
      reason: verdict.reason,
      judgeModel,
      judgeCostUsd,
      successThreshold,
    },
  };
}

/** One line for the runner log: the decimal score, and whether it met the threshold. */
export function judgementText({ score, successThreshold }: { score: Score; successThreshold: number }): string {
  if (score.score == null) {
    return "score n/a";
  }

  const text = score.score.toFixed(3);

  if (score.success) {
    return `score ${text} success`;
  }

  return `score ${text} below ${successThreshold}`;
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
