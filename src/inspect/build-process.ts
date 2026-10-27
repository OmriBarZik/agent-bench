import { createInterface } from "node:readline";
import type { RunStep } from "./remote-build.types";

/** Runs one local command. Ctrl-C rejects with `build cancelled`. */
export async function runStep({ command, signal, label, stdin, cwd }: RunStep): Promise<void> {
  if (signal.aborted) {
    throw new Error("build cancelled");
  }

  let subprocess: ReturnType<typeof Bun.spawn>;

  try {
    subprocess = Bun.spawn(command, {
      stdin: stdin == null ? "ignore" : "pipe",
      stdout: "inherit",
      stderr: "inherit",
      signal,
      cwd,
      // A password prompt cannot be answered here, so SSH must fail instead of waiting.
      env: { ...process.env, GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o ConnectTimeout=10" },
    });
  } catch (error) {
    if (signal.aborted) {
      throw new Error("build cancelled");
    }

    const message = error instanceof Error ? error.message : "could not start";

    throw new Error(`${label} failed to start: ${message}`);
  }

  if (stdin != null) {
    const sink = subprocess.stdin;

    if (typeof sink === "number" || sink == null) {
      throw new Error(`${label} failed to start: no stdin`);
    }

    sink.write(stdin);
    await sink.end();
  }

  const exitCode = await subprocess.exited;

  if (signal.aborted) {
    throw new Error("build cancelled");
  }

  if (exitCode !== 0) {
    throw new Error(`${label} failed (${exitCode})`);
  }
}

/** The line the run list shows when a build throws. */
export function failureNotice({ error, signal }: { error: unknown; signal: AbortSignal }): string {
  if (signal.aborted) {
    return "build cancelled";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "build failed";
}

/** Cooked-mode pause so the build log stays on screen. Ctrl-C resolves without waiting. */
export async function waitForReturn(signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return;
  }

  process.stdout.write("\nPress enter to return to the list.\n");
  const readline = createInterface({ input: process.stdin, output: process.stdout });

  await new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      signal.removeEventListener("abort", finish);
      readline.close();
      resolve();
    };

    readline.once("line", finish);
    signal.addEventListener("abort", finish);
  });
}
