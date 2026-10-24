/** Row and payload types for src/db.ts. */

export type Task = {
  taskId: string;
  prompt: string;
  chromiumSha: string;
  title?: string;
  difficulty?: "simple" | "medium" | "complex" | string;
  scoring?: unknown;
};

export type Config = {
  configId: string;
  configHash: string;
  description?: string;
  tools?: unknown;
  permissions?: unknown;
};

export type RunStart = {
  runId: string;
  taskId: string;
  configId: string;
  repeat: number;
  claudeVersion: string;
  model: string;
  artifactsPath?: string;
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
  cache_read_input_tokens?: number;
};

/** Scoring outcome stored on a finished run (all optional until scoring exists). */
export type Score = {
  success?: boolean;
  score?: number;
  details?: unknown;
};

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
