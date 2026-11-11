import type { BuildState, ValidateContext } from "../build/build-job.types";
import type { ChromeAction } from "../chrome/chrome-check.types";
import type { ChromeQueue } from "./chrome-queue.types";

/** Everything a tool call needs: the session, its builds so far, and the run_chrome queue. */
export type ToolSession = {
  context: ValidateContext;
  state: BuildState;
  chromeQueue: ChromeQueue;
};

/** wait_build arguments with defaults applied. The wait lasts until the build finishes. */
export type WaitInput = {
  /** Null means the newest build. */
  build: number | null;
};

/** run_chrome arguments with defaults applied. */
export type ChromeInput = {
  url: string;
  flags: string[];
  actions: ChromeAction[];
  width: number;
  height: number;
};
