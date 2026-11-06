import type { Task } from "../db/db.types";
import type { RunChoice } from "../inspect/list/select-state.types";
import type { BenchConfig } from "../runner/bench-config/bench-config.types";

/** The `bun run start` flags that decide what happens. Number flags stay strings until they are checked. */
export type RunPlanFlags = {
  tasksPath: string;
  configsPath: string;
  /** --only-task values, each of which may be a comma-separated list. */
  onlyTask?: string[];
  /** --only-config values, each of which may be a comma-separated list. */
  onlyConfig?: string[];
  /** Absent when --repeats was not passed, so the TUI can open by default. */
  repeats?: string;
  timeoutMin: string;
  sync: boolean;
  /** --auto-review: the agent builds its change and checks it in Chromium. Default on. */
  autoReview: boolean;
  /** --force: discard uncommitted changes in the Chromium checkout when a build or checkout needs it. */
  force: boolean;
  /** --interactive: open the TUI even when selection flags were passed; they become the Start tab's values. */
  interactive: boolean;
  /** --runs: open the TUI on the Runs tab. */
  runs: boolean;
  /** --cli: never open the TUI. */
  cli: boolean;
};

/** The tasks × configs × repeats to run, and the per-run settings. */
export type RunPlan = {
  tasks: Task[];
  configs: BenchConfig[];
  repeats: number;
  timeoutMin: number;
  sync: boolean;
  /** Attach chrome-validate for every run in this plan. */
  autoReview: boolean;
};

/** Run the benchmark with this plan. */
export type RunDecision = {
  kind: "run";
  plan: RunPlan;
};

/** Check this run's branch out instead of running anything. */
export type CheckoutDecision = {
  kind: "checkout";
  choice: RunChoice;
};

/** The TUI was closed without choosing anything. */
export type QuitDecision = {
  kind: "quit";
};

/** What `bun run start` does next. */
export type StartDecision = RunDecision | CheckoutDecision | QuitDecision;
