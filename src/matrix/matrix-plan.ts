import type { PlanInput, PlannedRun } from "./matrix-plan.types";

/**
 * The runs still missing for every task × config cell to reach `repeats` current runs, ordered round by round:
 * every cell's first missing run before any cell's second, so a matrix stopped halfway still covers every cell.
 */
export function planRuns({ taskIds, configIds, repeats, counts }: PlanInput): PlannedRun[] {
  const have = new Map(counts.map((count) => [`${count.taskId}\0${count.configId}`, count.runs]));
  const planned: PlannedRun[] = [];

  for (let repeat = 1; repeat <= repeats; repeat++) {
    for (const taskId of taskIds) {
      for (const configId of configIds) {
        if ((have.get(`${taskId}\0${configId}`) ?? 0) < repeat) {
          planned.push({ taskId, configId, repeat });
        }
      }
    }
  }

  return planned;
}
