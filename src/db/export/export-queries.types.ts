/** One task row as the export reads it. */
export type ExportTaskRow = {
  taskId: string;
  title: string | null;
  difficulty: string | null;
  prompt: string;
  promptVersion: string | null;
  judgePrompt: string | null;
  judgePromptVersion: string | null;
  chromiumSha: string;
  scoring: string | null;
};

/** One config row as the export reads it. `tools` and `permissions` are JSON text. */
export type ExportConfigRow = {
  configId: string;
  description: string | null;
  configHash: string;
  tools: string | null;
  permissions: string | null;
};

/** One run joined with its judge session and run_findings. JSON columns stay text. */
export type ExportRunRow = {
  runId: string;
  taskId: string;
  configId: string;
  repeat: number;
  promptVersion: string | null;
  judgePromptVersion: string | null;
  claudeVersion: string | null;
  model: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  testingStartedAt: string | null;
  status: string | null;
  durationMs: number | null;
  numTurns: number | null;
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationTokens: number | null;
  cacheReadTokens: number | null;
  totalTokens: number | null;
  permissionDenials: number | null;
  autoReview: number | null;
  branch: string | null;
  commitSha: string | null;
  changedFiles: string | null;
  finalMessage: string | null;
  judgeStatus: string | null;
  judgeModel: string | null;
  judgeCostUsd: number | null;
  judgeDurationMs: number | null;
  judgeFinishedAt: string | null;
  decision: string | null;
  success: number | null;
  reason: string | null;
  judgeError: string | null;
  blocked: number | null;
  blockers: string | null;
  judgeChecks: string | null;
  setupToolCalls: number | null;
  firstGameSourceTurn: number | null;
  firstGameSourceTokens: number | null;
  firstPanelRegTurn: number | null;
  firstPanelRegTokens: number | null;
  diagnosticsDeliveries: number | null;
  diagnosticsErrors: number | null;
};

/** One run_phases row. */
export type ExportPhaseRow = {
  runId: string;
  phase: string;
  turns: number | null;
  durationMs: number | null;
  totalTokens: number | null;
  costUsd: number | null;
};

/** One chrome-validate build the agent started; `error` is cut to keep the export small. */
export type ExportBuildRow = {
  runId: string;
  buildNumber: number;
  status: string;
  failedStep: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
};

/** Attempts per run, tool and Bash program. */
export type ExportToolUsageRow = {
  runId: string;
  tool: string | null;
  program: string | null;
  calls: number;
  notRan: number;
  failed: number;
};

/** One tool call that was denied or failed, with its command cut short. */
export type ExportToolTroubleRow = {
  runId: string;
  tool: string | null;
  programs: string | null;
  command: string | null;
  ran: number;
  isError: number;
};
