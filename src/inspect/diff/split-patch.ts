import type { FileDiff } from "./run-diff.types";

/** Lines kept per file, so a generated or vendored file cannot fill memory. */
export const MAX_FILE_LINES = 5000;

const HEADER = /^diff --git a\/(.*) b\/(.*)$/;

/**
 * Splits `git diff` output into one entry per file. Counts added and removed lines,
 * reads the status from git's extended headers, and expands tabs so every line has a fixed width.
 */
export function splitPatch(patch: string): FileDiff[] {
  const files: FileDiff[] = [];
  let current: FileDiff | null = null;
  let inHunk = false;

  for (const raw of patch.split("\n")) {
    const line = raw.replace(/\t/g, "    ");
    const header = HEADER.exec(line);

    if (header) {
      current = { path: header[2] ?? "", status: "M", added: 0, removed: 0, lines: [line] };
      files.push(current);
      inHunk = false;

      continue;
    }

    // `--submodule=diff` announces each submodule with this line. Hunk lines never start with a letter.
    if (!current || line.startsWith("Submodule ")) {
      continue;
    }

    if (line.startsWith("@@")) {
      inHunk = true;
    } else if (inHunk) {
      countLine({ file: current, line });
    } else {
      readExtendedHeader({ file: current, line });
    }

    pushLine({ file: current, line });
  }

  for (const file of files) {
    trimTrailingBlank(file);
  }

  return files;
}

function countLine({ file, line }: { file: FileDiff; line: string }) {
  if (line.startsWith("+")) {
    file.added += 1;
  }

  if (line.startsWith("-")) {
    file.removed += 1;
  }
}

function readExtendedHeader({ file, line }: { file: FileDiff; line: string }) {
  if (line.startsWith("new file mode")) {
    file.status = "A";
  }

  if (line.startsWith("deleted file mode")) {
    file.status = "D";
  }

  if (line.startsWith("rename from ")) {
    file.status = "R";
    file.previousPath = line.slice("rename from ".length);
  }

  if (line.startsWith("copy from ")) {
    file.status = "C";
    file.previousPath = line.slice("copy from ".length);
  }

  if (line.startsWith("Binary files ")) {
    file.status = file.status === "M" ? "B" : file.status;
  }
}

function pushLine({ file, line }: { file: FileDiff; line: string }) {
  if (file.lines.length < MAX_FILE_LINES) {
    file.lines.push(line);

    return;
  }

  if (file.lines.length === MAX_FILE_LINES) {
    file.lines.push(`… cut at ${MAX_FILE_LINES} lines`);
  }
}

function trimTrailingBlank(file: FileDiff) {
  while (file.lines.length > 1 && file.lines.at(-1) === "") {
    file.lines.pop();
  }
}
