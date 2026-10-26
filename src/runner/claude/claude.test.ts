import { expect, test } from "bun:test";
import { BASELINE_PROMPT } from "../../baseline-policy";
import { claudeArgs } from "./claude";

test("every config gets the baseline prompt", () => {
  const args = claudeArgs({
    task: {
      taskId: "t1",
      prompt: "do it",
      judgePrompt: "score",
      chromiumSha: "abc",
    },
    config: { configId: "haiku-baseline", model: "claude-haiku-5-5" },
    sessionId: "session",
  });
  const promptIndex = args.indexOf("--append-system-prompt");

  expect(promptIndex).toBeGreaterThan(-1);
  expect(args[promptIndex + 1]).toBe(BASELINE_PROMPT);
});

test("a config's tool prompt is appended after the baseline", () => {
  const args = claudeArgs({
    task: {
      taskId: "t1",
      prompt: "do it",
      judgePrompt: "score",
      chromiumSha: "abc",
    },
    config: { configId: "codebase-memory", toolPrompt: "use the graph tools first" },
    sessionId: "session",
  });
  const promptIndex = args.indexOf("--append-system-prompt");

  expect(args[promptIndex + 1]).toBe(`${BASELINE_PROMPT}\n\nuse the graph tools first`);
});
