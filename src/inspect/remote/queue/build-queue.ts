import { setTerminalTitle } from "../../../terminal/terminal-title";
import { buildTitle } from "../../../terminal/title-text";
import {
  buildSay,
  failureNotice,
  isCompileFailure,
  shouldWaitForReturn,
  waitForReturn,
} from "../../build/build-process";
import type { BuildFinish, BuildPresentation } from "../../build/build-session.types";
import type { BuilderConfig } from "../../build/builder-config.types";
import { openBuildWatch } from "../../build/record/record-build";
import type { RunChoice } from "../../list/select-state.types";
import { buildRemoteRun } from "../remote-build";
import { validateRemote } from "../validate-remote";
import type { QueueOutcome } from "./build-queue.types";

/**
 * Builds each run on the build Mac, one after another, and copies each Chromium.app back.
 * A failed run is recorded and the queue continues. Ctrl-C cancels the rest.
 * Resolves with the notice for the list.
 */
export async function presentBuildQueue({
  choices,
  config,
  chromiumSrc,
  signal,
  presentation,
}: {
  choices: RunChoice[];
  config: BuilderConfig;
  chromiumSrc: string;
  signal: AbortSignal;
  presentation?: BuildPresentation;
}): Promise<BuildFinish> {
  const total = choices.length;
  buildSay({ presentation, line: `Queue: ${total} runs on ${config.host}` });
  buildSay({ presentation, line: "Ctrl-C cancels the rest." });
  const outcomes: QueueOutcome[] = [];

  try {
    buildSay({ presentation, line: `Checking ${config.host}…` });
    const problem = await validateRemote({ config, signal });

    if (problem) {
      for (const choice of choices) {
        noteFailure({ choice, host: config.host, signal, notice: problem });
      }

      buildSay({ presentation, line: `\n${problem}`, stream: "stderr" });

      if (shouldWaitForReturn(presentation)) {
        await waitForReturn(signal);
      }

      return { notice: problem, failedRunIds: [] };
    }

    for (let index = 0; index < choices.length; index++) {
      const choice = choices[index];

      if (!choice || signal.aborted) {
        if (signal.aborted) {
          noteRest({ choices: choices.slice(index), host: config.host, signal });
        }

        break;
      }

      buildSay({ presentation, line: `\nQueue ${index + 1}/${total}  ${choice.taskId} × ${choice.configId}` });
      const outcome = await oneInQueue({ choice, config, chromiumSrc, signal, presentation });
      outcomes.push(outcome);
      showOutcome({ choice, config, outcome });
    }

    if (signal.aborted) {
      buildSay({ presentation, line: "\nbuild cancelled", stream: "stderr" });

      return { notice: "build cancelled", failedRunIds: compileFailedRunIds(outcomes) };
    }

    const notice = queueNotice(outcomes);
    buildSay({ presentation, line: `\n${notice}` });

    if (shouldWaitForReturn(presentation)) {
      await waitForReturn(signal);
    }

    return { notice, failedRunIds: compileFailedRunIds(outcomes) };
  } catch (error) {
    const notice = failureNotice({ error, signal });
    buildSay({ presentation, line: `\n${notice}`, stream: "stderr" });

    if (!signal.aborted && shouldWaitForReturn(presentation)) {
      await waitForReturn(signal);
    }

    return { notice, failedRunIds: compileFailedRunIds(outcomes) };
  }
}

/** Runs in this queue whose compile failed, in queue order. */
export function compileFailedRunIds(outcomes: QueueOutcome[]): string[] {
  return outcomes.filter((outcome) => outcome.compileFailed).map((outcome) => outcome.runId);
}

/** The list notice after a queue: how many ran and how many were copied back. */
export function queueNotice(outcomes: QueueOutcome[]): string {
  const built = outcomes.filter((outcome) => outcome.built).length;
  const total = outcomes.length;

  if (built === total) {
    return `queued ${total} builds`;
  }

  return `queued ${total} builds, ${built} built`;
}

async function oneInQueue({
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
}): Promise<QueueOutcome> {
  const watch = openBuildWatch({ choice, target: "remote", host: config.host });

  if (!choice.present) {
    const notice = `branch ${choice.branch} is not in ${chromiumSrc}`;
    watch.failed({ signal, notice });
    buildSay({ presentation, line: notice, stream: "stderr" });

    return { runId: choice.runId, branch: choice.branch, built: false, notice, compileFailed: false };
  }

  try {
    const built = await buildRemoteRun({ choice, config, chromiumSrc, signal, openApp: false, presentation });
    watch.passed();
    buildSay({ presentation, line: built.notice });

    return { runId: choice.runId, branch: choice.branch, built: true, notice: built.notice, compileFailed: false };
  } catch (error) {
    const notice = failureNotice({ error, signal });
    watch.failed({ signal, notice });
    buildSay({ presentation, line: notice, stream: "stderr" });

    return {
      runId: choice.runId,
      branch: choice.branch,
      built: false,
      notice,
      compileFailed: isCompileFailure(error) && !signal.aborted,
    };
  }
}

/** Records queue runs that never started compiling, such as a build Mac that could not be reached. */
function noteRest({ choices, host, signal }: { choices: RunChoice[]; host: string; signal: AbortSignal }) {
  for (const choice of choices) {
    noteFailure({ choice, host, signal, notice: "build cancelled" });
  }
}

/** Records one queue run that never started compiling. */
function noteFailure({
  choice,
  host,
  signal,
  notice,
}: {
  choice: RunChoice;
  host: string;
  signal: AbortSignal;
  notice: string;
}) {
  openBuildWatch({ choice, target: "remote", host }).failed({ signal, notice });
}

function showOutcome({
  choice,
  config,
  outcome,
}: {
  choice: RunChoice;
  config: BuilderConfig;
  outcome: QueueOutcome;
}): void {
  setTerminalTitle(
    buildTitle({
      taskId: choice.taskId,
      configId: choice.configId,
      repeat: choice.repeat,
      where: config.host,
      step: outcome.built ? "built" : "failed",
    }),
  );
}
