import type { SummaryComparison, SummaryRow } from "./summary.types";

/**
 * Sets each row's comparison against the Compare against config's row for the same task, matched task by task like
 * the dashboard. `againstRows` come from runs without the Config filter, so that config is there even when unpicked.
 */
export function addComparisons({
  rows,
  againstRows,
  compareAgainst,
}: {
  rows: SummaryRow[];
  againstRows: SummaryRow[];
  compareAgainst: string;
}): SummaryRow[] {
  const byTask = new Map(againstRows.filter((row) => row.configId === compareAgainst).map((row) => [row.taskId, row]));

  return rows.map((row) => {
    const against = byTask.get(row.taskId);

    if (!against || row.configId === compareAgainst) {
      return row;
    }

    return { ...row, comparison: compareRows({ row, against }) };
  });
}

function compareRows({ row, against }: { row: SummaryRow; against: SummaryRow }): SummaryComparison {
  return {
    against: against.configId,
    againstRuns: against.runs,
    successRateDelta:
      row.successRate == null || against.successRate == null ? null : row.successRate - against.successRate,
    costRatio: ratio({ value: row.avgCostUsd, against: against.avgCostUsd }),
    tokensRatio: ratio({ value: row.avgTotalTokens, against: against.avgTotalTokens }),
    durationRatio: ratio({ value: row.avgDurationMin, against: against.avgDurationMin }),
  };
}

function ratio({ value, against }: { value: number | null; against: number | null }): number | null {
  return value == null || !against ? null : Math.round((value / against) * 100) / 100;
}
