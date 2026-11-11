import type { TuiScreen } from "../tui/open-tui.types";

/** Asks before the TUI quits while a Chromium job is running, because quitting stops that job. */
export type QuitGuard = {
  /** Quits when nothing is running. Otherwise shows the question on the next paint. */
  requestQuit: () => void;
  /** The same screen, with esc going through the question and `y` / `n` answering it. */
  wrap: (screen: TuiScreen) => TuiScreen;
};
