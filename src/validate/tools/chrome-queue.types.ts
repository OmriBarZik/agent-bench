/** Serializes run_chrome calls in one session, so two calls never launch Chromium at the same time. */
export type ChromeQueue = {
  /** Settles when the newest queued call has finished. */
  tail: Promise<void>;
};

/** A queued call's result and how long it waited for its turn. */
export type QueuedResult<Result> = {
  result: Result;
  waitedMs: number;
};
