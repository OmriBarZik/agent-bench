import { expect, test } from "bun:test";
import { judgementText, scoreFromJudgeOutput } from "./judge-result";

test("a decimal score succeeds when it reaches the threshold", () => {
  const score = scoreFromJudgeOutput({
    result: { structured_output: { score: 0.743, reason: "most of the hat" } },
    judgeModel: "claude-sonnet-5-5",
    successThreshold: 0.7,
  });

  expect(score.score).toBe(0.743);
  expect(score.success).toBe(true);
  expect(score.details?.successThreshold).toBe(0.7);
  expect(judgementText({ score, successThreshold: 0.7 })).toBe("score 0.743 success");
});

test("a decimal score below the threshold is not success", () => {
  const score = scoreFromJudgeOutput({
    result: { result: '{"score": 0.2, "reason": "only the sprite"}' },
    judgeModel: "claude-sonnet-5-5",
    successThreshold: 0.8,
  });

  expect(score.score).toBe(0.2);
  expect(score.success).toBe(false);
  expect(judgementText({ score, successThreshold: 0.8 })).toBe("score 0.200 below 0.8");
});

test("a score of 1 is not required for success", () => {
  const score = scoreFromJudgeOutput({
    result: { structured_output: { score: 0.8, reason: "enough" } },
    judgeModel: "claude-sonnet-5-5",
    successThreshold: 0.8,
  });

  expect(score.success).toBe(true);
});

test("a score outside 0 to 1 is left unscored", () => {
  const score = scoreFromJudgeOutput({
    result: { structured_output: { score: 2, reason: "too high" } },
    judgeModel: "claude-sonnet-5-5",
    successThreshold: 0.8,
  });

  expect(score.score).toBeUndefined();
  expect(score.success).toBeUndefined();
  expect(score.details?.judgeError).toBe("judge returned no score");
});

test("fenced JSON still yields the decimal score", () => {
  const score = scoreFromJudgeOutput({
    result: { result: '```json\n{"score": 0.743, "reason": "partial"}\n```' },
    judgeModel: "claude-sonnet-5-5",
    successThreshold: 0.8,
  });

  expect(score.score).toBe(0.743);
  expect(score.success).toBe(false);
});
