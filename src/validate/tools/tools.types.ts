import type { BuildState, ValidateContext } from "../build/build-job.types";
import type { ChromeAction } from "../chrome/chrome-check.types";

/** Everything a tool call needs: the session and its builds so far. */
export type ToolSession = {
  context: ValidateContext;
  state: BuildState;
};

/** wait_build arguments with defaults applied. */
export type WaitInput = {
  /** Null means the newest build. */
  build: number | null;
  maxWaitMs: number;
};

/** run_chrome arguments with defaults applied. */
export type ChromeInput = {
  url: string;
  flags: string[];
  actions: ChromeAction[];
  width: number;
  height: number;
};
