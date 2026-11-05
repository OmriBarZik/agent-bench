import type { Task } from "../db/db.types";
import type { BenchConfig } from "../runner/bench-config/bench-config.types";

/** The `bun run start` flags that decide what runs. Number flags stay strings until they are checked. */
export type RunPlanFlags = {
  tasksPath: string;
  configsPath: string;
  /** --only-task values, each of which may be a comma-separated list. */
  onlyTask?: string[];
  /** --only-config values, each of which may be a comma-separated list. */
  onlyConfig?: string[];
  /** Absent when --repeats was not passed, so the picker can open by default. */
  repeats?: string;
  timeoutMin: string;
  sync: boolean;
  /** --interactive: open the picker even when selection flags were passed; they become its starting values. */
  interactive: boolean;
  /** --cli: never open the picker. */
  cli: boolean;
};

/** The tasks × configs × repeats to run, and the per-run settings. */
export type RunPlan = {
  tasks: Task[];
  configs: BenchConfig[];
  repeats: number;
  timeoutMin: number;
  sync: boolean;
};
