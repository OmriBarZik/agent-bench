import { createInterface } from "node:readline/promises";
import type { Readable, Writable } from "node:stream";
import { CHROMIUM_SRC } from "../../paths";

const STATUS_PREVIEW_LINES = 20;

/**
 * Asks on the terminal whether to delete uncommitted changes in the Chromium checkout.
 * Returns false unless the answer is yes. A non-terminal stdin, or an aborted `signal`, also returns false.
 */
export async function confirmDiscardUncommittedChanges({
  signal,
  status,
  input = process.stdin,
  output = process.stdout,
}: {
  signal: AbortSignal;
  status: string;
  input?: Readable;
  output?: Writable;
}): Promise<boolean> {
  if (!isInteractive(input) || signal.aborted) {
    return false;
  }

  const prompt = `${CHROMIUM_SRC} has uncommitted changes:\n\n${previewStatus(status)}\n\nDelete them and continue? [y/N] `;
  const readline = createInterface({ input, output });

  try {
    const answer = await readline.question(prompt, { signal });

    return answerDiscardsChanges(answer);
  } catch (error) {
    // Ctrl+C aborts the question. The caller stops the benchmark instead of treating that as a refusal.
    if (signal.aborted || isAbortError(error)) {
      return false;
    }

    throw error;
  } finally {
    readline.close();
  }
}

function answerDiscardsChanges(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();

  return normalized === "y" || normalized === "yes";
}

function previewStatus(status: string): string {
  const lines = status.split("\n").filter((line) => line !== "");
  const preview = lines.slice(0, STATUS_PREVIEW_LINES);

  if (lines.length > STATUS_PREVIEW_LINES) {
    preview.push(`... and ${lines.length - STATUS_PREVIEW_LINES} more`);
  }

  return preview.join("\n");
}

function isInteractive(input: Readable): boolean {
  if (!("isTTY" in input)) {
    return false;
  }

  return input.isTTY === true;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
