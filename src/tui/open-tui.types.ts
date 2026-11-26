/** The terminal area a screen draws in: everything under the tab bar. */
export type TuiSize = {
  rows: number;
  columns: number;
};

/** What a screen may ask of the TUI that hosts it. */
export type TuiControls = {
  /** Draws the tab bar and the active screen again. */
  repaint: () => void;
  /** The rows and columns the active screen gets right now. */
  size: () => TuiSize;
  /** True once the TUI has resolved, so late async work must not touch the terminal. */
  isClosed: () => boolean;
  /** Switch to this tab index (used when a build log starts). */
  setActiveTab: (index: number) => void;
};

/** The controls plus `finish`, which closes the TUI with a result (null means the user quit). */
export type TuiHost<Result> = TuiControls & {
  finish: (result: Result | null) => void;
};

/** One tab's content. The TUI sends it keys only while it is the active tab. */
export type TuiScreen = {
  /** The screen's lines joined with `\r\n`, at most `size.rows` of them. */
  render: (size: TuiSize) => string;
  /** One keypress. Tab and shift-tab never reach a screen: they switch tabs. */
  onKey: (key: string) => void;
  /** A lone esc. True when the screen used it (to close a dialog); false lets the TUI quit. */
  onEscape: () => boolean;
  /** Ctrl+C while raw mode is off (a build is running). True when the screen handled it. */
  onInterrupt: () => boolean;
  onResize: () => void;
  /** True while the screen has handed the terminal to something else, such as a build log. Input is ignored. */
  isBusy: () => boolean;
};

/** A tab in the bar and the screen it shows. */
export type TuiTab = {
  label: string;
  screen: TuiScreen;
};
