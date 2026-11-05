import { setTerminalTitle } from "../../../terminal/terminal-title";
import { buildTitle } from "../../../terminal/title-text";
import { failureNotice, waitForReturn } from "../../build/build-process";
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
}: {
  choices: RunChoice[];
  config: BuilderConfig;
  chromiumSrc: string;
  signal: AbortSignal;
}): Promise<string> {
  const total = choices.length;
  console.log(`Queue: ${total} runs on ${config.host}`);
  console.log("Ctrl-C cancels the rest and returns to the list.");

  try {
    console.log(`Checking ${config.host}…`);
    const problem = await validateRemote({ config, signal });

    if (problem) {
      for (const choice of choices) {
        noteFailure({ choice, host: config.host, signal, notice: problem });
      }

      console.error(`\n${problem}`);
      await waitForReturn(signal);

      return problem;
    }

    const outcomes: QueueOutcome[] = [];

    for (let index = 0; index < choices.length; index++) {
      const choice = choices[index];

      if (!choice || signal.aborted) {
        if (signal.aborted) {
          noteRest({ choices: choices.slice(index), host: config.host, signal });
        }

        break;
      }

      console.log(`\nQueue ${index + 1}/${total}  ${choice.taskId} × ${choice.configId}`);
      const outcome = await oneInQueue({ choice, config, chromiumSrc, signal });
      outcomes.push(outcome);
      showOutcome({ choice, config, outcome });
    }

    if (signal.aborted) {
      console.error("\nbuild cancelled");

      return "build cancelled";
    }

    const notice = queueNotice(outcomes);
    console.log(`\n${notice}`);
    await waitForReturn(signal);

    return notice;
  } catch (error) {
    const notice = failureNotice({ error, signal });
    console.error(`\n${notice}`);

    if (!signal.aborted) {
      await waitForReturn(signal);
    }

    return notice;
  }
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
}: {
  choice: RunChoice;
  config: BuilderConfig;
  chromiumSrc: string;
  signal: AbortSignal;
}): Promise<QueueOutcome> {
  const watch = openBuildWatch({ choice, target: "remote", host: config.host });

  if (!choice.present) {
    const notice = `branch ${choice.branch} is not in ${chromiumSrc}`;
    watch.failed({ signal, notice });
    console.error(notice);

    return { branch: choice.branch, built: false, notice };
  }

  try {
    const built = await buildRemoteRun({ choice, config, chromiumSrc, signal, openApp: false });
    watch.passed();
    console.log(built.notice);

    return { branch: choice.branch, built: true, notice: built.notice };
  } catch (error) {
    const notice = failureNotice({ error, signal });
    watch.failed({ signal, notice });
    console.error(notice);

    return { branch: choice.branch, built: false, notice };
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
