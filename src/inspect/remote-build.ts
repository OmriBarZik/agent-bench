import { $ } from "bun";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { openDb, taskChromiumSha } from "../db/db";
import { BENCH_DIR } from "../paths";
import { failureNotice, runStep, waitForReturn } from "./build-process";
import type { BuilderConfig } from "./builder-config.types";
import { gitlinkCommitsBetween } from "./gitlink-commits";
import type { SubmoduleCommit } from "./gitlink-diff.types";
import {
  branchRefspec,
  buildCommand,
  copyBackCommand,
  detachCommand,
  pushCommand,
  remoteBuildScript,
} from "./remote-build-plan";
import type { BuildResult } from "./remote-build.types";
import type { RunChoice } from "./select-state.types";
import { validateRemote } from "./validate-remote";

const BUILDER_ARGS = join(BENCH_DIR, "configs/builder/args.gn");

/**
 * Builds the run on the other Mac, copies Chromium.app back, and opens it.
 * Resolves with the notice for the list. Ctrl-C cancels and still resolves.
 */
export async function presentBuild({
  choice,
  config,
  chromiumSrc,
  signal,
}: {
  choice: RunChoice;
  config: BuilderConfig;
  chromiumSrc: string;
  signal: AbortSignal;
}): Promise<string> {
  try {
    console.log(`Checking ${config.host}…`);
    const problem = await validateRemote({ config, signal });

    if (problem) {
      console.error(`\n${problem}`);
      await waitForReturn(signal);

      return problem;
    }

    const built = await buildOnBuilder({ choice, config, chromiumSrc, signal });
    console.log(`\n${built.notice}`);
    await waitForReturn(signal);

    return built.notice;
  } catch (error) {
    const notice = failureNotice({ error, signal });
    console.error(`\n${notice}`);

    if (!signal.aborted) {
      await waitForReturn(signal);
    }

    return notice;
  }
}

async function buildOnBuilder({
  choice,
  config,
  chromiumSrc,
  signal,
}: {
  choice: RunChoice;
  config: BuilderConfig;
  chromiumSrc: string;
  signal: AbortSignal;
}): Promise<BuildResult> {
  const destination = join(config.buildDirectory, choice.runId);
  console.log(`Building ${choice.branch} on ${config.host}`);
  console.log(destination);
  console.log("Ctrl-C cancels and returns to the list.");
  const commits = await commitsToSend({ choice, chromiumSrc, signal });
  const argsGn = await Bun.file(BUILDER_ARGS).text();

  if (argsGn.trim() === "") {
    throw new Error(`write the build args in ${BUILDER_ARGS}`);
  }

  const script = remoteBuildScript({ argsGn, commits });
  const refspec = branchRefspec(choice.branch);
  console.log("Sending the branch…");
  await runStep({ command: detachCommand({ host: config.host, source: config.source }), signal, label: "detach" });

  for (const commit of commits) {
    await runStep({
      command: pushCommand({
        host: config.host,
        repo: join(chromiumSrc, commit.path),
        source: join(config.source, commit.path),
        refspec: submoduleRefspec(commit),
      }),
      signal,
      label: `send ${commit.path}`,
    });
  }

  await runStep({
    command: pushCommand({
      host: config.host,
      repo: chromiumSrc,
      source: config.source,
      refspec,
    }),
    signal,
    label: "send branch",
  });
  console.log("Building chrome…");
  await runStep({
    command: buildCommand({
      host: config.host,
      source: config.source,
      branch: choice.branch,
      depotTools: config.depotTools,
    }),
    signal,
    label: "build",
    stdin: script,
  });
  console.log("Copying the app back…");
  await mkdir(destination, { recursive: true });
  await runStep({
    command: copyBackCommand({ host: config.host, source: config.source, destination }),
    signal,
    label: "copy",
  });
  const app = join(destination, "Chromium.app");

  if (!existsSync(app)) {
    throw new Error(`the build finished, but ${app} is missing`);
  }

  await runStep({ command: ["open", app], signal, label: "open" });

  return { notice: `built ${choice.branch} at ${destination}` };
}

async function commitsToSend({
  choice,
  chromiumSrc,
  signal,
}: {
  choice: RunChoice;
  chromiumSrc: string;
  signal: AbortSignal;
}): Promise<SubmoduleCommit[]> {
  const taskSha = chromiumSha(choice.taskId);

  if (taskSha == null) {
    console.log("This run has no Chromium revision recorded. Sending the branch only.");

    return [];
  }

  try {
    await $`git cat-file -e ${taskSha}^{commit}`.cwd(chromiumSrc).quiet();
  } catch {
    if (signal.aborted) {
      throw new Error("build cancelled");
    }

    throw new Error(`this checkout has no commit ${taskSha}; fetch that Chromium revision, then build again`);
  }

  if (signal.aborted) {
    throw new Error("build cancelled");
  }

  return gitlinkCommitsBetween({ repo: chromiumSrc, base: taskSha, tip: choice.branch });
}

function chromiumSha(taskId: string): string | null {
  const db = openDb();

  try {
    return taskChromiumSha({ db, taskId });
  } finally {
    db.close();
  }
}

function submoduleRefspec(commit: SubmoduleCommit): string {
  if (!/^[0-9a-f]+$/.test(commit.sha)) {
    throw new Error(`commit ${commit.sha} is not a sha the builder can check out`);
  }

  return `+${commit.sha}:refs/agent-bench/tip`;
}
