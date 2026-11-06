import { existsSync } from "node:fs";
import { join } from "node:path";
import { RUNS_DIR } from "../../../paths";

/** Minutes the agent may work. Time spent paused for a remote build does not count. */
export const DEFAULT_AGENT_TIMEOUT_MIN = 60;

/** Minutes one remote build may run before it fails and the agent is resumed. */
export const DEFAULT_BUILD_TIMEOUT_MIN = 90;

/** Written into the build log, and pinned on the build screen, while wait_build holds the agent. */
export const AGENT_PAUSED_LINE = "Agent paused until this build finishes.";

/** Written into the build log once wait_build returns and the agent is allowed to run again. */
export const AGENT_RESUMED_LINE = "Agent resumed.";

/** Marker the runner watches. Present only while wait_build is blocking on a build. */
export function agentPausePath(runId: string): string {
  return join(RUNS_DIR, runId, "agent-paused");
}

/** True while this run's agent is stopped for a remote build. */
export function agentIsPaused(runId: string | null): boolean {
  if (runId == null) {
    return false;
  }

  return existsSync(agentPausePath(runId));
}
