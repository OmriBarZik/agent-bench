import type { RunPhase } from "../runner/run-one/run-one.types";

/** Where one benchmark run is: its place in the plan, what it runs, and the step it is on. */
export type RunTitle = {
  index: number;
  total: number;
  taskId: string;
  configId: string;
  repeat: number;
  phase: RunPhase;
  /** Milliseconds of agent and judge time, not counting a remote build that has the agent stopped. */
  elapsedMs?: number;
  /** True while a remote build has the agent stopped. The clock does not advance. */
  paused?: boolean;
};

/** How far the benchmark loop got when it ended. */
export type BenchEndTitle = {
  finished: number;
  total: number;
  stopped: boolean;
};

/** A build of one run: where it builds and the step it is on, or how it ended. */
export type BuildTitle = {
  taskId: string;
  configId: string;
  repeat: number;
  /** `local` for this Mac, or the build Mac's host name. */
  where: string;
  step: BuildStep;
};

/** The step a build is on. `built` and `failed` are the ends, shown until the user presses return. */
export type BuildStep = "check" | "checkout" | "send" | "build" | "copy" | "built" | "failed";
