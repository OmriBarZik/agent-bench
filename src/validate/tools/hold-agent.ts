import { appendFileSync, rmSync, writeFileSync } from "node:fs";
import { AGENT_PAUSED_LINE, AGENT_RESUMED_LINE, agentPausePath } from "../../runner/claude/session/agent-pause";

/**
 * Stops the agent for this build. The runner sees the pause file and freezes the agent timeout.
 * The returned function resumes it. Outside a benchmark run there is no agent to stop.
 */
export function holdAgent({
  runId,
  logPath,
  pausePath = runId == null ? null : agentPausePath(runId),
}: {
  runId: string | null;
  logPath: string;
  /** Defaults to this run's pause file. Tests pass a temporary path. */
  pausePath?: string | null;
}): () => void {
  if (runId == null || pausePath == null) {
    return () => {};
  }

  appendFileSync(logPath, `${AGENT_PAUSED_LINE}\n`);
  writeFileSync(pausePath, "paused\n");
  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    rmSync(pausePath, { force: true });
    appendFileSync(logPath, `${AGENT_RESUMED_LINE}\n`);
  };
}
