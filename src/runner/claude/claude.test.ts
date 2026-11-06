import { expect, test } from "bun:test";
import { BASELINE_PROMPT, baselinePrompt } from "../../baseline-policy";
import { VALIDATE_PLUGIN_DIR } from "../../paths";
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
    runId: "run",
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
    runId: "run",
  });
  const promptIndex = args.indexOf("--append-system-prompt");

  expect(args[promptIndex + 1]).toBe(`${BASELINE_PROMPT}\n\nuse the graph tools first`);
});

test("auto review attaches chrome-validate", () => {
  const args = claudeArgs({
    task: {
      taskId: "t1",
      prompt: "do it",
      judgePrompt: "score",
      chromiumSha: "abc",
    },
    config: { configId: "haiku-baseline" },
    sessionId: "session",
    runId: "run",
    autoReview: true,
  });

  expect(args).toContain("--plugin-dir");
  expect(args).toContain(VALIDATE_PLUGIN_DIR);
  expect(args.join(" ")).toContain("chrome-validate");
});

test("turning auto review off drops chrome-validate and its instructions", () => {
  const args = claudeArgs({
    task: {
      taskId: "t1",
      prompt: "do it",
      judgePrompt: "score",
      chromiumSha: "abc",
    },
    config: { configId: "haiku-baseline", toolPrompt: "use the graph tools first" },
    sessionId: "session",
    runId: "run",
    autoReview: false,
  });
  const promptIndex = args.indexOf("--append-system-prompt");

  expect(args).not.toContain("--plugin-dir");
  expect(args).not.toContain("--mcp-config");
  expect(args).not.toContain("mcp__chrome-validate__*");
  expect(args[promptIndex + 1]).toBe(`${baselinePrompt({ autoReview: false })}\n\nuse the graph tools first`);
  expect(args[promptIndex + 1]).not.toContain("chrome-validate");
});
