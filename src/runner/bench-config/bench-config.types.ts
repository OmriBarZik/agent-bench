import type { Task } from "../../db/db.types";

/** One entry in benchmark-tasks.json: a Task whose prompts live in markdown files instead of inline. */
export type TaskEntry = Omit<Task, "prompt" | "judgePrompt"> & {
  /** Path to the task prompt, relative to the tasks file (e.g. prompts/dino-hat.md). */
  promptFile: string;
  /** Path to the judge rubric, relative to the tasks file. The judge scores the finished tree from 0 to 1. */
  judgePromptFile: string;
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
