import { appendFileSync } from "node:fs";
import { RSYNC_SSH } from "../../builder/ssh";
import type { CapturedStep, StepCommand } from "./captured-step.types";

/**
 * Runs one command of a build and appends everything it prints to the build log.
 * Output never reaches this process's stdout, which is the MCP channel. Aborting kills the command.
 */
export async function runCaptured({ command, cwd, stdin, logPath, signal }: StepCommand): Promise<CapturedStep> {
  appendFileSync(logPath, `\n$ ${command.join(" ")}\n`);
  const subprocess = Bun.spawn(command, {
    cwd,
    stdin: stdin == null ? "ignore" : "pipe",
    stdout: "pipe",
    stderr: "pipe",
    signal,
    // A password prompt cannot be answered here, so SSH must fail instead of waiting.
    env: { ...process.env, GIT_SSH_COMMAND: RSYNC_SSH },
  });

  if (stdin != null && typeof subprocess.stdin !== "number" && subprocess.stdin != null) {
    subprocess.stdin.write(stdin);
    await subprocess.stdin.end();
  }

  const chunks: string[] = [];
  const [exitCode] = await Promise.all([
    subprocess.exited,
    collect({ stream: subprocess.stdout, chunks, logPath }),
    collect({ stream: subprocess.stderr, chunks, logPath }),
  ]);

  return { exitCode, output: chunks.join("") };
}

async function collect({
  stream,
  chunks,
  logPath,
}: {
  stream: ReadableStream<Uint8Array>;
  chunks: string[];
  logPath: string;
}) {
  const decoder = new TextDecoder();

  for await (const chunk of stream) {
    const text = decoder.decode(chunk, { stream: true });
    chunks.push(text);
    appendFileSync(logPath, text);
  }
}
