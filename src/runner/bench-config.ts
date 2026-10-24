/** tasks.json / configs.json: loading, filtering, and the configs row for each config. */
import { resolve } from "node:path";
import { hashFiles } from "../db";
import type { Config, Task } from "../db.types";
import { BENCH_DIR, HOOK_SETTINGS } from "../paths";
import type { BenchConfig, Selection, SelectionSource } from "./bench-config.types";

export async function loadSelection({
  tasksPath,
  configsPath,
  onlyTask,
  onlyConfig,
}: SelectionSource): Promise<Selection> {
  const tasks: Task[] = await Bun.file(tasksPath).json();
  const configs: BenchConfig[] = await Bun.file(configsPath).json();
  const selectedTasks = tasks.filter((task) => !onlyTask || task.taskId === onlyTask);
  const selectedConfigs = configs.filter((config) => !onlyConfig || config.configId === onlyConfig);

  if (!selectedTasks.length || !selectedConfigs.length) {
    throw new Error("no tasks/configs selected");
  }

  return { tasks: selectedTasks, configs: selectedConfigs };
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
