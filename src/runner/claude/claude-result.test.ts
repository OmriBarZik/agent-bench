import { expect, test } from "bun:test";
import { readClaudeOutput } from "./claude-result";

test("readClaudeOutput keeps a session that exited cleanly", () => {
  const result = readClaudeOutput({
    stdout: JSON.stringify({
      is_error: false,
      duration_ms: 1500,
      num_turns: 2,
      total_cost_usd: 0.1,
      usage: { input_tokens: 8, output_tokens: 3 },
    }),
    stderr: "",
    exitCode: 0,
    signalCode: null,
    startedAt: Date.now() - 1500,
    aborted: false,
  });

  expect(result.is_error).toBe(false);
  expect(result.duration_ms).toBe(1500);
  expect(result.num_turns).toBe(2);
  expect(result.usage?.input_tokens).toBe(8);
});

test("readClaudeOutput marks a killed session that printed no JSON", () => {
  const startedAt = Date.now() - 4000;
  const result = readClaudeOutput({
    stdout: "",
    stderr: "partial log",
    exitCode: null,
    signalCode: "SIGTERM",
    startedAt,
    aborted: true,
  });

  expect(result.is_error).toBe(true);
  expect(result.error).toBe("cancelled");
  expect(result.stderr).toBe("partial log");
  expect(result.duration_ms).toBeGreaterThanOrEqual(4000);
});

test("readClaudeOutput keeps usage from a killed session and records the cancel", () => {
  const result = readClaudeOutput({
    stdout: JSON.stringify({
      duration_ms: 9000,
      num_turns: 4,
      total_cost_usd: 0.42,
      usage: { input_tokens: 11, output_tokens: 6, cache_read_input_tokens: 2 },
    }),
    stderr: "stopped",
    exitCode: null,
    signalCode: "SIGINT",
    startedAt: Date.now() - 9000,
    aborted: true,
  });

  expect(result.is_error).toBe(true);
  expect(result.error).toBe("cancelled");
  expect(result.duration_ms).toBe(9000);
  expect(result.num_turns).toBe(4);
  expect(result.total_cost_usd).toBe(0.42);
  expect(result.usage).toEqual({ input_tokens: 11, output_tokens: 6, cache_read_input_tokens: 2 });
  expect(result.stderr).toBe("stopped");
});

test("readClaudeOutput keeps a result that exited 0 even if Ctrl+C landed as it finished", () => {
  const result = readClaudeOutput({
    stdout: JSON.stringify({ is_error: false, duration_ms: 100, result: "done" }),
    stderr: "",
    exitCode: 0,
    signalCode: null,
    startedAt: Date.now() - 100,
    aborted: true,
  });

  expect(result.is_error).toBe(false);
  expect(result.error).toBeUndefined();
  expect(result.result).toBe("done");
});

test("readClaudeOutput explains a timeout kill when the user did not cancel", () => {
  const result = readClaudeOutput({
    stdout: "not json",
    stderr: "",
    exitCode: null,
    signalCode: "SIGTERM",
    startedAt: Date.now(),
    aborted: false,
  });

  expect(result.is_error).toBe(true);
  expect(result.error).toBe("killed (SIGTERM), timeout?");
});
