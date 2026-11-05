import process from "node:process";

const SAVE_TITLE = "\x1b[22;0t";
const RESTORE_TITLE = "\x1b[23;0t";
// C0 and C1 control characters, which would end the title sequence early or reach the terminal as commands.
const CONTROL_CHARACTERS = /[\x00-\x1f\x7f-\x9f]/g;

/** The OSC 0 sequence that sets the tab and window title to `title`, with control characters replaced by spaces. */
export function titleSequence(title: string): string {
  return `\x1b]0;${title.replace(CONTROL_CHARACTERS, " ")}\x07`;
}

/** Sets the terminal tab and window title. Does nothing when stdout is not a terminal. */
export function setTerminalTitle(title: string) {
  if (!process.stdout.isTTY) {
    return;
  }

  process.stdout.write(titleSequence(title));
}

/** Pushes the current title onto the terminal's title stack, for terminals that keep one (xterm, iTerm2). */
export function saveTerminalTitle() {
  if (!process.stdout.isTTY) {
    return;
  }

  process.stdout.write(SAVE_TITLE);
}

/**
 * Pops the title saved by `saveTerminalTitle`. It clears the title first, so a terminal without a title stack
 * falls back to its default title instead of keeping the last status.
 */
export function restoreTerminalTitle() {
  if (!process.stdout.isTTY) {
    return;
  }

  process.stdout.write(`${titleSequence("")}${RESTORE_TITLE}`);
}
