import type { BuildStatus } from "../../db/db.types";
import type { LogCursor } from "./log-cursor.types";

/** Which build's log is on screen, and how far the user has scrolled up from the tail. */
export type LogView = {
  /** The builds row being followed. Null until the first one. */
  buildId: number | null;
  cursor: LogCursor;
  /** Lines of the tail hidden below the window. Zero follows the newest line. */
  above: number;
};

/** Whether the runner should take the terminal for this build. */
export type LogScreenRequest = {
  buildId: number | null;
  /** The build the user hid with esc. A newer build still appears. */
  dismissedBuildId: number | null;
  /** The build the screen is already showing, so a finished log stays up. */
  shownBuildId: number | null;
  /** Null when there is no build. `building` shows the screen even after an older one was hidden. */
  status: BuildStatus | null;
};
