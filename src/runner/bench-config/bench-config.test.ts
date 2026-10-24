import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSelection } from "./bench-config";

test("loadSelection reads the task prompt and the judge prompt", async () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-tasks-"));
  try {
    const prompts = join(directory, "prompts");
    mkdirSync(prompts);
    await Bun.write(join(prompts, "task.md"), "  do the thing  \n");
    await Bun.write(join(prompts, "judge.md"), "  score the thing  \n");
    await Bun.write(
      join(directory, "tasks.json"),
      JSON.stringify([
        {
          taskId: "t1",
          promptFile: "prompts/task.md",
          judgePromptFile: "prompts/judge.md",
          successThreshold: 0.8,
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
      successThreshold: 0.8,
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

test("loadSelection rejects a successThreshold outside 0 to 1", async () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-bench-tasks-"));
  try {
    await Bun.write(join(directory, "task.md"), "do the thing");
    await Bun.write(join(directory, "judge.md"), "score it");
    await Bun.write(
      join(directory, "tasks.json"),
      JSON.stringify([
        {
          taskId: "t1",
          promptFile: "task.md",
          judgePromptFile: "judge.md",
          successThreshold: 2,
          chromiumSha: "abc",
        },
      ]),
    );
    await Bun.write(join(directory, "configs.json"), JSON.stringify([{ configId: "baseline" }]));

    await expect(
      loadSelection({
        tasksPath: join(directory, "tasks.json"),
        configsPath: join(directory, "configs.json"),
      }),
    ).rejects.toThrow("t1 successThreshold must be a decimal from 0 to 1");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
