import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { RELEASE_PROGRESS } from "../list/restore-list";
import type { RunStep } from "../remote/remote-build.types";
import type { BuildPresentation } from "./build-session.types";

/** True unless the caller asked not to pause after the build. */
export function shouldWaitForReturn(presentation: BuildPresentation | undefined): boolean {
  return presentation?.waitForReturn !== false;
}

/** Writes a line to the terminal, or appends it to the presentation log when one is set. */
export function buildSay({
  presentation,
  line,
  stream = "stdout",
}: {
  presentation: BuildPresentation | undefined;
  line: string;
  stream?: "stdout" | "stderr";
}): void {
  if (presentation?.logPath) {
    appendFileSync(presentation.logPath, `${line}\n`);

    return;
  }

  if (stream === "stderr") {
    console.error(line);

    return;
  }

  console.log(line);
}

/** Merges the presentation log path onto every runStep call. */
export function stepLog(presentation: BuildPresentation | undefined): { logPath?: string } {
  return presentation?.logPath ? { logPath: presentation.logPath } : {};
}

/** The compile step failed. Checkout, copy, and missing tools stay plain errors. */
export class CompileFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileFailedError";
  }
}

/**
 * Opens one Chromium.app. `--args` is how `open` forwards flags to the app:
 * no keychain prompt, and no Cast device scan.
 */
export function openChromiumCommand(app: string): string[] {
  return ["open", app, "--args", "--use-mock-keychain", "--disable-features=DialMediaRouteProvider"];
}

/** Runs one local command. Ctrl-C rejects with `build cancelled`. */
export async function runStep({ command, signal, label, stdin, cwd, env, logPath }: RunStep): Promise<void> {
  if (signal.aborted) {
    throw new Error("build cancelled");
  }

  if (logPath) {
    appendFileSync(logPath, `\n$ ${command.join(" ")}\n`);
  }

  let subprocess: ReturnType<typeof Bun.spawn>;

  try {
    subprocess = Bun.spawn(command, {
      stdin: stdin == null ? "ignore" : "pipe",
      stdout: logPath ? "pipe" : "inherit",
      stderr: logPath ? "pipe" : "inherit",
      signal,
      cwd,
      // A password prompt cannot be answered here, so SSH must fail instead of waiting.
      env: { ...process.env, GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o ConnectTimeout=10", ...env },
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

  if (logPath) {
    await Promise.all([
      appendStream({ stream: subprocess.stdout ?? null, logPath }),
      appendStream({ stream: subprocess.stderr ?? null, logPath }),
    ]);
  }

  const exitCode = await subprocess.exited;

  if (signal.aborted) {
    throw new Error("build cancelled");
  }

  if (exitCode !== 0) {
    throw stepFailure({ label, exitCode });
  }
}

async function appendStream({
  stream,
  logPath,
}: {
  stream: ReadableStream<Uint8Array> | number | null | undefined;
  logPath: string;
}): Promise<void> {
  if (stream == null || typeof stream === "number") {
    return;
  }

  const decoder = new TextDecoder();

  for await (const chunk of stream) {
    appendFileSync(logPath, decoder.decode(chunk, { stream: true }));
  }
}

/** A non-zero compile is a build failure. Any other step is a plain error. */
export function stepFailure({ label, exitCode }: { label: string; exitCode: number }): Error {
  const message = `${label} failed (${exitCode})`;

  if (label === "build") {
    return new CompileFailedError(message);
  }

  return new Error(message);
}

/** True when this error is the compile step itself, not checkout, copy, or a missing tool. */
export function isCompileFailure(error: unknown): boolean {
  return error instanceof CompileFailedError;
}

/** The run to offer as failed when the compile failed and was not cancelled. */
export function runIdsForCompileFailure({
  error,
  signal,
  runId,
}: {
  error: unknown;
  signal: AbortSignal;
  runId: string;
}): string[] {
  if (signal.aborted || !isCompileFailure(error)) {
    return [];
  }

  return [runId];
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

  process.stdout.write(RELEASE_PROGRESS);
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
