import type { ShutdownHandlers, ShutdownWatch } from "./shutdown.types";

/**
 * Thrown when Ctrl+C arrives before a runs row exists, so there is nothing to mark cancelled.
 * The benchmark stops without a stack trace.
 */
export class BenchmarkShutdown extends Error {
  constructor() {
    super("benchmark cancelled");
    this.name = "BenchmarkShutdown";
  }
}

/**
 * Listens for Ctrl+C. The first press aborts `signal` and calls `onFirst`.
 * The second calls `onForce` so the process can exit without waiting on a stuck child.
 */
export function watchForShutdown({ onFirst, onForce }: ShutdownHandlers): ShutdownWatch {
  const controller = new AbortController();
  let requested = false;

  const onSigint = () => {
    if (requested) {
      onForce();

      return;
    }

    requested = true;
    onFirst();
    controller.abort();
  };

  process.on("SIGINT", onSigint);

  return {
    signal: controller.signal,
    stop: () => {
      process.off("SIGINT", onSigint);
    },
  };
}
