import type { RunPhase } from "../runner/run-one/run-one.types";
import type { RunClock, RunClockControls, RunClockTarget } from "./run-clock.types";
import { setTerminalTitle } from "./terminal-title";
import { runTitle } from "./title-text";

const TICK_MS = 1000;

/** Shows the run in the terminal title, and ticks a clock once the agent is given the task. */
export function openRunClock(target: RunClockTarget): RunClock {
  return createRunClock({ target, now: Date.now, show: setTerminalTitle, every: everySecond });
}

/** Same clock as `openRunClock`, with the time source and the ticker passed in. */
export function createRunClock({ target, now, show, every }: RunClockControls): RunClock {
  let phase: RunPhase = "reset";
  let agentStartedAt: number | null = null;
  let cancelTick: (() => void) | null = null;
  let stopped = false;

  const render = () => {
    if (stopped) {
      return;
    }

    const elapsedMs = agentStartedAt == null ? undefined : now() - agentStartedAt;
    show(runTitle({ ...target, phase, elapsedMs }));
  };

  return {
    setPhase(next) {
      phase = next;

      if (next === "agent") {
        agentStartedAt = now();
        cancelTick?.();
        cancelTick = every(render);
      }

      if (next === "reset") {
        agentStartedAt = null;
        cancelTick?.();
        cancelTick = null;
      }

      render();
    },
    stop() {
      stopped = true;
      cancelTick?.();
      cancelTick = null;
    },
  };
}

function everySecond(tick: () => void): () => void {
  const handle = setInterval(tick, TICK_MS);
  handle.unref();

  return () => {
    clearInterval(handle);
  };
}
