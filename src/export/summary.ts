import type { RunRecord } from "./run-records.types";
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

/** The summary as markdown, one table per task. */
export function summaryMarkdown(rows: SummaryRow[]): string {
  const lines: string[] = [];

  for (const [taskId, taskRows] of Map.groupBy(rows, (row) => row.taskId)) {
    lines.push(`### ${taskId}`, "");
    lines.push(
      "| config | runs | success | pass / p-pass / p-fail / fail | blocked | avg cost $ | avg tokens | avg min | avg turns | avg builds |",
    );
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");

    for (const row of taskRows) {
      const decisions = row.decisions;
      lines.push(
        `| ${row.configId} | ${row.runs} | ${percent(row.successRate)} | ${decisions.pass} / ${decisions.partiallyPass} / ${decisions.partiallyFailed} / ${decisions.failed} | ${row.blockedRuns} | ${fixed(row.avgCostUsd, 2)} | ${fixed(row.avgTotalTokens, 0)} | ${fixed(row.avgDurationMin, 1)} | ${fixed(row.avgTurns, 0)} | ${fixed(row.avgBuilds, 1)} |`,
      );
    }

    lines.push("");
  }

  return lines.join("\n");
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

function percent(value: number | null): string {
  return value == null ? "–" : `${Math.round(value * 100)}%`;
}

function fixed(value: number | null, digits: number): string {
  return value == null ? "–" : value.toFixed(digits);
}
