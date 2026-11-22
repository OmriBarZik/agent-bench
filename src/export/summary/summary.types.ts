/** Judge decision counts for one task × config. */
export type DecisionCounts = {
  pass: number;
  partiallyPass: number;
  partiallyFailed: number;
  failed: number;
  unjudged: number;
};

/** Aggregate results for one task × config, over its done and crashed runs. */
export type SummaryRow = {
  taskId: string;
  configId: string;
  runs: number;
  decisions: DecisionCounts;
  successRate: number | null;
  blockedRuns: number;
  avgCostUsd: number | null;
  avgTotalTokens: number | null;
  avgDurationMin: number | null;
  avgTurns: number | null;
  avgBuilds: number | null;
  avgMinutesBeforeTesting: number | null;
  avgMinutesTesting: number | null;
  /** Null for the Compare against config itself, or when it has no runs on this task. */
  comparison: SummaryComparison | null;
};

/** One task × config against the Compare against config on the same task. Ratios are this ÷ that. */
export type SummaryComparison = {
  against: string;
  againstRuns: number;
  successRateDelta: number | null;
  costRatio: number | null;
  tokensRatio: number | null;
  durationRatio: number | null;
};
