import type { ClaudeCapture } from "./claude-process.types";
import { readClaudeOutput } from "./claude-result";
import { watchAgentTimeout } from "./session/session-timeout";

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
  pausePath,
  onPaused,
}: {
  command: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  signal?: AbortSignal;
  /** When this file exists the process is stopped and the timeout does not advance. */
  pausePath?: string;
  /** Told when the process is stopped for a build, and when it runs again. */
  onPaused?: (paused: boolean) => void;
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

  const timeout = watchAgentTimeout({
    pid: claudeProcess.pid,
    timeoutMs,
    pausePath,
    signal,
    onPaused,
    kill: () => {
      try {
        claudeProcess.kill();
      } catch {
        // The process already exited.
      }
    },
  });

  try {
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
  } finally {
    timeout.stop();
  }
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
