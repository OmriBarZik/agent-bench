import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BENCH_DIR } from "../../paths";
import { loadSelection, toConfigRow } from "./bench-config";

test("loadSelection reads the task prompt and the judge prompt", async () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-tasks-"));
  try {
    const taskDir = join(directory, "tasks", "t1");
    mkdirSync(taskDir, { recursive: true });
    await Bun.write(join(taskDir, "prompt.md"), "  do the thing  \n");
    await Bun.write(join(taskDir, "judge.md"), "  score the thing  \n");
    await Bun.write(
      join(directory, "tasks.json"),
      JSON.stringify([
        {
          taskId: "t1",
          promptFile: "tasks/t1/prompt.md",
          judgePromptFile: "tasks/t1/judge.md",
          chromiumSha: "abc",
        },
      ]),
    );
    await Bun.write(join(directory, "configs.json"), JSON.stringify([{ configId: "baseline" }]));
    const selection = await loadSelection({
      tasksPath: join(directory, "tasks.json"),
      configsPath: join(directory, "configs.json"),
    });

    expect(selection.tasks[0]).toMatchObject({
      taskId: "t1",
      prompt: "do the thing",
      judgePrompt: "score the thing",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("loadSelection rejects a task with no judge prompt", async () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-tasks-"));
  try {
    await Bun.write(join(directory, "task.md"), "do the thing");
    await Bun.write(
      join(directory, "tasks.json"),
      JSON.stringify([{ taskId: "t1", promptFile: "task.md", chromiumSha: "abc" }]),
    );
    await Bun.write(join(directory, "configs.json"), JSON.stringify([{ configId: "baseline" }]));

    await expect(
      loadSelection({
        tasksPath: join(directory, "tasks.json"),
        configsPath: join(directory, "configs.json"),
      }),
    ).rejects.toThrow("t1 needs promptFile and judgePromptFile");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the shipped configs load their tool prompts", async () => {
  const selection = await loadSelection({
    tasksPath: join(BENCH_DIR, "configs/benchmark-tasks.json"),
    configsPath: join(BENCH_DIR, "configs/benchmark-setup.json"),
  });
  const toolPromptByConfig = new Map(selection.configs.map((config) => [config.configId, config.toolPrompt]));

  expect(toolPromptByConfig.get("baseline")).toBeUndefined();
  expect(toolPromptByConfig.get("haiku-baseline")).toBeUndefined();
  expect(toolPromptByConfig.get("codebase-memory")).toContain("mcp__codebase-memory-mcp__");
  expect(toolPromptByConfig.get("serena")).toContain("mcp__serena__");
});

test("loadSelection reads a config's tool prompt", async () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-tools-"));
  try {
    const taskDir = join(directory, "tasks", "t1");
    mkdirSync(taskDir, { recursive: true });
    await Bun.write(join(taskDir, "prompt.md"), "do the thing");
    await Bun.write(join(taskDir, "judge.md"), "score the thing");
    await Bun.write(join(directory, "tools.md"), "  use the graph tools first  \n");
    await Bun.write(
      join(directory, "tasks.json"),
      JSON.stringify([
        {
          taskId: "t1",
          promptFile: "tasks/t1/prompt.md",
          judgePromptFile: "tasks/t1/judge.md",
          chromiumSha: "abc",
        },
      ]),
    );
    await Bun.write(
      join(directory, "configs.json"),
      JSON.stringify([{ configId: "codebase-memory", toolPromptFile: join(directory, "tools.md") }]),
    );
    const selection = await loadSelection({
      tasksPath: join(directory, "tasks.json"),
      configsPath: join(directory, "configs.json"),
    });

    expect(selection.configs[0]?.toolPrompt).toBe("use the graph tools first");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("loadSelection rejects a missing tool prompt", async () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-tools-"));
  try {
    const taskDir = join(directory, "tasks", "t1");
    mkdirSync(taskDir, { recursive: true });
    await Bun.write(join(taskDir, "prompt.md"), "do the thing");
    await Bun.write(join(taskDir, "judge.md"), "score the thing");
    await Bun.write(
      join(directory, "tasks.json"),
      JSON.stringify([
        {
          taskId: "t1",
          promptFile: "tasks/t1/prompt.md",
          judgePromptFile: "tasks/t1/judge.md",
          chromiumSha: "abc",
        },
      ]),
    );
    await Bun.write(
      join(directory, "configs.json"),
      JSON.stringify([{ configId: "serena", toolPromptFile: join(directory, "missing.md") }]),
    );

    await expect(
      loadSelection({
        tasksPath: join(directory, "tasks.json"),
        configsPath: join(directory, "configs.json"),
      }),
    ).rejects.toThrow("serena tool prompt not found");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("toConfigRow hashes the tool prompt", async () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-tools-"));
  try {
    const promptPath = join(directory, "tools.md");
    await Bun.write(promptPath, "use the graph\n");
    const first = await toConfigRow({ configId: "codebase-memory", toolPromptFile: promptPath });
    await Bun.write(promptPath, "use the graph differently\n");
    const second = await toConfigRow({ configId: "codebase-memory", toolPromptFile: promptPath });

    expect(first.configHash).not.toBe(second.configHash);
    expect(first.tools).toMatchObject({ toolPromptFile: promptPath });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
