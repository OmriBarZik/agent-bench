import process from "node:process";
import type { LogTerminal } from "./log-terminal.types";

const ESCAPE_MS = 50;
const ENTER_SCREEN = "\x1b[?1049h\x1b[?25l";
const LEAVE_SCREEN = "\x1b[?25h\x1b[?1049l";

/**
 * Takes the terminal for a log stream and gives it back.
 * A lone esc is reported after a short wait, so an arrow key (which starts with the same byte) is not one.
 * Ctrl-C hides the screen, then signals the process so the benchmark's own handler stops the run.
 */
export function openLogTerminal({
  onKey,
  onResize,
}: {
  onKey: (key: string) => void;
  onResize: () => void;
}): LogTerminal {
  let active = false;
  let painted = "";
  let escapeTimer: ReturnType<typeof setTimeout> | null = null;

  const clearEscape = () => {
    if (escapeTimer) {
      clearTimeout(escapeTimer);
      escapeTimer = null;
    }
  };

  const hide = () => {
    if (!active) {
      return;
    }

    active = false;
    clearEscape();
    process.stdin.off("data", onData);
    process.stdout.off("resize", onResizePaint);
    process.removeListener("SIGINT", hide);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    process.stdin.pause();
    process.stdout.write(LEAVE_SCREEN);
    painted = "";
  };

  const show = () => {
    if (active) {
      return;
    }

    active = true;
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    process.stdin.setRawMode(true);
    process.stdin.on("data", onData);
    process.stdout.on("resize", onResizePaint);
    // Runs before the benchmark's handler, so its "stopping" line lands on the main screen.
    process.prependListener("SIGINT", hide);
    process.stdout.write(ENTER_SCREEN);
    painted = "";
  };

  const onResizePaint = () => {
    painted = "";
    onResize();
  };

  const onData = (input: string) => {
    if (input.includes("\x03")) {
      clearEscape();
      hide();
      process.kill(process.pid, "SIGINT");

      return;
    }

    if (input === "\x1b") {
      clearEscape();
      escapeTimer = setTimeout(() => {
        escapeTimer = null;
        onKey("\x1b");
      }, ESCAPE_MS);

      return;
    }

    clearEscape();
    const keys = input.startsWith("\x1b") ? [input] : [...input];

    for (const key of keys) {
      onKey(key);
    }
  };

  return {
    show,
    hide,
    paint(frame) {
      if (frame === painted) {
        return;
      }

      painted = frame;
      process.stdout.write(`\x1b[H${frame}\x1b[J`);
    },
  };
}
