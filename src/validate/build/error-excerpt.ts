const MAX_LINES = 150;
const TAIL_LINES = 40;
const PROGRESS = /^\[\d+\/\d+\]/;

/**
 * The part of a failed build's output the agent needs: each ninja `FAILED:` block with the compiler errors under
 * it, without the progress lines. Falls back to the last lines when there is no `FAILED:` block (gn, git, ssh).
 */
export function errorExcerpt(output: string): string {
  const lines = output.split("\n");
  const kept: string[] = [];
  let inFailure = false;

  for (const line of lines) {
    if (line.startsWith("FAILED:")) {
      inFailure = true;
    } else if (PROGRESS.test(line) || line.startsWith("ninja: build stopped")) {
      inFailure = false;
    }

    if (inFailure && !isCommandLine(line)) {
      kept.push(line);
    }
  }

  const chosen = kept.length > 0 ? kept : lines.filter((line) => line.trim() !== "").slice(-TAIL_LINES);

  if (chosen.length <= MAX_LINES) {
    return chosen.join("\n");
  }

  return `${chosen.slice(0, MAX_LINES).join("\n")}\n… ${chosen.length - MAX_LINES} more lines in the build log`;
}

/** The full compiler invocation ninja prints under FAILED: is thousands of characters and tells the agent nothing. */
function isCommandLine(line: string): boolean {
  return line.length > 400 && /(clang\+\+|clang|python3?|ld64|lld)\b/.test(line);
}
