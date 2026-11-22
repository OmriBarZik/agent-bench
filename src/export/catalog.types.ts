/** A benchmark task: what the agent was asked to do and how the judge grades it. */
export type TaskRecord = {
  taskId: string;
  title: string | null;
  difficulty: string | null;
  validate: string | null;
  chromiumSha: string;
  promptVersion: string | null;
  judgePromptVersion: string | null;
  scoring: unknown;
  prompt: string;
  judgePrompt: string | null;
};

/** A tool setup (config) the agent ran under, with the tool prompt it was given. */
export type ConfigRecord = {
  configId: string;
  description: string | null;
  configHash: string;
  tools: unknown;
  permissions: unknown;
  toolPrompt: string | null;
};

/** The validate mode per task id, read from configs/benchmark-tasks.json. */
export type TaskValidateMap = Map<string, string>;
