import { createLogView, pullLogView } from "../../runner/build-log/log-view";
import type { ChromiumJobStatus } from "../../start/jobs/chromium-job.types";
import type { RunChoice } from "../list/select-state.types";
import type { LiveLogViewer, LiveRun } from "./live-log.types";

/** The matrix run whose agent session is running now, or null once it reached the judge or the matrix ended. */
export function liveRun(status: ChromiumJobStatus): LiveRun | null {
  const matrix = status.kind === "matrix" ? status.matrix : undefined;

  if (matrix?.kind !== "run-start" || matrix.phase !== "agent" || !matrix.liveRunId || !matrix.liveLogPath) {
    return null;
  }

  return { runId: matrix.liveRunId, path: matrix.liveLogPath };
}

/** Sets `liveLogPath` on the run whose agent is working and clears it on every other run. */
export function markLiveRun({ choices, live }: { choices: RunChoice[]; live: LiveRun | null }): void {
  for (const choice of choices) {
    choice.liveLogPath = choice.runId === live?.runId ? live.path : null;
  }
}

/** A viewer on `live`, already holding what the log has so far. */
export function openLiveLog(live: LiveRun): LiveLogViewer {
  return { ...live, view: pullLogView({ view: createLogView(), path: live.path }) };
}

/** Reads what the agent wrote since the last call. */
export function syncLiveLog(viewer: LiveLogViewer): LiveLogViewer {
  return { ...viewer, view: pullLogView({ view: viewer.view, path: viewer.path }) };
}
