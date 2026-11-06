import { existsSync } from "node:fs";
import type { AgentTimeoutWatch, SessionTimeout, SessionTimeoutControls } from "./session-timeout.types";

const POLL_MS = 200;

/**
 * Counts active time toward `timeoutMs` and stops the process while `paused` is true.
 * Pausing freezes the timeout. The watch continues the process when the pause ends, when it is
 * stopped, or when `signal` aborts, so a pending kill can land.
 */
export function watchSessionTimeout(controls: SessionTimeoutControls): SessionTimeout {
  let activeMs = 0;
  let lastTick = controls.now();
  let stopped = false;
  let killed = false;
  let closed = false;

  const tick = () => {
    const current = controls.now();
    const isPaused = controls.paused();

    if (isPaused) {
      if (!stopped) {
        controls.stopProcess();
        stopped = true;
        controls.onPaused?.(true);
      }
    } else {
      if (stopped) {
        controls.continueProcess();
        stopped = false;
        controls.onPaused?.(false);
      }

      activeMs += current - lastTick;

      if (!killed && activeMs >= controls.timeoutMs) {
        killed = true;
        controls.kill();
      }
    }

    lastTick = current;
  };

  tick();
  const cancel = controls.every(tick);

  return {
    stop() {
      if (closed) {
        return;
      }

      closed = true;
      cancel();

      if (stopped) {
        controls.continueProcess();
        stopped = false;
        controls.onPaused?.(false);
      }
    },
  };
}

/**
 * Watches one claude process. A pause file stops that process so a remote build does not spend
 * the agent timeout. Abort continues it first: a stopped process would not receive the kill.
 */
export function watchAgentTimeout({
  pid,
  timeoutMs,
  pausePath,
  signal,
  onPaused,
  kill,
}: AgentTimeoutWatch): SessionTimeout {
  const watch = watchSessionTimeout({
    timeoutMs,
    now: Date.now,
    paused: () => pausePath != null && existsSync(pausePath),
    stopProcess: () => signalAgent({ pid, signal: "SIGSTOP" }),
    continueProcess: () => signalAgent({ pid, signal: "SIGCONT" }),
    kill,
    onPaused,
    every: everyPoll,
  });
  const onAbort = () => {
    watch.stop();
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  return {
    stop() {
      signal?.removeEventListener("abort", onAbort);
      watch.stop();
    },
  };
}

function everyPoll(tick: () => void): () => void {
  const handle = setInterval(tick, POLL_MS);
  handle.unref();

  return () => {
    clearInterval(handle);
  };
}

/** SIGSTOP or SIGCONT. A process that has already exited is not an error. */
function signalAgent({ pid, signal }: { pid: number; signal: NodeJS.Signals }): void {
  try {
    process.kill(pid, signal);
  } catch {
    // The process already exited. Nothing to stop or continue.
  }
}
