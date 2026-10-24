/** What to do on the first and second Ctrl+C. */
export type ShutdownHandlers = {
  /** First press: ask the current run to stop and be recorded. */
  onFirst: () => void;
  /** Second press: leave immediately. The handler must exit the process. */
  onForce: () => void;
};

/** Ctrl+C handling for one benchmark process. */
export type ShutdownWatch = {
  /** Aborted after the first Ctrl+C. */
  signal: AbortSignal;
  /** Removes the listener. */
  stop: () => void;
};
