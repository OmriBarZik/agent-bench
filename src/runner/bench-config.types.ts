import type { Task } from "../db.types";

/** One entry in benchmark-tasks.json: a Task whose prompt lives in a markdown file instead of inline. */
export type TaskEntry = Omit<Task, "prompt"> & {
  /** Path to the prompt markdown file, relative to the tasks file (e.g. prompts/dino-hat.md). */
  promptFile: string;
};

/** One entry in benchmark-setup.json. */
export type BenchConfig = {
  configId: string;
  description?: string;
  model?: string;
  mcpConfig?: string[];
  strictMcpConfig?: boolean;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: string;
  extraFiles?: string[];
};

/** Tasks and configs left after the --only-task / --only-config filters. */
export type Selection = {
  tasks: Task[];
  configs: BenchConfig[];
};

/** Where to read tasks/configs from, and the optional --only-* filters. */
export type SelectionSource = {
  tasksPath: string;
  configsPath: string;
  onlyTask?: string;
  onlyConfig?: string;
};
