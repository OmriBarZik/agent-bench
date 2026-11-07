import { join } from "node:path";
import type { BuildStep } from "../../db/db.types";
import type { BuilderConfig } from "../../inspect/build/builder-config.types";
import { gitlinkCommitsBetween } from "../../inspect/gitlink/gitlink-commits";
import type { SubmoduleCommit } from "../../inspect/gitlink/gitlink-diff.types";
import { publishCopiedTree } from "../../inspect/remote/guard/publish-app";
import {
  buildCommand,
  copyBackCommand,
  copyPathsScript,
  pushCommand,
  remoteBuildScript,
} from "../../inspect/remote/remote-build-plan";
import { BENCH_DIR } from "../../paths";
import type { ValidateBuildPlan } from "../mode/validate-mode.types";
import { runCaptured } from "./captured-step";
import { errorExcerpt } from "./error-excerpt";

const BUILDER_ARGS = join(BENCH_DIR, "configs/builder/args.gn");

/** A build step that failed. `excerpt` is what the agent is shown. */
export class BuildStepError extends Error {
  readonly step: BuildStep;
  readonly excerpt: string;

  constructor({ step, excerpt }: { step: BuildStep; excerpt: string }) {
    super(`${step} failed`);
    this.step = step;
    this.excerpt = excerpt;
  }
}

/** Pushes the snapshot and the submodule commits it needs to the builder. Returns those submodule commits. */
export async function sendSnapshot({
  builder,
  chromiumSrc,
  taskSha,
  snapshotSha,
  logPath,
  signal,
}: {
  builder: BuilderConfig;
  chromiumSrc: string;
  taskSha: string;
  snapshotSha: string;
  logPath: string;
  signal: AbortSignal;
}): Promise<SubmoduleCommit[]> {
  const commits = await gitlinkCommitsBetween({ repo: chromiumSrc, base: taskSha, tip: snapshotSha });

  for (const commit of commits) {
    await step({
      step: "send",
      command: pushCommand({
        host: builder.host,
        repo: join(chromiumSrc, commit.path),
        source: join(builder.source, commit.path),
        refspec: `+${hexSha(commit.sha)}:refs/agent-bench/tip`,
      }),
      logPath,
      signal,
    });
  }

  await step({
    step: "send",
    command: pushCommand({
      host: builder.host,
      repo: chromiumSrc,
      source: builder.source,
      refspec: `+${hexSha(snapshotSha)}:refs/agent-bench/validate`,
    }),
    logPath,
    signal,
  });

  return commits;
}

/** Checks the snapshot out on the builder and builds the plan's ninja target there. */
export async function buildOnBuilder({
  builder,
  snapshotSha,
  commits,
  plan,
  logPath,
  signal,
}: {
  builder: BuilderConfig;
  snapshotSha: string;
  commits: SubmoduleCommit[];
  plan: ValidateBuildPlan;
  logPath: string;
  signal: AbortSignal;
}) {
  const argsGn = await Bun.file(BUILDER_ARGS).text();
  await step({
    step: "build",
    command: buildCommand({
      host: builder.host,
      source: builder.source,
      revision: hexSha(snapshotSha),
      depotTools: builder.depotTools,
    }),
    stdin: remoteBuildScript({ argsGn, commits, ninjaTarget: plan.ninjaTarget }),
    logPath,
    signal,
  });
}

/**
 * Copies the build output into a staging directory, then swaps it into `destination`.
 * A full chrome plan copies the runnable app; light plans copy only the listed gen/ paths.
 * A failed copy leaves the previous destination in place.
 */
export async function copyBack({
  builder,
  destination,
  plan,
  logPath,
  signal,
}: {
  builder: BuilderConfig;
  destination: string;
  plan: ValidateBuildPlan;
  logPath: string;
  signal: AbortSignal;
}) {
  await publishCopiedTree({
    destination,
    copy: async (staging) => {
      if (plan.copyPaths == null) {
        await step({
          step: "copy",
          command: copyBackCommand({ host: builder.host, source: builder.source, destination: staging }),
          logPath,
          signal,
        });

        return;
      }

      await step({
        step: "copy",
        command: ["bash", "-s"],
        stdin: copyPathsScript({
          host: builder.host,
          source: builder.source,
          destination: staging,
          relativePaths: plan.copyPaths,
        }),
        logPath,
        signal,
      });
    },
  });
}

async function step({
  step,
  command,
  stdin,
  logPath,
  signal,
}: {
  step: BuildStep;
  command: string[];
  stdin?: string;
  logPath: string;
  signal: AbortSignal;
}) {
  const captured = await runCaptured({ command, stdin, logPath, signal });

  if (captured.exitCode !== 0) {
    throw new BuildStepError({ step, excerpt: errorExcerpt(captured.output) });
  }
}

function hexSha(sha: string): string {
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new BuildStepError({ step: "send", excerpt: `${sha} is not a full commit sha` });
  }

  return sha;
}
