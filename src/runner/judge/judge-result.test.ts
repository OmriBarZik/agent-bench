import { expect, test } from "bun:test";
import { cancelledJudgeMetrics, judgeMetrics, judgementText } from "./judge-result";

test("pass is success", () => {
  const judge = judgeMetrics({
    result: {
      structured_output: { decision: "pass", reason: "every item is present" },
      duration_ms: 12_000,
      num_turns: 4,
      total_cost_usd: 0.041,
      usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 1, cache_read_input_tokens: 2 },
    },
    judgeModel: "claude-sonnet-5-5",
  });

  expect(judge.decision).toBe("pass");
  expect(judge.success).toBe(true);
  expect(judge.status).toBe("done");
  expect(judge.durationMs).toBe(12_000);
  expect(judge.numTurns).toBe(4);
  expect(judge.costUsd).toBe(0.041);
  expect(judge.totalTokens).toBe(18);
  expect(judge.reason).toBe("every item is present");
  expect(judge.error).toBeNull();
  expect(judgementText({ judge })).toBe("decision pass, judge 12s $0.041");
});

test("partially-pass is success", () => {
  const judge = judgeMetrics({
    result: { structured_output: { decision: "partially-pass", reason: "the hat misses one state" } },
    judgeModel: "claude-sonnet-5-5",
  });

  expect(judge.decision).toBe("partially-pass");
  expect(judge.success).toBe(true);
  expect(judgementText({ judge })).toBe("decision partially-pass");
});

test("partially-failed is not success", () => {
  const judge = judgeMetrics({
    result: { structured_output: { decision: "partially-failed", reason: "only the sprite" } },
    judgeModel: "claude-sonnet-5-5",
  });

  expect(judge.decision).toBe("partially-failed");
  expect(judge.success).toBe(false);
  expect(judgementText({ judge })).toBe("decision partially-failed");
});

test("failed is not success", () => {
  const judge = judgeMetrics({
    result: { structured_output: { decision: "failed", reason: "no hat" } },
    judgeModel: "claude-sonnet-5-5",
  });

  expect(judge.decision).toBe("failed");
  expect(judge.success).toBe(false);
});

test("cancelledJudgeMetrics drops the decision and keeps the usage already captured", () => {
  const judge = cancelledJudgeMetrics({
    judgeModel: "claude-sonnet-5-5",
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
      decision: "partially-failed",
      success: false,
      reason: "partial",
      error: "killed",
    },
  });

  expect(judge.status).toBe("cancelled");
  expect(judge.decision).toBeNull();
  expect(judge.success).toBeNull();
  expect(judge.reason).toBeNull();
  expect(judge.error).toBe("cancelled");
  expect(judge.durationMs).toBe(3_000);
  expect(judge.costUsd).toBe(0.02);
  expect(judge.totalTokens).toBe(6);
});

test("a number is left undecided", () => {
  const judge = judgeMetrics({
    result: { structured_output: { decision: 0.743, reason: "old shape" } },
    judgeModel: "claude-sonnet-5-5",
  });

  expect(judge.decision).toBeNull();
  expect(judge.success).toBeNull();
  expect(judge.error).toBe("judge returned no decision");
  expect(judgementText({ judge })).toBe("decision n/a");
});

test("an unknown label is left undecided", () => {
  const judge = judgeMetrics({
    result: { structured_output: { decision: "maybe", reason: "unsure" } },
    judgeModel: "claude-sonnet-5-5",
  });

  expect(judge.decision).toBeNull();
  expect(judge.success).toBeNull();
});

test("a decision written only in the final message is ignored", () => {
  const judge = judgeMetrics({
    result: { result: '```json\n{"decision": "partially-pass", "reason": "partial"}\n```' },
    judgeModel: "claude-sonnet-5-5",
  });

  expect(judge.decision).toBeNull();
  expect(judge.success).toBeNull();
  expect(judge.error).toBe("judge returned no decision");
});
