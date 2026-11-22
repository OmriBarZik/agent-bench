import type { RunRecord } from "../run-records.types";
import type { DecisionCounts, SummaryRow } from "./summary.types";

/** Only finished runs count, the same as the dashboard. */
const COUNTED_STATUSES = new Set(["done", "crashed"]);

/** One row per task × config, ordered by task, then best success rate, then lowest cost. */
export function summarizeRuns(runs: RunRecord[]): SummaryRow[] {
  const counted = runs.filter((run) => COUNTED_STATUSES.has(run.agent.status ?? ""));
  const groups = Map.groupBy(counted, (run) => `${run.taskId}\u0000${run.configId}`);
  const rows = [...groups.values()].map(summarizeGroup);

  return rows.sort(
    (left, right) =>
      left.taskId.localeCompare(right.taskId) ||
      (right.successRate ?? -1) - (left.successRate ?? -1) ||
      (left.avgCostUsd ?? 0) - (right.avgCostUsd ?? 0),
  );
}

function summarizeGroup(runs: RunRecord[]): SummaryRow {
  const decisions = countDecisions(runs);
  const judged = runs.length - decisions.unjudged;

  return {
    taskId: runs[0]!.taskId,
    configId: runs[0]!.configId,
    runs: runs.length,
    decisions,
    successRate: judged === 0 ? null : (decisions.pass + decisions.partiallyPass) / judged,
    blockedRuns: runs.filter((run) => run.judge.blocked).length,
    avgCostUsd: average(runs.map((run) => run.agent.costUsd)),
    avgTotalTokens: average(runs.map((run) => run.agent.totalTokens)),
    avgDurationMin: average(runs.map((run) => (run.agent.durationMs == null ? null : run.agent.durationMs / 60000))),
    avgTurns: average(runs.map((run) => run.agent.numTurns)),
    avgBuilds: average(runs.map((run) => run.builds.length)),
    avgMinutesBeforeTesting: average(runs.map((run) => run.timeline.minutesBeforeTesting)),
    avgMinutesTesting: average(runs.map((run) => run.timeline.minutesTesting)),
    comparison: null,
  };
}

function countDecisions(runs: RunRecord[]): DecisionCounts {
  const counts: DecisionCounts = { pass: 0, partiallyPass: 0, partiallyFailed: 0, failed: 0, unjudged: 0 };

  for (const run of runs) {
    const decision = run.judge.decision;

    if (decision === "pass") {
      counts.pass += 1;
    } else if (decision === "partially-pass") {
      counts.partiallyPass += 1;
    } else if (decision === "partially-failed") {
      counts.partiallyFailed += 1;
    } else if (decision === "failed") {
      counts.failed += 1;
    } else {
      counts.unjudged += 1;
    }
  }

  return counts;
}

function average(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value != null);

  return present.length === 0 ? null : present.reduce((sum, value) => sum + value, 0) / present.length;
}
