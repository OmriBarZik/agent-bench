import process from "node:process";
import { restoreTerminalTitle, saveTerminalTitle, setTerminalTitle } from "../terminal/terminal-title";
import { tabTitle } from "../terminal/title-text";
import type { TuiHost, TuiSize, TuiTab } from "./open-tui.types";
import { tabBar, tabStep } from "./tab-bar";

const ENTER_SCREEN = "\x1b[?1049h\x1b[?25l";
const LEAVE_SCREEN = "\x1b[?25h\x1b[?1049l";
const TAB_BAR_HEIGHT = 1;

/**
 * Full-screen TUI with a tab bar on top. Tab and shift-tab switch tabs; every other key goes to the active screen.
 * A lone esc quits unless the screen uses it, and arrow keys (which start with the same byte) do not.
 * Resolves with what a screen passed to `finish`, or null when the user quit.
 * Restores the terminal (cooked mode, paused stdin, main screen) before resolving.
 */
export async function openTui<Result>({
  tabs,
  initialTab,
}: {
  tabs: (host: TuiHost<Result>) => TuiTab[];
  initialTab: number;
}): Promise<Result | null> {
  if (!process.stdin.isTTY) {
    throw new Error("the TUI needs a terminal");
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  let detach = () => {};

  try {
    process.stdout.write(ENTER_SCREEN);
    saveTerminalTitle();

    return await runTui({
      tabs,
      initialTab,
      onDetach: (detachListeners) => {
        detach = detachListeners;
      },
    });
  } finally {
    detach();
    process.stdin.setRawMode(false);
    // resume() keeps the event loop alive and would leave stdin in flowing mode for the discard prompt.
    process.stdin.pause();
    process.stdout.write(LEAVE_SCREEN);
    restoreTerminalTitle();
  }
}

function runTui<Result>({
  tabs,
  initialTab,
  onDetach,
}: {
  tabs: (host: TuiHost<Result>) => TuiTab[];
  initialTab: number;
  onDetach: (detach: () => void) => void;
}): Promise<Result | null> {
  return new Promise((resolve) => {
    let active = initialTab;
    let settled = false;
    let escapeTimer: ReturnType<typeof setTimeout> | null = null;

    const size = (): TuiSize => ({
      rows: Math.max((process.stdout.rows ?? 24) - TAB_BAR_HEIGHT, 1),
      columns: process.stdout.columns ?? 80,
    });

    const clearEscape = () => {
      if (escapeTimer) {
        clearTimeout(escapeTimer);
        escapeTimer = null;
      }
    };

    const finish = (result: Result | null) => {
      if (settled) {
        return;
      }

      settled = true;
      clearEscape();
      detach();
      resolve(result);
    };

    const host: TuiHost<Result> = { repaint: () => paint(), size, isClosed: () => settled, finish };
    const tabList = tabs(host);
    const current = () => tabList[active].screen;

    const paint = () => {
      if (settled) {
        return;
      }

      const bar = tabBar({ labels: tabList.map((tab) => tab.label), active, columns: size().columns });
      // Set on every paint, so it names the tab again after a build or a tab switch changed it.
      setTerminalTitle(tabTitle(tabList[active].label));
      process.stdout.write(`\x1b[H${bar}\r\n${current().render(size())}\x1b[J`);
    };

    const onData = (input: string) => {
      if (current().isBusy()) {
        return;
      }

      clearEscape();

      if (input === "\x1b") {
        if (current().onEscape()) {
          paint();

          return;
        }

        escapeTimer = setTimeout(() => finish(null), 50);

        return;
      }

      for (const key of keyParts(input)) {
        const step = tabStep(key);

        if (step !== 0) {
          active = (active + step + tabList.length) % tabList.length;
          continue;
        }

        current().onKey(key);

        // The screen closed the TUI or handed the terminal to a build or browser, so it must not be painted over.
        if (settled || current().isBusy()) {
          return;
        }
      }

      paint();
    };

    const onResize = () => {
      if (settled || current().isBusy()) {
        return;
      }

      current().onResize();
      paint();
    };

    const onSigint = () => {
      if (current().onInterrupt()) {
        return;
      }

      finish(null);
    };

    const detach = () => {
      process.stdin.off("data", onData);
      process.stdout.off("resize", onResize);
      process.off("SIGINT", onSigint);
    };

    onDetach(detach);
    process.stdin.on("data", onData);
    process.stdout.on("resize", onResize);
    process.on("SIGINT", onSigint);
    paint();
  });
}

/** Escape sequences arrive whole; anything else is typed text, one character at a time. */
function keyParts(input: string): string[] {
  if (input.startsWith("\x1b")) {
    return [input];
  }

  return [...input];
}
