import { dirname, resolve } from "node:path";
import { hashFiles } from "../../db/db";
import type { Config, Task } from "../../db/db.types";
import { BASELINE_HASH_FILES, BENCH_DIR } from "../../paths";
import type { BenchConfig, BenchConfigEntry, Selection, SelectionSource, TaskEntry } from "./bench-config.types";

/** Reads benchmark-tasks.json (loading each task's prompt and judge prompt) and benchmark-setup.json, then applies the --only-* filters. */
export async function loadSelection({
  tasksPath,
  configsPath,
  onlyTask,
  onlyConfig,
}: SelectionSource): Promise<Selection> {
  const taskEntries: TaskEntry[] = await Bun.file(tasksPath).json();
  const tasks = await Promise.all(taskEntries.map((entry) => loadTask({ entry, tasksDir: dirname(tasksPath) })));
  const configEntries: BenchConfigEntry[] = await Bun.file(configsPath).json();
  const configs = await Promise.all(configEntries.map((entry) => loadConfig(entry)));
  const selectedTasks = tasks.filter((task) => !onlyTask || task.taskId === onlyTask);
  const selectedConfigs = configs.filter((config) => !onlyConfig || config.configId === onlyConfig);

  if (!selectedTasks.length || !selectedConfigs.length) {
    throw new Error("no tasks/configs selected");
  }

  return { tasks: selectedTasks, configs: selectedConfigs };
}

/** Turns a benchmark-tasks.json entry into a Task by reading its prompt files, which are relative to the tasks file. */
async function loadTask({ entry, tasksDir }: { entry: TaskEntry; tasksDir: string }): Promise<Task> {
  if (!entry.promptFile || !entry.judgePromptFile) {
    throw new Error(`${entry.taskId} needs promptFile and judgePromptFile`);
  }

  const prompt = await readTrimmed({
    path: resolve(tasksDir, entry.promptFile),
    owner: entry.taskId,
    label: "prompt",
  });
  const judgePrompt = await readTrimmed({
    path: resolve(tasksDir, entry.judgePromptFile),
    owner: entry.taskId,
    label: "judge prompt",
  });

  return {
    taskId: entry.taskId,
    title: entry.title,
    difficulty: entry.difficulty,
    prompt,
    judgePrompt,
    chromiumSha: entry.chromiumSha,
    scoring: entry.scoring,
  };
}

/** Reads toolPromptFile from the repo root and attaches the trimmed text. */
async function loadConfig(entry: BenchConfigEntry): Promise<BenchConfig> {
  if (!entry.toolPromptFile) {
    return entry;
  }

  const toolPrompt = await readTrimmed({
    path: resolve(BENCH_DIR, entry.toolPromptFile),
    owner: entry.configId,
    label: "tool prompt",
  });

  return { ...entry, toolPrompt };
}

async function readTrimmed({ path, owner, label }: { path: string; owner: string; label: string }): Promise<string> {
  const file = Bun.file(path);

  if (!(await file.exists())) {
    throw new Error(`${owner} ${label} not found: ${path}`);
  }

  const text = (await file.text()).trim();

  if (text === "") {
    throw new Error(`${owner} ${label} is empty: ${path}`);
  }

  return text;
}

/** The configs row: config_hash covers the shared baseline, MCP configs, the tool prompt, and extraFiles. */
export async function toConfigRow(config: BenchConfig): Promise<Config> {
  const files = [
    ...BASELINE_HASH_FILES,
    ...(config.mcpConfig ?? []),
    ...(config.toolPromptFile ? [config.toolPromptFile] : []),
    ...(config.extraFiles ?? []),
  ].map((path) => resolve(BENCH_DIR, path));

  return {
    configId: config.configId,
    description: config.description,
    configHash: await hashFiles(files),
    tools: {
      model: config.model,
      mcpConfig: config.mcpConfig,
      strictMcpConfig: config.strictMcpConfig,
      toolPromptFile: config.toolPromptFile,
    },
    permissions: {
      allowedTools: config.allowedTools,
      disallowedTools: config.disallowedTools,
      permissionMode: config.permissionMode,
    },
  };
}
