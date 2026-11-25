import type { RunVersions } from "../db/db.types";

/** A task's current prompt and judge prompt versions. */
export type CurrentVersions = {
  taskId: string;
  promptVersion: string;
  judgePromptVersion: string;
};

/** The setup one config would run one task with today, with or without chrome-validate. */
export type CurrentSetup = {
  taskId: string;
  configId: string;
  autoReview: boolean;
  configHash: string;
  setupHash: string;
};

/** What to archive: the run ids, and a count per reason for the log. */
export type StaleRuns = {
  runIds: string[];
  groups: StaleGroup[];
};

/** How many runs will be archived for one reason (an old prompt pair, config hash or setup hash). */
export type StaleGroup = {
  label: string;
  count: number;
};

/** The runs to consider, each task's current versions, and each task × config's current setup. */
export type StaleRunsInput = {
  runs: RunVersions[];
  current: CurrentVersions[];
  setups: CurrentSetup[];
};
