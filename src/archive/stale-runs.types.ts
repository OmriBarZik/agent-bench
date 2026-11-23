import type { RunVersions } from "../db/db.types";

/** A task's current prompt and judge prompt versions. */
export type CurrentVersions = {
  taskId: string;
  promptVersion: string;
  judgePromptVersion: string;
};

/** What to archive: the run ids, and a count per task and prompt version for the log. */
export type StaleRuns = {
  runIds: string[];
  groups: StaleGroup[];
};

/** How many runs of one task and prompt pair will be archived. */
export type StaleGroup = {
  label: string;
  count: number;
};

/** The runs to consider and each task's current versions. */
export type StaleRunsInput = {
  runs: RunVersions[];
  current: CurrentVersions[];
};
