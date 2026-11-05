import type { RunChoice } from "../list/select-state.types";
import { presentBuildQueue } from "../remote/queue/build-queue";
import { presentBuild } from "../remote/remote-build";
import type { BuildTarget, BuildWork } from "./build-session.types";
import { builderConfig } from "./builder-config";
import type { BuilderConfig } from "./builder-config.types";
import { presentLocalBuild } from "./local-build";

/**
 * The build for one run on `target`, or the notice that says why it cannot start
 * (no run, a branch missing from the checkout, or no build Mac configured).
 * Several remote runs go through `remoteBuildSession`, which queues them.
 */
export function buildSession({
  choice,
  target,
  chromiumSrc,
  force,
}: {
  choice: RunChoice | undefined;
  target: BuildTarget;
  chromiumSrc: string;
  force: boolean;
}): BuildWork | string {
  if (!choice) {
    return "";
  }

  if (target === "local") {
    if (!choice.present) {
      return `branch ${choice.branch} is not in ${chromiumSrc}`;
    }

    return (signal) => presentLocalBuild({ choice, chromiumSrc, force, signal });
  }

  return remoteBuildSession({ choices: [choice], chromiumSrc });
}

/**
 * Remote builds for these runs. One run is a single build. Two or more are a queue on the build Mac,
 * one after another. A string is the notice that says why it cannot start.
 */
export function remoteBuildSession({
  choices,
  chromiumSrc,
}: {
  choices: RunChoice[];
  chromiumSrc: string;
}): BuildWork | string {
  if (choices.length === 0) {
    return "";
  }

  const presentChoices = choices.filter((choice) => choice.present);

  if (presentChoices.length === 0) {
    const missing = choices[0];

    return missing ? `branch ${missing.branch} is not in ${chromiumSrc}` : "";
  }

  const config = readBuilderConfig();

  if (typeof config === "string") {
    return config;
  }

  if (choices.length === 1) {
    const choice = presentChoices[0];

    if (!choice) {
      return "";
    }

    return (signal) => presentBuild({ choice, config, chromiumSrc, signal });
  }

  return (signal) => presentBuildQueue({ choices, config, chromiumSrc, signal });
}

function readBuilderConfig(): BuilderConfig | string {
  try {
    const config = builderConfig();

    if (!config) {
      return "run bun run setup:remote-build, then fill in configs/builder/remote.yaml";
    }

    return config;
  } catch (error) {
    return error instanceof Error ? error.message : "builder is not configured";
  }
}
