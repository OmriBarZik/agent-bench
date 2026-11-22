import type { SummaryRow } from "./summary.types";

/** The summary as markdown, one table per task, with columns against the Compare against config. */
export function summaryMarkdown({ rows, compareAgainst }: { rows: SummaryRow[]; compareAgainst: string }): string {
  const lines: string[] = [
    `Ratios are this config ÷ ${compareAgainst} on the same task (below 1 is cheaper or faster). Δ success is in percentage points.`,
    "",
  ];

  for (const [taskId, taskRows] of Map.groupBy(rows, (row) => row.taskId)) {
    lines.push(`### ${taskId}`, "");
    lines.push(
      `| config | runs | success | pass / p-pass / p-fail / fail | blocked | avg cost $ | avg tokens | avg min | min before testing | min testing | avg turns | avg builds | Δ success vs ${compareAgainst} | cost × | tokens × | min × |`,
    );
    lines.push(`|${" --- |".repeat(16)}`);

    for (const row of taskRows) {
      lines.push(rowLine(row));
    }

    lines.push("");
  }

  return lines.join("\n");
}

function rowLine(row: SummaryRow): string {
  const decisions = row.decisions;
  const comparison = row.comparison;
  const cells = [
    row.configId,
    String(row.runs),
    percent(row.successRate),
    `${decisions.pass} / ${decisions.partiallyPass} / ${decisions.partiallyFailed} / ${decisions.failed}`,
    String(row.blockedRuns),
    fixed({ value: row.avgCostUsd, digits: 2 }),
    fixed({ value: row.avgTotalTokens, digits: 0 }),
    fixed({ value: row.avgDurationMin, digits: 1 }),
    fixed({ value: row.avgMinutesBeforeTesting, digits: 1 }),
    fixed({ value: row.avgMinutesTesting, digits: 1 }),
    fixed({ value: row.avgTurns, digits: 0 }),
    fixed({ value: row.avgBuilds, digits: 1 }),
    comparison?.successRateDelta == null ? "–" : signedPoints(comparison.successRateDelta),
    fixed({ value: comparison?.costRatio ?? null, digits: 2 }),
    fixed({ value: comparison?.tokensRatio ?? null, digits: 2 }),
    fixed({ value: comparison?.durationRatio ?? null, digits: 2 }),
  ];

  return `| ${cells.join(" | ")} |`;
}

function signedPoints(delta: number): string {
  const points = Math.round(delta * 100);

  return points > 0 ? `+${points}` : String(points);
}

function percent(value: number | null): string {
  return value == null ? "–" : `${Math.round(value * 100)}%`;
}

function fixed({ value, digits }: { value: number | null; digits: number }): string {
  return value == null ? "–" : value.toFixed(digits);
}
