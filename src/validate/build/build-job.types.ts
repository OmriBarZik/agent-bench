import type { BuildStatus, BuildStep } from "../../db/db.types";
import type { BuilderConfig } from "../../inspect/build/builder-config.types";

/** What the chrome-validate server knows about the session it serves. */
export type ValidateContext = {
  /** BENCH_RUN_ID, or null when the server runs outside a benchmark (builds are then not stored). */
  runId: string | null;
  /** The task's Chromium revision. Submodule commits newer than it are sent to the builder. */
  taskSha: string;
  chromiumSrc: string;
  /** The build Mac from configs/builder/remote.yaml, or null when it is not set up. */
  builder: BuilderConfig | null;
  /** Where build logs go on this Mac. */
  logDir: string;
};

/** How a finished build ended, as the agent is told. */
export type BuildOutcome = {
  status: Exclude<BuildStatus, "building">;
  /** Chromium.app copied back to this Mac, when the build succeeded. */
  appPath: string | null;
  durationMs: number;
  failedStep: BuildStep | null;
  /** Compiler errors, or the tail of the log, when it failed. */
  error: string | null;
  logPath: string;
};

/** One build the agent asked for in this session. */
export type BuildJob = {
  /** 1 for the first build of the session, then 2, 3… */
  number: number;
  /** Commit of the working tree this build compiles. */
  snapshotSha: string;
  startedAt: number;
  controller: AbortController;
  /** Set when the build limit aborts the job, so the outcome is a timeout rather than a cancel. */
  timedOut: boolean;
  /** Resolves when the build finishes, fails, or is cancelled. Never rejects. */
  done: Promise<BuildOutcome>;
  /** Set once `done` has resolved. */
  outcome: BuildOutcome | null;
};

/** Every build of the session, oldest first. */
export type BuildState = {
  jobs: BuildJob[];
};

/** What start_build did. */
export type StartedBuild = {
  /** `started` began a new build. `unchanged` means the newest successful build already has this exact tree. */
  kind: "started" | "unchanged";
  job: BuildJob;
};

/** Per-step timings of one build, in milliseconds. */
export type StepTimes = {
  sendMs: number | null;
  buildMs: number | null;
  copyMs: number | null;
};

/** The file written next to Chromium.app so a check can tell which build it is running. */
export type BuildStamp = {
  build: number;
  snapshotSha: string;
  finishedAt: string;
};
