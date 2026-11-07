import type { BuildFinish, BuildWork } from "../../inspect/build/build-session.types";
import type { RunChoice } from "../../inspect/list/select-state.types";
import type { RunPlan } from "../resolve-start.types";
import type { MatrixProgress, RunMatrixResult } from "./run-matrix.types";

/** Which Chromium-touching job owns the single slot. */
export type ChromiumJobKind = "matrix" | "build" | "checkout";

/** Live status the Start / Build tabs read. */
export type ChromiumJobStatus = {
  kind: ChromiumJobKind | "idle";
  /** One-line summary for the UI. */
  label: string;
  /** Inspect-build log the Build tab should follow, when this job pipes one. */
  logPath: string | null;
  /** True after cancel until the job settles. */
  stopping: boolean;
  /** Synthetic id so the Build tab can reset its log cursor when the file changes. */
  logId: number | null;
  /** Matrix progress fields when kind is matrix. */
  matrix?: MatrixProgress;
};

/** What startMatrix needs beyond the plan. */
export type StartMatrixRequest = {
  plan: RunPlan;
  /** Already confirmed discard, or --force. */
  force: boolean;
  judgeModel: string;
};

/** Callbacks the TUI host wires so tabs refresh and Build can take focus. */
export type ChromiumJobHooks = {
  /** Status changed; repaint. */
  onChange: () => void;
  /** An inspect or agent build log became relevant; switch to the Build tab. */
  onBuildLog?: () => void;
  /** A Runs-tab build finished (for mark-failed and Chromium.app attach). */
  onBuildFinish?: (finish: BuildFinish) => void;
};

/** The single-slot Chromium job runner used while the start TUI is open. */
export type ChromiumJobController = {
  status: () => ChromiumJobStatus;
  /** Starts the matrix, or returns a refuse notice. */
  startMatrix: (request: StartMatrixRequest) => string | null;
  /** Starts an inspect build (local / remote / queue), or returns a refuse notice. */
  startBuild: (work: BuildWork) => string | null;
  /** Checks a run's branch out, or returns a refuse notice. */
  startCheckout: (choice: RunChoice) => string | null;
  /** Aborts the active job. True when there was one. */
  cancel: () => boolean;
  /** Last matrix result, if any. */
  lastMatrix: () => RunMatrixResult | null;
};
