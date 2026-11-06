import type { PlayedLog } from "./play-log.types";

const COMPLETE_ANSI = /\x1b(?:\[[0-9;?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g;

/**
 * Plays one chunk the way a terminal would. `\r` moves to the start of the line, and a later
 * character overwrites what is there. `\x1b[K` clears from the cursor to the end.
 */
export function playLogText({ text, line, column }: { text: string; line: string; column: number }): PlayedLog {
  const finished: string[] = [];
  let index = 0;

  while (index < text.length) {
    const character = text[index] ?? "";

    if (character === "\x1b") {
      const sequence = controlSequence(text.slice(index));

      if (sequence == null) {
        return { line, column, finished, held: text.slice(index) };
      }

      if (sequence.endsWith("K")) {
        line = sequence.includes("2") ? "" : line.slice(0, column);

        if (sequence.includes("2")) {
          column = 0;
        }
      }

      index += sequence.length;
      continue;
    }

    if (character === "\n") {
      finished.push(line);
      line = "";
      column = 0;
      index += 1;
      continue;
    }

    if (character === "\r") {
      column = 0;
      index += 1;
      continue;
    }

    if (character === "\b") {
      column = Math.max(0, column - 1);
      index += 1;
      continue;
    }

    line = writeAt({ line, column, character });
    column += 1;
    index += 1;
  }

  return { line, column, finished, held: "" };
}

function controlSequence(text: string): string | null {
  const match = COMPLETE_ANSI.exec(text);
  COMPLETE_ANSI.lastIndex = 0;

  if (match == null || match.index !== 0) {
    return null;
  }

  return match[0];
}

function writeAt({ line, column, character }: { line: string; column: number; character: string }): string {
  if (column >= line.length) {
    return `${line}${" ".repeat(column - line.length)}${character}`;
  }

  return `${line.slice(0, column)}${character}${line.slice(column + 1)}`;
}
