import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { BENCH_DIR } from "../../paths";
import { checkoutBranch, hasUncommittedChanges } from "../../runner/chromium/chromium";
import { setTerminalTitle } from "../../terminal/terminal-title";
import { buildTitle } from "../../terminal/title-text";
import type { BuildStep } from "../../terminal/title-text.types";
import type { RunChoice } from "../list/select-state.types";
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
} from "./build-process";
import type { BuildFinish, BuildPresentation } from "./build-session.types";
import { extendPathForCcache, prepareCcacheScript } from "./ccache";
import { openBuildWatch } from "./record/record-build";

const BUILDER_ARGS = join(BENCH_DIR, "configs/builder/args.gn");

/** Checks the run out in the local Chromium tree, builds chrome there, and opens the app. */
export async function presentLocalBuild({
  choice,
  chromiumSrc,
  force,
  signal,
  presentation,
}: {
  choice: RunChoice;
  chromiumSrc: string;
  force: boolean;
  signal: AbortSignal;
  presentation?: BuildPresentation;
}): Promise<BuildFinish> {
  const watch = openBuildWatch({ choice, target: "local", host: "local" });

  try {
    const built = await buildLocally({ choice, chromiumSrc, force, signal, presentation });
    watch.passed();
    showStep({ choice, step: "built" });
    buildSay({ presentation, line: `\n${built}` });

    if (shouldWaitForReturn(presentation)) {
      await waitForReturn(signal);
    }

    return { notice: built, failedRunIds: [] };
  } catch (error) {
    const notice = failureNotice({ error, signal });
    watch.failed({ signal, notice });
    showStep({ choice, step: "failed" });
    buildSay({ presentation, line: `\n${notice}`, stream: "stderr" });

    if (!signal.aborted && shouldWaitForReturn(presentation)) {
      await waitForReturn(signal);
    }

    return { notice, failedRunIds: runIdsForCompileFailure({ error, signal, runId: choice.runId }) };
  }
}

/** The autoninja command a local build runs, with the Chromium checkout as its working directory. */
export function localBuildCommand(): string[] {
  return ["caffeinate", "-s", "autoninja", "-C", "out/Default", "chrome"];
}

async function buildLocally({
  choice,
  chromiumSrc,
  force,
  signal,
  presentation,
}: {
  choice: RunChoice;
  chromiumSrc: string;
  force: boolean;
  signal: AbortSignal;
  presentation?: BuildPresentation;
}): Promise<string> {
  const log = stepLog(presentation);
  buildSay({ presentation, line: `Building ${choice.branch} in ${chromiumSrc}` });
  buildSay({ presentation, line: "Ctrl-C cancels the build." });
  showStep({ choice, step: "checkout" });
  await checkOutRun({ choice, chromiumSrc, force });
  const commandPath = extendPathForCcache(process.env.PATH ?? "");

  if (Bun.which("autoninja", { PATH: commandPath }) == null) {
    throw new Error("autoninja is not on PATH. Install depot_tools on this Mac and start inspect from that shell.");
  }

  showStep({ choice, step: "build" });
  await runStep({
    command: ["bash", "-c", prepareCcacheScript()],
    signal,
    label: "ccache",
    cwd: chromiumSrc,
    env: { PATH: commandPath },
    ...log,
  });
  await ensureBuildArgs({ chromiumSrc, signal, commandPath, presentation });
  await runStep({
    command: localBuildCommand(),
    signal,
    label: "build",
    cwd: chromiumSrc,
    env: { PATH: commandPath },
    ...log,
  });
  const app = join(chromiumSrc, "out/Default/Chromium.app");

  if (!existsSync(app)) {
    throw new CompileFailedError(`the build finished, but ${app} is missing`);
  }

  await runStep({ command: openChromiumCommand(app), signal, label: "open", ...log });

  return `built ${choice.branch} at ${app}`;
}

function showStep({ choice, step }: { choice: RunChoice; step: BuildStep }) {
  setTerminalTitle(
    buildTitle({ taskId: choice.taskId, configId: choice.configId, repeat: choice.repeat, where: "local", step }),
  );
}

async function checkOutRun({ choice, chromiumSrc, force }: { choice: RunChoice; chromiumSrc: string; force: boolean }) {
  if (!force && (await hasUncommittedChanges(chromiumSrc))) {
    throw new Error(`${chromiumSrc} has uncommitted changes; commit/stash them or pass --force`);
  }

  await checkoutBranch({ branch: choice.branch, force, repo: chromiumSrc });
}

async function ensureBuildArgs({
  chromiumSrc,
  signal,
  commandPath,
  presentation,
}: {
  chromiumSrc: string;
  signal: AbortSignal;
  commandPath: string;
  presentation?: BuildPresentation;
}) {
  const argsGn = await Bun.file(BUILDER_ARGS).text();

  if (argsGn.trim() === "") {
    throw new Error(`write the build args in ${BUILDER_ARGS}`);
  }

  const desired = argsGn.endsWith("\n") ? argsGn : `${argsGn}\n`;
  const argsPath = join(chromiumSrc, "out/Default/args.gn");
  const current = existsSync(argsPath) ? await Bun.file(argsPath).text() : "";

  if (current === desired) {
    return;
  }

  if (Bun.which("gn", { PATH: commandPath }) == null) {
    throw new Error("gn is not on PATH. Install depot_tools on this Mac and start inspect from that shell.");
  }

  await mkdir(join(chromiumSrc, "out/Default"), { recursive: true });
  await Bun.write(argsPath, desired);

  try {
    await runStep({
      command: ["gn", "gen", "out/Default"],
      signal,
      label: "gn gen",
      cwd: chromiumSrc,
      env: { PATH: commandPath },
      ...stepLog(presentation),
    });
  } catch (error) {
    if (current === "") {
      await rm(argsPath, { force: true });
    } else {
      await Bun.write(argsPath, current);
    }

    throw error;
  }
}
