import { join } from "node:path";
import type { BuildStep } from "../../db/db.types";
import type { BuilderConfig } from "../../inspect/build/builder-config.types";
import { gitlinkCommitsBetween } from "../../inspect/gitlink/gitlink-commits";
import type { SubmoduleCommit } from "../../inspect/gitlink/gitlink-diff.types";
import { buildCommand, copyBackCommand, pushCommand, remoteBuildScript } from "../../inspect/remote/remote-build-plan";
import { BENCH_DIR } from "../../paths";
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

/** Checks the snapshot out on the builder and builds chrome there. */
export async function buildOnBuilder({
  builder,
  snapshotSha,
  commits,
  logPath,
  signal,
}: {
  builder: BuilderConfig;
  snapshotSha: string;
  commits: SubmoduleCommit[];
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
    stdin: remoteBuildScript({ argsGn, commits }),
    logPath,
    signal,
  });
}

/** Copies the runnable build (Chromium.app and its libraries) into `destination`. */
export async function copyBack({
  builder,
  destination,
  logPath,
  signal,
}: {
  builder: BuilderConfig;
  destination: string;
  logPath: string;
  signal: AbortSignal;
}) {
  await step({
    step: "copy",
    command: copyBackCommand({ host: builder.host, source: builder.source, destination }),
    logPath,
    signal,
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
