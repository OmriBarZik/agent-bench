import { withRemoteBuildLock } from "../../../inspect/remote/guard/remote-build-lock";
import { buildOnBuilder, copyBack, sendSnapshot } from "../remote-steps";
import { writeBuildStamp } from "./build-stamp";
import type { StepRun } from "./steps.types";

/** Sends the snapshot to the build Mac, builds the plan's target there, and copies the output back. */
export async function runRemoteSteps({ job, context, plan, destination, logPath, times, progress }: StepRun) {
  const builder = context.builder;

  if (builder == null) {
    throw new Error("The build Mac is not set up (configs/builder/remote.yaml is missing), so builds are unavailable.");
  }

  const signal = job.controller.signal;
  let mark = Date.now();
  progress.step = "send";
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
    directory: context.buildDirectory,
    signal,
    body: async () => {
      progress.step = "build";
      mark = Date.now();
      await buildOnBuilder({ builder, snapshotSha: job.snapshotSha, commits, plan, logPath, signal });
      times.buildMs = Date.now() - mark;
      progress.step = "copy";
      mark = Date.now();
      await copyBack({ builder, destination, plan, logPath, signal });
      times.copyMs = Date.now() - mark;
      writeBuildStamp({ job, destination });
    },
  });
}
