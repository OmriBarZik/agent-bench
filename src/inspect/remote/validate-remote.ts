import { sshCommand } from "../../builder/ssh";
import type { BuilderConfig } from "../build/builder-config.types";
import type { RemoteCheck } from "./validate-remote.types";

/** SSH to the host and exit. Proves the Include, the address, and the key. */
export function connectCommand(host: string): string[] {
  return sshCommand({ host, remoteArgs: ["true"] });
}

/** True when the build Mac's checkout is a git work tree. */
export function checkoutReadyCommand({ host, source }: { host: string; source: string }): string[] {
  return sshCommand({ host, remoteArgs: ["git", "-C", source, "rev-parse", "--is-inside-work-tree"] });
}

/** Why a remote check failed. `exitCode` is the SSH status. */
export function remoteFailure({
  check,
  exitCode,
  host,
  source,
}: {
  check: RemoteCheck;
  exitCode: number;
  host: string;
  source: string;
}): string {
  if (check === "connect") {
    return `cannot reach ${host} (${exitCode}). Check configs/builder/remote.yaml and run bun run setup:remote-build`;
  }

  return `${source} on ${host} is not a git checkout (${exitCode})`;
}

/**
 * Confirms the build Mac answers and its checkout is a git work tree.
 * Returns the notice to show when it does not. Throws `build cancelled` when `signal` aborts.
 */
export async function validateRemote({
  config,
  signal,
}: {
  config: BuilderConfig;
  signal: AbortSignal;
}): Promise<string | null> {
  const connect = await runChecked({ command: connectCommand(config.host), signal });

  if (connect.exitCode !== 0) {
    return remoteFailure({ check: "connect", exitCode: connect.exitCode, host: config.host, source: config.source });
  }

  const checkout = await runChecked({
    command: checkoutReadyCommand({ host: config.host, source: config.source }),
    signal,
  });

  if (checkout.exitCode !== 0 || checkout.stdout.trim() !== "true") {
    const exitCode = checkout.exitCode === 0 ? 1 : checkout.exitCode;

    return remoteFailure({ check: "checkout", exitCode, host: config.host, source: config.source });
  }

  return null;
}

async function runChecked({
  command,
  signal,
}: {
  command: string[];
  signal: AbortSignal;
}): Promise<{ exitCode: number; stdout: string }> {
  if (signal.aborted) {
    throw new Error("build cancelled");
  }

  let subprocess: ReturnType<typeof Bun.spawn>;

  try {
    subprocess = Bun.spawn(command, {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "inherit",
      signal,
    });
  } catch (error) {
    if (signal.aborted) {
      throw new Error("build cancelled");
    }

    const message = error instanceof Error ? error.message : "could not start ssh";

    throw new Error(`cannot start ssh: ${message}`);
  }

  const sink = subprocess.stdout;

  if (typeof sink === "number" || sink == null) {
    throw new Error("cannot start ssh: no stdout");
  }

  const stdout = new Response(sink).text();
  const exitCode = await subprocess.exited;
  const output = await stdout;

  if (signal.aborted) {
    throw new Error("build cancelled");
  }

  return { exitCode, stdout: output };
}
