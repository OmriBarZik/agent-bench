import type { RunChoice } from "../list/select-state.types";
import { presentBuild } from "../remote/remote-build";
import { builderConfig } from "./builder-config";
import type { BuildTarget, BuildWork } from "./build-session.types";
import { presentLocalBuild } from "./local-build";

/**
 * The build for the highlighted run on `target`, or the notice that says why it cannot start
 * (no run, a branch missing from the checkout, or no build Mac configured).
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

  if (!choice.present) {
    return `branch ${choice.branch} is not in ${chromiumSrc}`;
  }

  if (target === "local") {
    return (signal) => presentLocalBuild({ choice, chromiumSrc, force, signal });
  }

  let config: ReturnType<typeof builderConfig>;

  try {
    config = builderConfig();
  } catch (error) {
    return error instanceof Error ? error.message : "builder is not configured";
  }

  if (!config) {
    return "run bun run setup:remote-build, then fill in configs/builder/remote.yaml";
  }

  const remoteConfig = config;

  return (signal) => presentBuild({ choice, config: remoteConfig, chromiumSrc, signal });
}
