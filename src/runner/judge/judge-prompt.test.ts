import { expect, test } from "bun:test";
import { buildJudgePrompt } from "./judge-prompt";

test("buildJudgePrompt includes the task and the rubric without the reply format", () => {
  const prompt = buildJudgePrompt({
    taskPrompt: "give the dino a hat",
    judgePrompt: "the hat must bounce",
    changedFiles: [{ status: "M", path: "dino.js" }],
    diff: "diff --git a/dino.js",
    agentReport: "I added a hat",
  });

  expect(prompt).toContain("give the dino a hat");
  expect(prompt).toContain("the hat must bounce");
  expect(prompt).toContain("M dino.js");
  expect(prompt).not.toContain("partially-failed");
  expect(prompt).not.toContain("partially-pass");
});

test("buildJudgePrompt says when the tree was not changed", () => {
  const prompt = buildJudgePrompt({
    taskPrompt: "task",
    judgePrompt: "rubric",
    changedFiles: [],
    diff: "  ",
    agentReport: "",
  });

  expect(prompt).toContain("(no files changed)");
  expect(prompt).toContain("(no diff; the tree matches the task commit)");
  expect(prompt).toContain("(no final message)");
});
