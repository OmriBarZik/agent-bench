import { colorLine, fit } from "../inspect/render/terminal-text";
import type { TuiScreen } from "../tui/open-tui.types";
import type { ChromiumJobKind, ChromiumJobStatus } from "./jobs/chromium-job.types";
import type { QuitGuard } from "./quit-guard.types";

const JOB_WORDS: Record<ChromiumJobKind, string> = {
  matrix: "benchmark run",
  build: "build",
  checkout: "checkout",
  "clear-apps": "Chromium.app delete",
};

/** The question on the last line while the guard waits for an answer. */
export function quitQuestion(kind: ChromiumJobKind): string {
  return `A ${JOB_WORDS[kind]} is running. Quit and stop it?   y quit   n or esc stay`;
}

/**
 * Esc, and a screen's own quit key, quit at once when no job is running. While one runs, the first press
 * shows a question on the last line: `y` quits (which stops the job), and any other key or esc keeps the TUI open.
 * The question is shared by every wrapped screen, so it follows a tab switch, and it goes away when the job ends.
 */
export function createQuitGuard({
  jobStatus,
  quit,
}: {
  jobStatus: () => ChromiumJobStatus;
  quit: () => void;
}): QuitGuard {
  let asking = false;

  const runningKind = (): ChromiumJobKind | null => {
    const kind = jobStatus().kind;

    return kind === "idle" ? null : kind;
  };

  const requestQuit = () => {
    if (runningKind() === null) {
      quit();

      return;
    }

    asking = true;
  };

  const wrap = (screen: TuiScreen): TuiScreen => ({
    ...screen,
    render: (size) => {
      const body = screen.render(size);
      const kind = runningKind();

      if (kind === null) {
        asking = false;
      }

      if (!asking || kind === null) {
        return body;
      }

      const lines = body.split("\r\n").slice(0, Math.max(size.rows - 1, 0));

      while (lines.length < size.rows - 1) {
        lines.push(colorLine({ text: "", kind: "plain" }));
      }

      lines.push(colorLine({ text: fit({ text: quitQuestion(kind), width: size.columns }), kind: "alert" }));

      return lines.join("\r\n");
    },
    onKey: (key) => {
      if (!asking) {
        screen.onKey(key);

        return;
      }

      asking = false;

      if (key === "y" || key === "Y") {
        quit();
      }
    },
    onEscape: () => {
      if (asking) {
        asking = false;

        return true;
      }

      if (screen.onEscape()) {
        return true;
      }

      if (runningKind() === null) {
        return false;
      }

      asking = true;

      return true;
    },
  });

  return { requestQuit, wrap };
}
