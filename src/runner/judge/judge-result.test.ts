import { expect, test } from "bun:test";
import { cancelledJudgeMetrics, judgeMetrics, judgementText } from "./judge-result";

test("a decimal score succeeds when it reaches the threshold", () => {
  const judge = judgeMetrics({
    result: {
      structured_output: { score: 0.743, reason: "most of the hat" },
      duration_ms: 12_000,
      num_turns: 4,
      total_cost_usd: 0.041,
      usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 1, cache_read_input_tokens: 2 },
    },
    judgeModel: "claude-sonnet-5-5",
    successThreshold: 0.7,
  });

  expect(judge.score).toBe(0.743);
  expect(judge.success).toBe(true);
  expect(judge.successThreshold).toBe(0.7);
  expect(judge.status).toBe("done");
  expect(judge.durationMs).toBe(12_000);
  expect(judge.numTurns).toBe(4);
  expect(judge.costUsd).toBe(0.041);
  expect(judge.totalTokens).toBe(18);
  expect(judge.reason).toBe("most of the hat");
  expect(judge.error).toBeNull();
  expect(judgementText({ judge, successThreshold: 0.7 })).toBe("score 0.743 success, judge 12s $0.041");
});

test("cancelledJudgeMetrics drops the score and keeps the usage already captured", () => {
  const judge = cancelledJudgeMetrics({
    judgeModel: "claude-sonnet-5-5",
    successThreshold: 0.8,
    judge: {
      model: "claude-sonnet-5-5",
      status: "crashed",
      durationMs: 3_000,
      numTurns: 2,
      costUsd: 0.02,
      inputTokens: 5,
      outputTokens: 1,
      cacheCreationTokens: null,
      cacheReadTokens: null,
      totalTokens: 6,
      successThreshold: 0.8,
      score: 0.4,
      success: false,
      reason: "partial",
      error: "killed",
    },
  });

  expect(judge.status).toBe("cancelled");
  expect(judge.score).toBeNull();
  expect(judge.success).toBeNull();
  expect(judge.reason).toBeNull();
  expect(judge.error).toBe("cancelled");
  expect(judge.durationMs).toBe(3_000);
  expect(judge.costUsd).toBe(0.02);
  expect(judge.totalTokens).toBe(6);
});

test("a decimal score below the threshold is not success", () => {
  const judge = judgeMetrics({
    result: { result: '{"score": 0.2, "reason": "only the sprite"}' },
    judgeModel: "claude-sonnet-5-5",
    successThreshold: 0.8,
  });

  expect(judge.score).toBe(0.2);
  expect(judge.success).toBe(false);
  expect(judgementText({ judge, successThreshold: 0.8 })).toBe("score 0.200 below 0.8");
});

test("a score of 1 is not required for success", () => {
  const judge = judgeMetrics({
    result: { structured_output: { score: 0.8, reason: "enough" } },
    judgeModel: "claude-sonnet-5-5",
    successThreshold: 0.8,
  });

  expect(judge.success).toBe(true);
});

test("a score outside 0 to 1 is left unscored", () => {
  const judge = judgeMetrics({
    result: { structured_output: { score: 2, reason: "too high" } },
    judgeModel: "claude-sonnet-5-5",
    successThreshold: 0.8,
  });

  expect(judge.score).toBeNull();
  expect(judge.success).toBeNull();
  expect(judge.error).toBe("judge returned no score");
  expect(judgementText({ judge, successThreshold: 0.8 })).toBe("score n/a");
});

test("fenced JSON still yields the decimal score", () => {
  const judge = judgeMetrics({
    result: { result: '```json\n{"score": 0.743, "reason": "partial"}\n```' },
    judgeModel: "claude-sonnet-5-5",
    successThreshold: 0.8,
  });

  expect(judge.score).toBe(0.743);
  expect(judge.success).toBe(false);
});
