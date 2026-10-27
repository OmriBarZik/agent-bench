import process from "node:process";

/**
 * Turns off modes a crashed build progress can leave on.
 * Synchronized output is first, so the terminal displays the rest of the sequence.
 */
export const RELEASE_PROGRESS = [
  "\x1b[?2026l",
  "\x1b[0m",
  "\x1b[?25h",
  "\x1b[?1l\x1b>",
  "\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l",
  "\x1b[?2004l",
].join("");

/** Clears a crashed build progress, then shows the list. */
export const RESTORE_LIST = `${RELEASE_PROGRESS}\x1b[?1049l\x1b[?1049h\x1b[?25l`;

/** Takes the keyboard back after a build log. Readline pauses stdin when that log is dismissed. */
export function resumeList(): void {
  process.stdin.setEncoding("utf8");
  process.stdin.resume();

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdout.write(RESTORE_LIST);
}
