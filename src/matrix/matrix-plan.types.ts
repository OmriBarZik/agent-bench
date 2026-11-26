import type { CellRunCount } from "../db/db.types";

/** One run the matrix still owes: a task × config cell and which of its repeats this is (1-based). */
export type PlannedRun = {
  taskId: string;
  configId: string;
  repeat: number;
};

/** What `planRuns` needs: the cells to fill, how many runs each should end with, and what the DB already has. */
export type PlanInput = {
  taskIds: string[];
  configIds: string[];
  repeats: number;
  counts: CellRunCount[];
};
