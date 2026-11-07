import type { AgentBuildView } from "../../../db/db.types";

/** List vs the streaming log for one build. */
export type BuildScreenMode = "list" | "log";

/** Selection and follow state for the Build tab. */
export type BuildListState = {
  /** Builds shown in the list, building ones first. */
  builds: AgentBuildView[];
  /** Index into `builds`, or -1 when empty. */
  selected: number;
  /** First visible row when the list is taller than the screen. */
  scroll: number;
  /** When true, keep the selection on a live building build. */
  followLive: boolean;
  mode: BuildScreenMode;
};
