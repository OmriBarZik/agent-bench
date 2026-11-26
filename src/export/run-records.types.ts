/** One deterministic check the runner ran on the final tree (runs/<run_id>/bench-checks.json). */
export type BenchCheck = {
  name: string;
  status: string;
  detail?: string;
};

/** Tokens and cost the agent spent in one phase of a run. */
export type PhaseRecord = {
  phase: string;
  turns: number | null;
  /** Work time: wall clock minus waits on chrome-validate tools (builds and Chrome runs). */
  durationMs: number | null;
  totalTokens: number | null;
  costUsd: number | null;
};

/** One chrome-validate build the agent started. */
export type BuildRecord = {
  buildNumber: number;
  status: string;
  failedStep: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
};

/** How often the agent used one tool (or one Bash program) in a run. */
export type ToolUsageRecord = {
  tool: string | null;
  program: string | null;
  calls: number;
  notRan: number;
  failed: number;
};

/** One tool call that was denied (ran = false) or ran and failed. */
export type ToolTroubleRecord = {
  tool: string | null;
  programs: string | null;
  command: string | null;
  ran: boolean;
  failed: boolean;
};

/** The read-only judge's verdict on a run. */
export type JudgeRecord = {
  status: string | null;
  model: string | null;
  decision: string | null;
  success: boolean | null;
  reason: string | null;
  error: string | null;
  blocked: boolean | null;
  blockers: unknown;
  checks: unknown;
  costUsd: number | null;
  durationMs: number | null;
};

/** The turn and context tokens at the agent's first look at a kind of file; null fields when it never did. */
export type FindingPointRecord = {
  turn: number | null;
  tokens: number | null;
};

/**
 * Code-measured findings (run_findings): calls to the config's own setup tools (null for baseline or no setupTools)
 * and when the agent first opened the dino game sources and a DevTools panel registration. Null when not measured.
 */
export type FindingsRecord = {
  setupToolCalls: number | null;
  firstGameSource: FindingPointRecord;
  firstPanelRegistration: FindingPointRecord;
  /** Times language-server diagnostics arrived after an edit; null before they were counted. */
  diagnosticsDeliveries: number | null;
  /** Error-severity diagnostics across those deliveries. */
  diagnosticsErrors: number | null;
};

/**
 * When a run moved between stages (ISO-8601 UTC). testingStartedAt is the agent's first chrome-validate call; null
 * when it never built or tested. finishedAt is when the agent session stopped, before the judge.
 */
export type TimelineRecord = {
  startedAt: string | null;
  testingStartedAt: string | null;
  firstBuildStartedAt: string | null;
  lastBuildFinishedAt: string | null;
  finishedAt: string | null;
  judgeFinishedAt: string | null;
  minutesBeforeTesting: number | null;
  minutesTesting: number | null;
};

/** Agent metrics for one run. */
export type AgentRecord = {
  model: string | null;
  claudeVersion: string | null;
  status: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  numTurns: number | null;
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationTokens: number | null;
  cacheReadTokens: number | null;
  totalTokens: number | null;
  permissionDenials: number | null;
  autoReview: boolean | null;
  finalMessage: string | null;
};

/** Everything known about one task × config × repeat run, as one JSON line of runs.jsonl. */
export type RunRecord = {
  runId: string;
  taskId: string;
  configId: string;
  repeat: number;
  promptVersion: string | null;
  judgePromptVersion: string | null;
  timeline: TimelineRecord;
  agent: AgentRecord;
  judge: JudgeRecord;
  findings: FindingsRecord | null;
  benchChecks: BenchCheck[] | null;
  branch: string | null;
  commitSha: string | null;
  changedFiles: unknown;
  phases: PhaseRecord[];
  builds: BuildRecord[];
  toolUsage: ToolUsageRecord[];
  toolTrouble: ToolTroubleRecord[];
};
