import type { LogView } from "../../runner/build-log/log-view.types";

/** The run whose agent is working right now, and its live log file. */
export type LiveRun = {
  runId: string;
  path: string;
};

/** The live agent log open over the Runs list. */
export type LiveLogViewer = LiveRun & {
  view: LogView;
};
