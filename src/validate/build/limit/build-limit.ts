import { appendFileSync } from "node:fs";
import type { BuildJob } from "../build-job.types";
import type { BuildLimitTimer } from "./build-limit.types";

/**
 * Fails the build when it runs longer than `timeoutMs`. The agent timeout is a separate clock
 * and does not apply here. `timeoutMs` null means no limit, which is the manual server.
 */
export function armBuildLimit({
  job,
  logPath,
  timeoutMs,
  now = Date.now,
  setTimer = defaultTimer,
}: {
  job: BuildJob;
  logPath: string;
  timeoutMs: number | null;
  now?: () => number;
  setTimer?: BuildLimitTimer;
}): () => void {
  if (timeoutMs == null) {
    return () => {};
  }

  let fired = false;
  const fire = () => {
    if (fired || job.outcome != null) {
      return;
    }

    fired = true;
    const minutes = Math.max(1, Math.round(timeoutMs / 60_000));
    appendFileSync(logPath, `\nBuild timed out after ${minutes} min.\n`);
    job.timedOut = true;
    job.controller.abort();
  };
  const remaining = timeoutMs - (now() - job.startedAt);

  if (remaining <= 0) {
    fire();

    return () => {};
  }

  const cancel = setTimer(fire, remaining);

  return () => {
    fired = true;
    cancel();
  };
}

/** `BENCH_BUILD_TIMEOUT_MS` from the runner. Absent when chrome-validate is started by hand. */
export function readBuildTimeoutMs(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = env.BENCH_BUILD_TIMEOUT_MS;

  if (raw == null || raw === "") {
    return null;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function defaultTimer(callback: () => void, delayMs: number): () => void {
  const timer = setTimeout(callback, delayMs);
  timer.unref();

  return () => {
    clearTimeout(timer);
  };
}
