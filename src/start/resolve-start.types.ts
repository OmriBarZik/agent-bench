import type { Task } from "../db/db.types";
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
  /** --build-timeout-min. Minutes one remote build may run. */
  buildTimeoutMin: string;
  sync: boolean;
  /** --auto-review: the agent builds its change and checks it in Chromium. Default on. */
  autoReview: boolean;
  /** --force: discard uncommitted changes in the Chromium checkout when a build or checkout needs it. */
  force: boolean;
  /** --interactive: open the TUI even when selection flags were passed; they become the Start tab's values. */
  interactive: boolean;
  /** --runs: open the TUI on the Runs tab. */
  runs: boolean;
  /** --setups: open the TUI on the Setups tab. */
  setups: boolean;
  /** --cli: never open the TUI. */
  cli: boolean;
  /** Model for the read-only judge session. */
  judgeModel: string;
};

/** The tasks × configs × repeats to run, and the per-run settings. */
export type RunPlan = {
  tasks: Task[];
  configs: BenchConfig[];
  repeats: number;
  timeoutMin: number;
  /** Minutes one remote build may run before it fails and the agent resumes. */
  buildTimeoutMin: number;
  sync: boolean;
  /** Attach chrome-validate for every run in this plan. */
  autoReview: boolean;
};

/** Run the benchmark with this plan (CLI / non-TTY path). */
export type RunDecision = {
  kind: "run";
  plan: RunPlan;
};

/** The TUI was closed, or the interactive session ended. */
export type QuitDecision = {
  kind: "quit";
};

/** What `bun run start` does next. Checkout and matrices from the TUI run inside it. */
export type StartDecision = RunDecision | QuitDecision;
