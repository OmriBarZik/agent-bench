import { expect, test } from "bun:test";
import { buildJudgePrompt } from "./judge-prompt";

test("buildJudgePrompt includes the task and the rubric without the reply format", () => {
  const prompt = buildJudgePrompt({
    taskPrompt: "give the dino a hat",
    judgePrompt: "the hat must bounce",
    changedFiles: [{ status: "M", path: "dino.js" }],
    diff: "diff --git a/dino.js",
    agentReport: "I added a hat",
    toolTrouble: [
      { tool: "Bash", command: "cd src && rg hat", ran: false, responsePreview: null },
      { tool: "mcp__serena__find_symbol", command: null, ran: true, responsePreview: '{"error":"not indexed"}' },
    ],
    benchChecks: [],
  });

  expect(prompt).toContain("1 never ran, 1 failed.");
  expect(prompt).toContain("- never ran (denied, or the session ended): Bash: cd src && rg hat");
  expect(prompt).toContain('- failed: mcp__serena__find_symbol -> {"error":"not indexed"}');
  expect(prompt).toContain("give the dino a hat");
  expect(prompt).toContain("the hat must bounce");
  expect(prompt).toContain("M dino.js");
  expect(prompt).not.toContain("partially-failed");
  expect(prompt).not.toContain("partially-pass");
  expect(prompt).not.toContain("Bench checks");
});

test("buildJudgePrompt says when the tree was not changed", () => {
  const prompt = buildJudgePrompt({
    taskPrompt: "task",
    judgePrompt: "rubric",
    changedFiles: [],
    diff: "  ",
    agentReport: "",
    toolTrouble: [],
    benchChecks: [],
  });

  expect(prompt).toContain("(none recorded)");
  expect(prompt).toContain("(no files changed)");
  expect(prompt).toContain("(no diff; the tree matches the task commit)");
  expect(prompt).toContain("(no final message)");
});

test("buildJudgePrompt shows bench checks as evidence the judge must still verify in the code", () => {
  const prompt = buildJudgePrompt({
    taskPrompt: "task",
    judgePrompt: "rubric",
    changedFiles: [],
    diff: "",
    agentReport: "",
    toolTrouble: [],
    benchChecks: [{ name: "asset copies", status: "fail", detail: "dino/sprite.png is not byte-identical." }],
  });

  expect(prompt).toContain("## Bench checks of the final tree");
  expect(prompt).toContain("- [fail] asset copies: dino/sprite.png is not byte-identical.");
  expect(prompt).toContain("Read the code yourself for every requirement.");
});
