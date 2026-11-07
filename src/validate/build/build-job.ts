import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BuildStep } from "../../db/db.types";
import type { BuilderConfig } from "../../inspect/build/builder-config.types";
import { withRemoteBuildLock } from "../../inspect/remote/guard/remote-build-lock";
import { warmUpChrome } from "../chrome/warm-up";
import { snapshotTree } from "../snapshot/snapshot";
import type {
  BuildJob,
  BuildOutcome,
  BuildStamp,
  BuildState,
  StartedBuild,
  StepTimes,
  ValidateContext,
} from "./build-job.types";
import { recordBuildFinish, recordBuildStart } from "./build-record";
import { armBuildLimit, readBuildTimeoutMs } from "./limit/build-limit";
import { BuildStepError, buildOnBuilder, copyBack, sendSnapshot } from "./remote-steps";

/** The log file for one build of this session. */
export function buildLogPath({ logDir, buildNumber }: { logDir: string; buildNumber: number }): string {
  return join(logDir, `build-${buildNumber}.log`);
}

/** The folder on this Mac that receives the session's Chromium.app. The same folder for every build of a run. */
export function appDirectory({ context, builder }: { context: ValidateContext; builder: BuilderConfig }): string {
  return join(builder.buildDirectory, context.runId ?? "manual-validate");
}

/**
 * Snapshots the working tree and starts building it in the background. Refuses while another build runs,
 * and skips the build when the newest successful build already has this exact tree.
 */
export async function startBuildJob({
  state,
  context,
  builder,
}: {
  state: BuildState;
  context: ValidateContext;
  builder: BuilderConfig;
}): Promise<StartedBuild> {
  const running = state.jobs.find((job) => job.outcome == null);

  if (running) {
    throw new Error(`build ${running.number} is still running; call wait_build before starting another`);
  }

  const snapshotSha = await snapshotTree(context.chromiumSrc);
  const newestOk = state.jobs.findLast((job) => job.outcome?.status === "ok");

  if (newestOk && newestOk.snapshotSha === snapshotSha) {
    return { kind: "unchanged", job: newestOk };
  }

  const finished = Promise.withResolvers<BuildOutcome>();
  const job: BuildJob = {
    number: state.jobs.length + 1,
    snapshotSha,
    startedAt: Date.now(),
    controller: new AbortController(),
    timedOut: false,
    done: finished.promise,
    outcome: null,
  };
  state.jobs.push(job);
  void runJob({ job, context, builder }).then((outcome) => {
    job.outcome = outcome;
    finished.resolve(outcome);
  });

  return { kind: "started", job };
}

/** Aborts every build still running. Used when the session ends. */
export function cancelBuildJobs(state: BuildState) {
  for (const job of state.jobs) {
    if (job.outcome == null) {
      job.controller.abort();
    }
  }
}

/** Never rejects: every failure becomes a `failed` or `cancelled` outcome. */
async function runJob({
  job,
  context,
  builder,
}: {
  job: BuildJob;
  context: ValidateContext;
  builder: BuilderConfig;
}): Promise<BuildOutcome> {
  mkdirSync(context.logDir, { recursive: true });
  const logPath = buildLogPath({ logDir: context.logDir, buildNumber: job.number });
  writeFileSync(logPath, `build ${job.number} of ${job.snapshotSha}\n`);
  const buildId = recordBuildStart(
    context.runId == null ? null : { runId: context.runId, buildNumber: job.number, logPath },
  );
  const times: StepTimes = { sendMs: null, buildMs: null, copyMs: null };
  const stopLimit = armBuildLimit({ job, logPath, timeoutMs: readBuildTimeoutMs() });
  let outcome: BuildOutcome;

  try {
    const appPath = await runSteps({ job, context, builder, logPath, times });
    outcome = { status: "ok", appPath, durationMs: elapsed(job), failedStep: null, error: null, logPath };
  } catch (error) {
    outcome = failedOutcome({ error, job, logPath });
  } finally {
    stopLimit();
  }

  recordBuildFinish({
    buildId,
    finish: {
      ...times,
      status: outcome.status,
      snapshotSha: job.snapshotSha,
      durationMs: outcome.durationMs,
      failedStep: outcome.failedStep,
      error: outcome.error,
    },
  });

  return outcome;
}

/** Send, build, copy back, stamp. Fills `times` as each step finishes and returns the local Chromium.app. */
async function runSteps({
  job,
  context,
  builder,
  logPath,
  times,
}: {
  job: BuildJob;
  context: ValidateContext;
  builder: BuilderConfig;
  logPath: string;
  times: StepTimes;
}): Promise<string> {
  const signal = job.controller.signal;
  const destination = appDirectory({ context, builder });
  let mark = Date.now();
  let step: BuildStep = "send";

  try {
    const commits = await sendSnapshot({
      builder,
      chromiumSrc: context.chromiumSrc,
      taskSha: context.taskSha,
      snapshotSha: job.snapshotSha,
      logPath,
      signal,
    });
    times.sendMs = Date.now() - mark;
    await withRemoteBuildLock({
      directory: builder.buildDirectory,
      signal,
      body: async () => {
        step = "build";
        mark = Date.now();
        await buildOnBuilder({ builder, snapshotSha: job.snapshotSha, commits, logPath, signal });
        times.buildMs = Date.now() - mark;
        step = "copy";
        mark = Date.now();
        await copyBack({ builder, destination, logPath, signal });
        times.copyMs = Date.now() - mark;
        // Written last, so a stamp that names this build means its app is fully copied.
        const stamp: BuildStamp = {
          build: job.number,
          snapshotSha: job.snapshotSha,
          finishedAt: new Date().toISOString(),
        };
        writeFileSync(join(destination, "bench-build.json"), `${JSON.stringify(stamp, null, 2)}\n`);
      },
    });
  } catch (error) {
    if (error instanceof BuildStepError || signal.aborted) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);

    throw new BuildStepError({ step, excerpt: message });
  }

  const appPath = join(destination, "Chromium.app");
  await warmUpChrome({ appPath, logPath });

  return appPath;
}

function failedOutcome({ error, job, logPath }: { error: unknown; job: BuildJob; logPath: string }): BuildOutcome {
  const durationMs = elapsed(job);

  if (job.timedOut) {
    const minutes = Math.max(1, Math.round(durationMs / 60_000));

    return {
      status: "failed",
      appPath: null,
      durationMs,
      failedStep: null,
      error: `Timed out after ${minutes} min.`,
      logPath,
    };
  }

  if (job.controller.signal.aborted) {
    return { status: "cancelled", appPath: null, durationMs, failedStep: null, error: null, logPath };
  }

  if (error instanceof BuildStepError) {
    return { status: "failed", appPath: null, durationMs, failedStep: error.step, error: error.excerpt, logPath };
  }

  const message = error instanceof Error ? error.message : String(error);

  return { status: "failed", appPath: null, durationMs, failedStep: null, error: message, logPath };
}

function elapsed(job: BuildJob): number {
  return Date.now() - job.startedAt;
}
