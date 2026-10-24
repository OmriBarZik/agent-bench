import type { ClaudeCapture } from "./claude-process.types";
import { readClaudeOutput } from "./claude-result";

/**
 * Spawns claude and waits for it. Never throws because the session failed or was cancelled:
 * that comes back as a result with `is_error` set. `signal` kills the process so a Ctrl+C
 * can record the run instead of leaving it running.
 */
export async function captureClaude({
  command,
  cwd,
  env,
  timeoutMs,
  signal,
}: {
  command: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<ClaudeCapture> {
  const startedAt = Date.now();

  if (signal?.aborted) {
    return cancelledCapture(startedAt);
  }

  let claudeProcess;
  try {
    claudeProcess = Bun.spawn(command, {
      cwd,
      env,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      timeout: timeoutMs,
      signal,
    });
  } catch (error) {
    if (!signal?.aborted) {
      throw error;
    }

    const stderr = error instanceof Error ? error.message : String(error);

    return {
      stdout: "",
      stderr,
      result: readClaudeOutput({
        stdout: "",
        stderr,
        exitCode: null,
        signalCode: null,
        startedAt,
        aborted: true,
      }),
    };
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(claudeProcess.stdout).text(),
    new Response(claudeProcess.stderr).text(),
    claudeProcess.exited,
  ]);

  return {
    stdout,
    stderr,
    result: readClaudeOutput({
      stdout,
      stderr,
      exitCode,
      signalCode: claudeProcess.signalCode,
      startedAt,
      aborted: signal?.aborted === true,
    }),
  };
}

function cancelledCapture(startedAt: number): ClaudeCapture {
  return {
    stdout: "",
    stderr: "",
    result: readClaudeOutput({
      stdout: "",
      stderr: "",
      exitCode: null,
      signalCode: null,
      startedAt,
      aborted: true,
    }),
  };
}
