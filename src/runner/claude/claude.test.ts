import { expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { BASELINE_PROMPT, baselinePrompt } from "../../baseline-policy";
import { BENCH_DIR, CHROMIUM_SRC, CLANGD_PLUGIN_DIR, VALIDATE_PLUGIN_DIR } from "../../paths";
import { claudeArgs } from "./claude";
import { languageServerPathEntries } from "./language-server-path";

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

test("a language-server config loads its plugin next to chrome-validate", () => {
  const args = claudeArgs({
    task: {
      taskId: "t1",
      prompt: "do it",
      judgePrompt: "score",
      chromiumSha: "abc",
    },
    config: {
      configId: "clangd-typescript",
      pluginDirs: ["plugins/clangd-lsp", "plugins/typescript-lsp"],
      allowedTools: ["LSP"],
    },
    sessionId: "session",
    runId: "run",
    autoReview: true,
  });

  expect(args).toContain(VALIDATE_PLUGIN_DIR);
  expect(args).toContain(CLANGD_PLUGIN_DIR);
  expect(args).toContain(resolve(BENCH_DIR, "plugins/typescript-lsp"));
  expect(args).toContain("LSP");
});

test("a language-server config keeps its plugin when auto review is off", () => {
  const args = claudeArgs({
    task: {
      taskId: "t1",
      prompt: "do it",
      judgePrompt: "score",
      chromiumSha: "abc",
    },
    config: { configId: "typescript", pluginDirs: ["plugins/typescript-lsp"] },
    sessionId: "session",
    runId: "run",
    autoReview: false,
  });

  expect(args).toContain(resolve(BENCH_DIR, "plugins/typescript-lsp"));
  expect(args).not.toContain(VALIDATE_PLUGIN_DIR);
  expect(args).not.toContain("mcp__chrome-validate__*");
});

test("only a clangd config prepends the checkout clangd to PATH", () => {
  const clangdBin = join(CHROMIUM_SRC, "third_party/llvm-build/Release+Asserts/bin");

  expect(languageServerPathEntries({ pluginDirs: ["plugins/clangd-lsp"] })).toEqual([clangdBin]);
  expect(languageServerPathEntries({ pluginDirs: ["plugins/clangd-lsp", "plugins/typescript-lsp"] })).toEqual([
    clangdBin,
  ]);
  expect(languageServerPathEntries({ pluginDirs: ["plugins/typescript-lsp"] })).toEqual([]);
  expect(languageServerPathEntries({})).toEqual([]);
});
