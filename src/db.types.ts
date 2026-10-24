/** One entry in benchmark-tasks.json. */
export type Task = {
  taskId: string;
  prompt: string;
  chromiumSha: string;
  title?: string;
  difficulty?: "simple" | "medium" | "complex" | string;
  scoring?: unknown;
};

/** The configs table row for one benchmark-setup.json entry. */
export type Config = {
  configId: string;
  configHash: string;
  description?: string;
  tools?: unknown;
  permissions?: unknown;
};

/** What startRun needs to insert the runs row before claude is spawned. */
export type RunStart = {
  runId: string;
  taskId: string;
  configId: string;
  repeat: number;
  claudeVersion: string;
  model: string;
  artifactsPath?: string;
  /** Git branch checked out for this run. The same string as runId. */
  branch: string;
};

/** One path that differs between the task SHA and the run branch. */
export type ChangedFile = {
  /** git name-status letter: M, A, D, R, C, T. */
  status: string;
  path: string;
  /** Set for a rename or copy. */
  previousPath?: string;
};

/** The Chromium commit that holds a run's final tree, and the paths in it. */
export type RunArtifact = {
  /** NULL when the branch tip is still the task SHA. */
  commitSha: string | null;
  changedFiles: ChangedFile[];
};

/** Shape of `claude -p ... --output-format json` (only the fields we read). */
export type ClaudeResult = {
  is_error?: boolean;
  duration_ms?: number;
  num_turns?: number;
  total_cost_usd?: number;
  session_id?: string;
  permission_denials?: unknown[];
  usage?: ClaudeUsage;
  [key: string]: unknown;
};

/** Token counts in `ClaudeResult.usage`. */
export type ClaudeUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

/** Scoring outcome stored on a finished run (all optional until scoring exists). */
export type Score = {
  success?: boolean;
  score?: number;
  details?: unknown;
};

/** Columns read by listRunBranches. Snake case, matching the query. */
export type RunBranchSql = {
  run_id: string;
  task_id: string | null;
  config_id: string | null;
  repeat: number | null;
  status: string | null;
  started_at: string | null;
  branch: string;
  model: string | null;
  commit_sha: string | null;
  changed_files: string | null;
  artifacts_path: string | null;
  title: string | null;
};

/** One run that recorded a branch, newest-first in the inspect list. */
export type RunBranchRow = {
  runId: string;
  taskId: string;
  configId: string;
  repeat: number;
  status: string;
  startedAt: string;
  branch: string;
  model: string;
  title: string | null;
  commitSha: string | null;
  changedFiles: ChangedFile[];
  artifactsPath: string | null;
};

/** One PreToolUse/PostToolUse hook event, stored as a tool_calls row. */
export type ToolCall = {
  runId: string;
  phase: "pre" | "post";
  sessionId?: string;
  toolUseId?: string;
  tool?: string;
  program?: string | null;
  command?: string | null;
  isError?: boolean | null;
  responsePreview?: string | null;
};
