/**
 * Turns a Bun ShellError into a one-line message that includes the command label and stderr.
 * Quiet `$` failures otherwise show only "Failed with exit code N".
 */
export function shellErrorMessage({ label, error }: { label: string; error: unknown }): string {
  if (isShellError(error)) {
    const detail = firstLine(bufferText(error.stderr)) || firstLine(bufferText(error.stdout));

    if (detail) {
      return `${label} failed (${error.exitCode}): ${detail}`;
    }

    return `${label} failed (${error.exitCode})`;
  }

  if (error instanceof Error) {
    return `${label} failed: ${error.message}`;
  }

  return `${label} failed: ${String(error)}`;
}

/** Runs a Bun shell promise and rethrows with {@link shellErrorMessage} on failure. */
export async function labeledShell({ label, run }: { label: string; run: () => PromiseLike<unknown> }): Promise<void> {
  try {
    await run();
  } catch (error) {
    throw new Error(shellErrorMessage({ label, error }));
  }
}

type ShellFailure = {
  exitCode: number;
  stderr?: unknown;
  stdout?: unknown;
};

function isShellError(error: unknown): error is ShellFailure {
  return (
    typeof error === "object" &&
    error !== null &&
    "exitCode" in error &&
    typeof (error as { exitCode: unknown }).exitCode === "number"
  );
}

function bufferText(value: unknown): string {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }

  if (typeof value === "object" && value !== null && "toString" in value) {
    return String(value);
  }

  return "";
}

function firstLine(text: string): string {
  return (
    text
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line !== "") ?? ""
  );
}
