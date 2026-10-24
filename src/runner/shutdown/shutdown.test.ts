import { expect, test } from "bun:test";
import { watchForShutdown } from "./shutdown";

test("the first Ctrl+C aborts and the second asks to force exit", () => {
  let first = 0;
  let forced = 0;
  const shutdown = watchForShutdown({
    onFirst: () => {
      first += 1;
    },
    onForce: () => {
      forced += 1;
    },
  });

  try {
    expect(shutdown.signal.aborted).toBe(false);
    process.emit("SIGINT");
    expect(shutdown.signal.aborted).toBe(true);
    expect(first).toBe(1);
    expect(forced).toBe(0);
    process.emit("SIGINT");
    expect(forced).toBe(1);
    expect(first).toBe(1);
  } finally {
    shutdown.stop();
  }
});

test("stop ignores a later Ctrl+C", () => {
  let first = 0;
  const shutdown = watchForShutdown({
    onFirst: () => {
      first += 1;
    },
    onForce: () => {},
  });
  shutdown.stop();
  process.emit("SIGINT");

  expect(first).toBe(0);
  expect(shutdown.signal.aborted).toBe(false);
});
