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

/** Shows the cursor and leaves the list. That returns to the original screen. */
export const RETURN_TO_ORIGINAL = "\x1b[?25h\x1b[?1049l";

/**
 * Clears the visible screen. Margins are reset first, so a progress display cannot keep the clear
 * on the bottom line. Scrollback is left alone: the build log lives there when we return to the list.
 */
const CLEAR_VISIBLE = "\x1b[0m\x1b[r\x1b[?6l\x1b[H\x1b[2J";

/** Clears the original screen and its scrollback, so a new build log does not follow an older run. */
export const CLEAR_SCREEN = `${CLEAR_VISIBLE}\x1b[3J`;

/** Asks the terminal to report that it has applied the bytes sent before this. */
const READY_QUERY = "\x1b[5n";

/** The reply to `READY_QUERY`. */
const READY = "\x1b[0n";

const READY_WAIT_MS = 200;

/** Clears a crashed build progress, returns to the list, and clears that screen before it is drawn again. */
export const RESTORE_LIST = `${RELEASE_PROGRESS}\x1b[?1049l\x1b[?1049h${CLEAR_VISIBLE}\x1b[?25l`;

/**
 * Leaves the list and clears the original screen.
 * The ready reply comes back only after the switch, so the clear lands on the original screen
 * and is not undone by the terminal restoring what was there before.
 */
export async function presentLogScreen(): Promise<void> {
  await writeTerminal(RETURN_TO_ORIGINAL);
  await waitUntilReady();
  await writeTerminal(CLEAR_SCREEN);
}

/** Takes the keyboard back after a build log. Readline pauses stdin when that log is dismissed. */
export function resumeList(): void {
  process.stdin.setEncoding("utf8");
  process.stdin.resume();

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdout.write(RESTORE_LIST);
}

/** Resolves when the terminal has applied the switch back to the original screen. */
async function waitUntilReady(): Promise<void> {
  const reply = new Promise<void>((resolve) => {
    let pending = "";
    let timer: ReturnType<typeof setTimeout>;

    const finish = () => {
      clearTimeout(timer);
      process.stdin.off("data", onData);
      resolve();
    };

    const onData = (input: string | Buffer) => {
      pending += typeof input === "string" ? input : input.toString("utf8");

      if (pending.includes(READY)) {
        finish();
      }
    };

    timer = setTimeout(finish, READY_WAIT_MS);
    process.stdin.on("data", onData);
  });

  await writeTerminal(READY_QUERY);
  await reply;
}

/** Writes one sequence and resolves once stdout has accepted it. */
function writeTerminal(sequence: string): Promise<void> {
  return new Promise((resolve) => {
    if (process.stdout.write(sequence)) {
      resolve();

      return;
    }

    process.stdout.once("drain", () => resolve());
  });
}
