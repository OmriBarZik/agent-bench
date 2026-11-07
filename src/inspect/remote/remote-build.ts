import { $ } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { openDb, taskChromiumSha } from "../../db/db";
import { BENCH_DIR } from "../../paths";
import { setTerminalTitle } from "../../terminal/terminal-title";
import { buildTitle } from "../../terminal/title-text";
import type { BuildStep } from "../../terminal/title-text.types";
import {
  buildSay,
  CompileFailedError,
  failureNotice,
  openChromiumCommand,
  runIdsForCompileFailure,
  runStep,
  shouldWaitForReturn,
  stepLog,
  waitForReturn,
} from "../build/build-process";
import type { BuildFinish, BuildPresentation } from "../build/build-session.types";
import type { BuilderConfig } from "../build/builder-config.types";
import { openBuildWatch } from "../build/record/record-build";
import { gitlinkCommitsBetween } from "../gitlink/gitlink-commits";
import type { SubmoduleCommit } from "../gitlink/gitlink-diff.types";
import type { RunChoice } from "../list/select-state.types";
import { publishCopiedTree } from "./guard/publish-app";
import { withRemoteBuildLock } from "./guard/remote-build-lock";
import {
  branchRefspec,
  buildCommand,
  copyBackCommand,
  detachCommand,
  pushCommand,
  remoteBuildScript,
} from "./remote-build-plan";
import type { BuildResult } from "./remote-build.types";
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
  presentation,
}: {
  choice: RunChoice;
  config: BuilderConfig;
  chromiumSrc: string;
  signal: AbortSignal;
  presentation?: BuildPresentation;
}): Promise<BuildFinish> {
  const watch = openBuildWatch({ choice, target: "remote", host: config.host });

  try {
    showStep({ choice, config, step: "check" });
    buildSay({ presentation, line: `Checking ${config.host}…` });
    const problem = await validateRemote({ config, signal });

    if (problem) {
      watch.failed({ signal, notice: problem });
      showStep({ choice, config, step: "failed" });
      buildSay({ presentation, line: `\n${problem}`, stream: "stderr" });

      if (shouldWaitForReturn(presentation)) {
        await waitForReturn(signal);
      }

      return { notice: problem, failedRunIds: [] };
    }

    const built = await buildRemoteRun({ choice, config, chromiumSrc, signal, openApp: true, presentation });
    watch.passed();
    showStep({ choice, config, step: "built" });
    buildSay({ presentation, line: `\n${built.notice}` });

    if (shouldWaitForReturn(presentation)) {
      await waitForReturn(signal);
    }

    return { notice: built.notice, failedRunIds: [] };
  } catch (error) {
    const notice = failureNotice({ error, signal });
    watch.failed({ signal, notice });
    showStep({ choice, config, step: "failed" });
    buildSay({ presentation, line: `\n${notice}`, stream: "stderr" });

    if (!signal.aborted && shouldWaitForReturn(presentation)) {
      await waitForReturn(signal);
    }

    return { notice, failedRunIds: runIdsForCompileFailure({ error, signal, runId: choice.runId }) };
  }
}

/**
 * Sends the branch, builds chrome on the build Mac, and copies Chromium.app back.
 * Opens the app only when `openApp` is set, so a queue can leave it closed.
 */
export async function buildRemoteRun({
  choice,
  config,
  chromiumSrc,
  signal,
  openApp,
  presentation,
}: {
  choice: RunChoice;
  config: BuilderConfig;
  chromiumSrc: string;
  signal: AbortSignal;
  /** When true, launch the copied app. A queue leaves this false. */
  openApp: boolean;
  presentation?: BuildPresentation;
}): Promise<BuildResult> {
  const destination = join(config.buildDirectory, choice.runId);
  const log = stepLog(presentation);
  buildSay({ presentation, line: `Building ${choice.branch} on ${config.host}` });
  buildSay({ presentation, line: destination });
  buildSay({ presentation, line: "Ctrl-C cancels the build." });
  const commits = await commitsToSend({ choice, chromiumSrc, signal, presentation });
  const argsGn = await Bun.file(BUILDER_ARGS).text();

  if (argsGn.trim() === "") {
    throw new Error(`write the build args in ${BUILDER_ARGS}`);
  }

  const script = remoteBuildScript({ argsGn, commits });
  const refspec = branchRefspec(choice.branch);
  showStep({ choice, config, step: "send" });
  buildSay({ presentation, line: "Sending the branch…" });
  await runStep({
    command: detachCommand({ host: config.host, source: config.source }),
    signal,
    label: "detach",
    ...log,
  });

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
      ...log,
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
    ...log,
  });
  showStep({ choice, config, step: "build" });
  buildSay({ presentation, line: "Building chrome…" });
  await withRemoteBuildLock({
    directory: config.buildDirectory,
    signal,
    body: async () => {
      await runStep({
        command: buildCommand({
          host: config.host,
          source: config.source,
          revision: choice.branch,
          depotTools: config.depotTools,
        }),
        signal,
        label: "build",
        stdin: script,
        ...log,
      });
      showStep({ choice, config, step: "copy" });
      buildSay({ presentation, line: "Copying the app back…" });
      await publishCopiedTree({
        destination,
        copy: (staging) =>
          runStep({
            command: copyBackCommand({ host: config.host, source: config.source, destination: staging }),
            signal,
            label: "copy",
            ...log,
          }),
      });
    },
  });
  const app = join(destination, "Chromium.app");

  if (!existsSync(app)) {
    throw new CompileFailedError(`the build finished, but ${app} is missing`);
  }

  if (openApp) {
    await runStep({ command: openChromiumCommand(app), signal, label: "open", ...log });
  }

  return { notice: `built ${choice.branch} at ${destination}` };
}

function showStep({ choice, config, step }: { choice: RunChoice; config: BuilderConfig; step: BuildStep }) {
  setTerminalTitle(
    buildTitle({ taskId: choice.taskId, configId: choice.configId, repeat: choice.repeat, where: config.host, step }),
  );
}

async function commitsToSend({
  choice,
  chromiumSrc,
  signal,
  presentation,
}: {
  choice: RunChoice;
  chromiumSrc: string;
  signal: AbortSignal;
  presentation?: BuildPresentation;
}): Promise<SubmoduleCommit[]> {
  const taskSha = chromiumSha(choice.taskId);

  if (taskSha == null) {
    buildSay({ presentation, line: "This run has no Chromium revision recorded. Sending the branch only." });

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
