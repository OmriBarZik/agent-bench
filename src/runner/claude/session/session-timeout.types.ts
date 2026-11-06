/** Stops the watch. Continues the process when this watch had stopped it. */
export type SessionTimeout = {
  stop: () => void;
};

/** How the watch reads the clock, sees a pause, and stops or kills the process. Tests pass their own. */
export type SessionTimeoutControls = {
  timeoutMs: number;
  now: () => number;
  /** True while a remote build is holding the agent. That time does not count. */
  paused: () => boolean;
  stopProcess: () => void;
  continueProcess: () => void;
  kill: () => void;
  /** Called when the process is stopped for a build, and again when it is continued. */
  onPaused?: (paused: boolean) => void;
  every: (tick: () => void) => () => void;
};

/** What the runner passes to watch one live claude process. */
export type AgentTimeoutWatch = {
  pid: number;
  timeoutMs: number;
  /** Absent for the judge, which is never paused. */
  pausePath?: string;
  signal?: AbortSignal;
  onPaused?: (paused: boolean) => void;
  kill: () => void;
};
