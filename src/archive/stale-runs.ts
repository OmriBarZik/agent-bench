import type { StaleGroup, StaleRuns, StaleRunsInput } from "./stale-runs.types";

/**
 * Runs not yet archived whose prompt or judge prompt differs from their task's current one. A run of a task that
 * is no longer in benchmark-tasks.json is left alone.
 */
export function staleRunIds({ runs, current }: StaleRunsInput): StaleRuns {
  const byTask = new Map(current.map((versions) => [versions.taskId, versions]));
  const counts = new Map<string, number>();
  const runIds: string[] = [];

  for (const run of runs) {
    const versions = byTask.get(run.taskId);

    if (!versions || run.batch != null) {
      continue;
    }

    if (run.promptVersion === versions.promptVersion && run.judgePromptVersion === versions.judgePromptVersion) {
      continue;
    }

    runIds.push(run.runId);
    const label = `${run.taskId} prompt ${run.promptVersion ?? "none"} judge ${run.judgePromptVersion ?? "none"}`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const groups: StaleGroup[] = [...counts].map(([label, count]) => ({ label, count }));

  return { runIds, groups };
}
