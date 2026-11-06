import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { watchAgentTimeout, watchSessionTimeout } from "./session-timeout";

test("paused time does not count, and the process is stopped until the pause ends", () => {
  let current = 0;
  let isPaused = false;
  const events: string[] = [];
  const held: { tick: (() => void) | null } = { tick: null };
  const watch = watchSessionTimeout({
    timeoutMs: 1_000,
    now: () => current,
    paused: () => isPaused,
    stopProcess: () => {
      events.push("stop");
    },
    continueProcess: () => {
      events.push("continue");
    },
    kill: () => {
      events.push("kill");
    },
    every: (callback) => {
      held.tick = callback;

      return () => {
        events.push("cleared");
      };
    },
  });

  current = 900;
  held.tick?.();
  expect(events).toEqual([]);

  isPaused = true;
  current = 5_000;
  held.tick?.();
  expect(events).toEqual(["stop"]);

  isPaused = false;
  current = 5_050;
  held.tick?.();
  expect(events).toEqual(["stop", "continue"]);

  current = 5_200;
  held.tick?.();
  expect(events).toEqual(["stop", "continue", "kill"]);

  watch.stop();
  expect(events).toContain("cleared");
});

test("abort continues a stopped process so the kill can land", async () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-timeout-"));
  const pausePath = join(directory, "agent-paused");
  writeFileSync(pausePath, "paused\n");
  const child = Bun.spawn(["sleep", "30"], { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
  const controller = new AbortController();
  const watch = watchAgentTimeout({
    pid: child.pid,
    timeoutMs: 60_000,
    pausePath,
    signal: controller.signal,
    kill: () => {
      child.kill();
    },
  });

  try {
    await Bun.sleep(400);
    expect(processState(child.pid).startsWith("T")).toBe(true);

    controller.abort();
    await Bun.sleep(200);
    expect(processState(child.pid).startsWith("T")).toBe(false);
  } finally {
    watch.stop();
    child.kill();
    await child.exited;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the agent timeout waits out a pause and then kills the process", async () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-timeout-"));
  const pausePath = join(directory, "agent-paused");
  writeFileSync(pausePath, "paused\n");
  const child = Bun.spawn(["sleep", "30"], { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
  let killed = false;
  const watch = watchAgentTimeout({
    pid: child.pid,
    timeoutMs: 300,
    pausePath,
    kill: () => {
      killed = true;
      child.kill();
    },
  });

  try {
    await Bun.sleep(500);
    expect(killed).toBe(false);
    expect(processState(child.pid).startsWith("T")).toBe(true);

    rmSync(pausePath);
    await Bun.sleep(1_000);
    expect(killed).toBe(true);
  } finally {
    watch.stop();
    child.kill();
    await child.exited;
    rmSync(directory, { recursive: true, force: true });
  }
});

function processState(pid: number): string {
  const status = Bun.spawnSync(["ps", "-o", "state=", "-p", String(pid)]);

  return status.stdout.toString().trim();
}
