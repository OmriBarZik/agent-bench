import { expect, test } from "bun:test";
import { captureClaude } from "./claude-process";

test("captureClaude does not start a session that is already cancelled", async () => {
  const controller = new AbortController();
  controller.abort();
  const started = Date.now();
  const captured = await captureClaude({
    command: ["sleep", "30"],
    cwd: import.meta.dir,
    env: process.env,
    timeoutMs: 5_000,
    signal: controller.signal,
  });

  expect(Date.now() - started).toBeLessThan(2_000);
  expect(captured.result.is_error).toBe(true);
  expect(captured.result.error).toBe("cancelled");
  expect(typeof captured.result.duration_ms).toBe("number");
});

test("captureClaude stops a running process when the signal is aborted", async () => {
  const controller = new AbortController();
  const pending = captureClaude({
    command: ["sleep", "30"],
    cwd: import.meta.dir,
    env: process.env,
    timeoutMs: 5_000,
    signal: controller.signal,
  });
  controller.abort();
  const captured = await pending;

  expect(captured.result.is_error).toBe(true);
  expect(captured.result.error).toBe("cancelled");
  expect(captured.result.duration_ms).toBeLessThan(5_000);
});
