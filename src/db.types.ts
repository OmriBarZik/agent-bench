/** One entry in benchmark-tasks.json. */
export type Task = {
  taskId: string;
  prompt: string;
  /** Rubric the judge uses to score the run from 0 to 1. */
  judgePrompt: string;
  /** Decimal from 0 to 1. A judge score at or above this is stored as success. */
  successThreshold: number;
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
  /** Final assistant text from `claude -p --output-format json`. */
  result?: unknown;
  /** Set when the session was started with `--json-schema`. */
  structured_output?: unknown;
  error?: string;
  [key: string]: unknown;
};

/** Token counts in `ClaudeResult.usage`. */
export type ClaudeUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

/** One judge session, stored as a judge_runs row. Separate from the agent's runs row. */
export type JudgeMetrics = {
  model: string;
  status: "done" | "crashed";
  durationMs: number | null;
  numTurns: number | null;
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationTokens: number | null;
  cacheReadTokens: number | null;
  totalTokens: number | null;
  /** Decimal from 0 to 1 copied from the task. A score at or above it is success. */
  successThreshold: number;
  /** Decimal from 0 to 1, such as 0.2 or 0.743. Null when the judge did not return one. */
  score: number | null;
  /** True when score is at least successThreshold. Null when there is no score. */
  success: boolean | null;
  reason: string | null;
  error: string | null;
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
  score: number | null;
  success: number | null;
  judge_reason: string | null;
  judge_error: string | null;
  success_threshold: number | null;
  judge_model: string | null;
  judge_cost_usd: number | null;
  judge_duration_ms: number | null;
  judge_turns: number | null;
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
  /** Decimal judge score from 0 to 1, or null when this run was not scored. */
  score: number | null;
  /** True when score was at least the threshold stored for that run. */
  success: boolean | null;
  /** Why the judge gave that score, or the error when it did not return one. */
  judgeNote: string | null;
  /** Cutoff used for success, or null when this run was not scored. */
  successThreshold: number | null;
  /** Model that produced the judge session, or null when this run was not judged. */
  judgeModel: string | null;
  judgeCostUsd: number | null;
  judgeDurationMs: number | null;
  judgeTurns: number | null;
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
