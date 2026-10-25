import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSelection } from "./bench-config";

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
