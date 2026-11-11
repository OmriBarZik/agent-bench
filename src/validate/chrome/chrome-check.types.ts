import type { ContentPart } from "../mcp/protocol.types";

/** What Input.dispatchKeyEvent needs for one key. */
export type KeyDefinition = {
  key: string;
  code: string;
  keyCode: number;
  /** Set for keys that type a character. */
  text?: string;
};

/** Press a key, holding it for `hold_ms` (default 50) before releasing. */
export type KeyAction = { key: string; hold_ms?: number };

/** A point in the page, in CSS pixels from the top left of the viewport. */
export type PagePoint = { x: number; y: number };

/** Click the left mouse button at a point, as a user would to focus the game. */
export type ClickAction = { click: PagePoint };

/** Pause between actions. */
export type WaitAction = { wait_ms: number };

/** Evaluate JavaScript in the page. An expression, or statements that `return` a value. Promises are awaited. */
export type EvalAction = { eval: string };

/** Capture the viewport as a PNG. */
export type ScreenshotAction = { screenshot: true };

/** Read the game state the page reports through `benchGameState` (the dino harness does). */
export type StateAction = { state: true };

/** One step of a check, run in order after the page loads. */
export type ChromeAction = KeyAction | ClickAction | WaitAction | EvalAction | StateAction | ScreenshotAction;

/** The run_chrome request. */
export type ChromeCheck = {
  /** Chromium.app to start. */
  appPath: string;
  url: string;
  /** Extra Chromium switches, such as `--enable-features=Foo`. */
  flags: string[];
  actions: ChromeAction[];
  width: number;
  height: number;
};

/** A started headless Chromium and its first page. */
export type LaunchedChrome = {
  /** WebSocket URL of the page target. */
  pageUrl: string;
  /** Kills Chromium and removes its temporary profile. */
  stop: () => Promise<void>;
  /** The last lines Chromium printed to stderr, for a crash report. */
  stderrTail: () => string;
};

/** One entry of Chromium's /json/list. */
export type DevToolsTarget = {
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
};

/** What a check returns to the agent: text and screenshots in the order they happened. */
export type ChromeReport = {
  parts: ContentPart[];
};
