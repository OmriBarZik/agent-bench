import process from "node:process";

const SAVE_TITLE = "\x1b[22;0t";
const RESTORE_TITLE = "\x1b[23;0t";
// C0 and C1 control characters, which would end the title sequence early or reach the terminal as commands.
const CONTROL_CHARACTERS = /[\x00-\x1f\x7f-\x9f]/g;
const savedProcessTitles: string[] = [];

/** The title with control characters replaced by spaces, safe for the terminal sequence and the process name. */
function plainTitle(title: string): string {
  return title.replace(CONTROL_CHARACTERS, " ");
}

/** The OSC 0 sequence that sets the tab and window title to `title`, with control characters replaced by spaces. */
export function titleSequence(title: string): string {
  return `\x1b]0;${plainTitle(title)}\x07`;
}

/**
 * Sets the terminal tab and window title, and names the process the same way.
 * The terminal write is skipped when stdout is not a terminal; the process name still changes.
 */
export function setTerminalTitle(title: string) {
  process.title = plainTitle(title);

  if (!process.stdout.isTTY) {
    return;
  }

  process.stdout.write(titleSequence(title));
}

/** Pushes the current title onto the terminal's title stack (xterm, iTerm2) and remembers the process name. */
export function saveTerminalTitle() {
  savedProcessTitles.push(process.title);

  if (!process.stdout.isTTY) {
    return;
  }

  process.stdout.write(SAVE_TITLE);
}

/**
 * Pops the title saved by `saveTerminalTitle` and restores the process name from that save.
 * It clears the terminal title first, so a terminal without a title stack falls back to its default
 * instead of keeping the last status.
 */
export function restoreTerminalTitle() {
  const savedProcessTitle = savedProcessTitles.pop();

  if (savedProcessTitle !== undefined) {
    process.title = savedProcessTitle;
  }

  if (!process.stdout.isTTY) {
    return;
  }

  process.stdout.write(`${titleSequence("")}${RESTORE_TITLE}`);
}
