import type { RunPlan } from "../resolve-start.types";
import type { RunPhase } from "../../runner/run-one/run-one.types";

/** How far the matrix has got, for a console line or the Start-tab status. */
export type MatrixProgress = {
  /** What just happened. */
  kind: "run-start" | "run-done" | "run-cancelled" | "blocker" | "discard" | "message";
  /** Short line for the UI or console. */
  text: string;
  /** 1-based index of the current run, when known. */
  index?: number;
  /** Total runs in the plan. */
  total?: number;
  /** Current run phase, when a run is in flight. */
  phase?: RunPhase;
  /** True while the agent is waiting on a remote build. */
  agentPaused?: boolean;
  taskId?: string;
  configId?: string;
  repeat?: number;
  /** The current run, once its agent has started. */
  liveRunId?: string;
  /** The current run's live agent log, once its agent has started. */
  liveLogPath?: string;
};

/** Whether the caller prints progress and owns a title clock (CLI) or only receives callbacks (TUI). */
export type MatrixPresentation = "console" | "quiet";

/** Inputs for one tasks × configs × repeats loop. */
export type RunMatrixOptions = {
  plan: RunPlan;
  /** Wipe uncommitted Chromium changes without asking. */
  force: boolean;
  judgeModel: string;
  signal: AbortSignal;
  /**
   * When false, skip the cooked discard prompt and throw if the tree is dirty.
   * The TUI asks first, then passes force or cancels.
   */
  askDiscard?: boolean;
  /** console: print and title-clock (CLI). quiet: only onProgress (TUI). */
  presentation?: MatrixPresentation;
  /** Called for each status update. Console presentation still prints on its own. */
  onProgress?: (progress: MatrixProgress) => void;
  /** When false, do not open the exclusive agent build log terminal (TUI Build tab owns it). */
  watchBuildLog?: boolean;
};

/** How the matrix ended. */
export type RunMatrixResult = {
  /** Runs that finished with a judge decision. */
  finished: number;
  /** Planned run count once the loop started; 0 if it stopped before that. */
  total: number;
  /** True when Ctrl+C or a cancelled run stopped the rest. */
  stopped: boolean;
};
