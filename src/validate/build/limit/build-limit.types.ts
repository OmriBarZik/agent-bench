/** Schedules the build limit and returns the function that cancels it. */
export type BuildLimitTimer = (callback: () => void, delayMs: number) => () => void;
