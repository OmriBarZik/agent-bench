import type { ClaudeResult } from "../../db/db.types";

/**
 * Turns one claude process's output into the result we store.
 * A crash, timeout, kill, or Ctrl+C becomes `is_error`. A session that already exited 0 is kept:
 * the stop arrived after it had finished.
 */
export function readClaudeOutput({
  stdout,
  stderr,
  exitCode,
  signalCode,
  startedAt,
  aborted,
}: {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signalCode: NodeJS.Signals | number | null;
  startedAt: number;
  aborted: boolean;
}): ClaudeResult {
  const parsed = parseClaudeStdout(stdout);
  const interrupted = aborted && exitCode !== 0;

  if (!parsed) {
    return {
      is_error: true,
      duration_ms: Date.now() - startedAt,
      error: failureError({ interrupted, signalCode, exitCode }),
      stderr: stderr.slice(-2000),
    };
  }

  if (interrupted) {
    parsed.is_error = true;
    parsed.error = "cancelled";

    if (typeof parsed.duration_ms !== "number") {
      parsed.duration_ms = Date.now() - startedAt;
    }

    if (stderr !== "") {
      parsed.stderr = stderr.slice(-2000);
    }

    return parsed;
  }

  if (exitCode !== 0) {
    parsed.is_error = true;
  }

  return parsed;
}

function parseClaudeStdout(stdout: string): ClaudeResult | null {
  try {
    const parsed: unknown = JSON.parse(stdout);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as ClaudeResult;
  } catch {
    return null;
  }
}

function failureError({
  interrupted,
  signalCode,
  exitCode,
}: {
  interrupted: boolean;
  signalCode: NodeJS.Signals | number | null;
  exitCode: number | null;
}): string {
  if (interrupted) {
    return "cancelled";
  }

  if (signalCode) {
    return `killed (${signalCode}), timeout?`;
  }

  return `exit ${exitCode}, unparseable output`;
}
