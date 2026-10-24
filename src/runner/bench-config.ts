import { dirname, resolve } from "node:path";
import { hashFiles } from "../db";
import type { Config, Task } from "../db.types";
import { BENCH_DIR, HOOK_SETTINGS } from "../paths";
import type { BenchConfig, Selection, SelectionSource, TaskEntry } from "./bench-config.types";

/** Reads benchmark-tasks.json (loading each task's prompt from its promptFile) and benchmark-setup.json, then applies the --only-* filters. */
export async function loadSelection({
  tasksPath,
  configsPath,
  onlyTask,
  onlyConfig,
}: SelectionSource): Promise<Selection> {
  const taskEntries: TaskEntry[] = await Bun.file(tasksPath).json();
  const tasks = await Promise.all(taskEntries.map((entry) => loadTask({ entry, tasksDir: dirname(tasksPath) })));
  const configs: BenchConfig[] = await Bun.file(configsPath).json();
  const selectedTasks = tasks.filter((task) => !onlyTask || task.taskId === onlyTask);
  const selectedConfigs = configs.filter((config) => !onlyConfig || config.configId === onlyConfig);

  if (!selectedTasks.length || !selectedConfigs.length) {
    throw new Error("no tasks/configs selected");
  }

  return { tasks: selectedTasks, configs: selectedConfigs };
}

/** Turns a benchmark-tasks.json entry into a Task by reading its prompt file, which is relative to the tasks file. */
async function loadTask({
  entry: { promptFile, ...task },
  tasksDir,
}: {
  entry: TaskEntry;
  tasksDir: string;
}): Promise<Task> {
  const prompt = (await Bun.file(resolve(tasksDir, promptFile)).text()).trim();

  return { ...task, prompt };
}

/** The configs row: config_hash covers the hook settings, MCP configs and extraFiles. */
export async function toConfigRow(config: BenchConfig): Promise<Config> {
  const files = [HOOK_SETTINGS, ...(config.mcpConfig ?? []), ...(config.extraFiles ?? [])].map((path) =>
    resolve(BENCH_DIR, path),
  );

  return {
    configId: config.configId,
    description: config.description,
    configHash: await hashFiles(files),
    tools: {
      model: config.model,
      mcpConfig: config.mcpConfig,
      strictMcpConfig: config.strictMcpConfig,
    },
    permissions: {
      allowedTools: config.allowedTools,
      disallowedTools: config.disallowedTools,
      permissionMode: config.permissionMode,
    },
  };
}
