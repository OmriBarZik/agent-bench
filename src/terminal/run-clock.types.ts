import type { RunPhase } from "../runner/run-one/run-one.types";

/** The run the clock labels: its place in the plan, and which task and config it is. */
export type RunClockTarget = {
  index: number;
  total: number;
  taskId: string;
  configId: string;
  repeat: number;
};

/** Draws one title. */
export type RunClockShow = (title: string) => void;

/** Starts a repeating tick and returns the function that stops it. */
export type RunClockTicker = (tick: () => void) => () => void;

/** What the clock needs in order to tick. Tests pass their own clock and ticker. */
export type RunClockControls = {
  target: RunClockTarget;
  now: () => number;
  show: RunClockShow;
  every: RunClockTicker;
};

/** A live title for one run. `stop` ends the tick so a later title stays put. */
export type RunClock = {
  setPhase: (phase: RunPhase) => void;
  /** Freezes the clock while a remote build has the agent stopped. */
  setPaused: (paused: boolean) => void;
  stop: () => void;
};
