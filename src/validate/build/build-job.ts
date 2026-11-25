import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { warmUpChrome } from "../chrome/warm-up";
import { stockChromiumApp, validateBuildPlan } from "../mode/validate-mode";
import { snapshotTree } from "../snapshot/snapshot";
import type {
  BuildJob,
  BuildOutcome,
  BuildState,
  BuiltOutput,
  StartedBuild,
  StepTimes,
  ValidateContext,
} from "./build-job.types";
import { recordBuildFinish, recordBuildStart } from "./build-record";
import { armBuildLimit, readBuildTimeoutMs } from "./limit/build-limit";
import { BuildStepError } from "./remote-steps";
import { runLocalSteps } from "./steps/run-local";
import { runRemoteSteps } from "./steps/run-remote";
import type { StepProgress } from "./steps/steps.types";

/** The log file for one build of this session. */
export function buildLogPath({ logDir, buildNumber }: { logDir: string; buildNumber: number }): string {
  return join(logDir, `build-${buildNumber}.log`);
}

/** The folder on this Mac that receives the session's build output. The same folder for every build of a run. */
export function appDirectory(context: ValidateContext): string {
  return join(context.buildDirectory, context.runId ?? "manual-validate");
}

/**
 * Snapshots the working tree and starts building it in the background. Refuses while another build runs,
 * and skips the build when the newest successful build already has this exact tree.
 */
export async function startBuildJob({
  state,
  context,
}: {
  state: BuildState;
  context: ValidateContext;
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
  void runJob({ job, context }).then((outcome) => {
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
async function runJob({ job, context }: { job: BuildJob; context: ValidateContext }): Promise<BuildOutcome> {
  mkdirSync(context.logDir, { recursive: true });
  const logPath = buildLogPath({ logDir: context.logDir, buildNumber: job.number });
  writeFileSync(logPath, `build ${job.number} of ${job.snapshotSha} (${context.mode})\n`);
  const buildId = recordBuildStart(
    context.runId == null ? null : { runId: context.runId, buildNumber: job.number, logPath },
  );
  const times: StepTimes = { sendMs: null, buildMs: null, copyMs: null };
  const stopLimit = armBuildLimit({ job, logPath, timeoutMs: readBuildTimeoutMs() });
  let outcome: BuildOutcome;

  try {
    const built = await runSteps({ job, context, logPath, times });
    outcome = {
      status: "ok",
      appPath: built.appPath,
      artifactPath: built.artifactPath,
      outputDir: built.outputDir,
      durationMs: elapsed(job),
      failedStep: null,
      error: null,
      logPath,
    };
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

/** Builds on this Mac or the build Mac, then checks the app run_chrome will launch. Fills `times` as each step finishes. */
async function runSteps({
  job,
  context,
  logPath,
  times,
}: {
  job: BuildJob;
  context: ValidateContext;
  logPath: string;
  times: StepTimes;
}): Promise<BuiltOutput> {
  const plan = validateBuildPlan(context.mode);
  const signal = job.controller.signal;
  const destination = appDirectory(context);
  const local = context.buildLocation === "local";
  const progress: StepProgress = { step: local ? "build" : "send" };

  try {
    const run = { job, context, plan, destination, logPath, times, progress };
    await (local ? runLocalSteps(run) : runRemoteSteps(run));
  } catch (error) {
    if (error instanceof BuildStepError || signal.aborted) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);

    throw new BuildStepError({ step: progress.step, excerpt: message });
  }

  const artifactPath = plan.artifactRelativePath == null ? null : join(destination, plan.artifactRelativePath);
  const fullApp = plan.copyPaths == null && !local;
  const appPath = fullApp ? join(destination, "Chromium.app") : stockChromiumApp(context.chromiumSrc);

  if (!existsSync(join(appPath, "Contents/MacOS/Chromium"))) {
    throw new BuildStepError({
      step: "copy",
      excerpt: fullApp
        ? `${appPath} is missing after the copy`
        : `${appPath} is missing; this mode needs a chrome build at out/Default/Chromium.app on this Mac`,
    });
  }

  // Light modes run the stock app, which a rebuild of out/Default can leave cold too. A warm app opens in ~2 s.
  await warmUpChrome({ appPath, logPath });

  return { appPath, artifactPath, outputDir: destination };
}

function failedOutcome({ error, job, logPath }: { error: unknown; job: BuildJob; logPath: string }): BuildOutcome {
  const durationMs = elapsed(job);

  if (job.timedOut) {
    const minutes = Math.max(1, Math.round(durationMs / 60_000));

    return {
      status: "failed",
      appPath: null,
      artifactPath: null,
      outputDir: null,
      durationMs,
      failedStep: null,
      error: `Timed out after ${minutes} min.`,
      logPath,
    };
  }

  if (job.controller.signal.aborted) {
    return {
      status: "cancelled",
      appPath: null,
      artifactPath: null,
      outputDir: null,
      durationMs,
      failedStep: null,
      error: null,
      logPath,
    };
  }

  if (error instanceof BuildStepError) {
    return {
      status: "failed",
      appPath: null,
      artifactPath: null,
      outputDir: null,
      durationMs,
      failedStep: error.step,
      error: error.excerpt,
      logPath,
    };
  }

  const message = error instanceof Error ? error.message : String(error);

  return {
    status: "failed",
    appPath: null,
    artifactPath: null,
    outputDir: null,
    durationMs,
    failedStep: null,
    error: message,
    logPath,
  };
}

function elapsed(job: BuildJob): number {
  return Date.now() - job.startedAt;
}
