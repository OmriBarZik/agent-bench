import type { ChromeQueue, QueuedResult } from "./chrome-queue.types";

/**
 * Runs `body` once every call queued before it has finished. Parallel run_chrome calls used to launch Chromium side
 * by side, and the slower launch hit its start timeout. A failing body still releases the next call.
 */
export async function runQueued<Result>({
  queue,
  body,
}: {
  queue: ChromeQueue;
  body: () => Promise<Result>;
}): Promise<QueuedResult<Result>> {
  const previous = queue.tail;
  const turn = Promise.withResolvers<void>();
  queue.tail = turn.promise;
  const queuedAt = Date.now();

  try {
    await previous;
    const waitedMs = Date.now() - queuedAt;

    return { result: await body(), waitedMs };
  } finally {
    turn.resolve();
  }
}
