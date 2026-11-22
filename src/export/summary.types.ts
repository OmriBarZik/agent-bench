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
};
