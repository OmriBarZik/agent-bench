import process from "node:process";
import { openTranscript } from "./open-transcript";
import { frameLayout, renderFrame } from "./render-frame";
import { applyKey, clampSelection, matchingChoices } from "./select-state";
import type { RunChoice, SelectState } from "./select-state.types";

const ENTER_SCREEN = "\x1b[?1049h\x1b[?25l";
const LEAVE_SCREEN = "\x1b[?25h\x1b[?1049l";

/**
 * Full-screen list of runs. Enter opens that run's transcript in the browser and stays here.
 * Right arrow opens the judge session the same way.
 * Tab resolves with the highlighted run so the caller can check its branch out. Esc or ctrl-c resolves with null.
 * A lone escape quits, but arrow keys (which start with the same byte) do not.
 */
export async function selectRun({
  choices,
  chromiumSrc,
}: {
  choices: RunChoice[];
  chromiumSrc: string;
}): Promise<RunChoice | null> {
  if (!process.stdin.isTTY) {
    throw new Error("pass a branch name, or run in a terminal to pick a run");
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  let detach = () => {};

  try {
    process.stdout.write(ENTER_SCREEN);

    return await waitForChoice({
      choices,
      chromiumSrc,
      onDetach: (detachListeners) => {
        detach = detachListeners;
      },
    });
  } finally {
    detach();
    process.stdin.setRawMode(false);
    process.stdout.write(LEAVE_SCREEN);
  }
}

function waitForChoice({
  choices,
  chromiumSrc,
  onDetach,
}: {
  choices: RunChoice[];
  chromiumSrc: string;
  onDetach: (detach: () => void) => void;
}): Promise<RunChoice | null> {
  return new Promise((resolve) => {
    let state: SelectState = { query: "", selected: 0, scroll: 0 };
    let notice = "";
    let settled = false;
    let opening = false;
    let escapeTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (choice: RunChoice | null) => {
      if (settled) {
        return;
      }

      settled = true;

      if (escapeTimer) {
        clearTimeout(escapeTimer);
        escapeTimer = null;
      }

      detach();
      resolve(choice);
    };

    const paint = () => {
      const rows = process.stdout.rows ?? 24;
      const columns = process.stdout.columns ?? 80;
      process.stdout.write(renderFrame({ choices, state, chromiumSrc, notice, rows, columns }));
    };

    const revealTranscript = ({ transcriptPath, label }: { transcriptPath: string; label: string }) => {
      if (opening || settled) {
        return;
      }

      opening = true;
      process.stdin.setRawMode(false);
      process.stdout.write(LEAVE_SCREEN);
      process.stdout.write(`Opening ${label}…\n`);
      void openTranscript(transcriptPath)
        .then(() => {
          notice = `opened the ${label} in the browser`;
        })
        .catch((error: unknown) => {
          notice = error instanceof Error ? error.message : `could not open the ${label}`;
        })
        .finally(() => {
          opening = false;

          if (settled) {
            return;
          }

          process.stdout.write(ENTER_SCREEN);
          process.stdin.setRawMode(true);
          paint();
        });
    };

    const openChosen = (action: "transcript" | "judge"): boolean => {
      const chosen = matchingChoices({ choices, query: state.query })[state.selected];
      const judge = action === "judge";
      const transcriptPath = judge ? chosen?.judgeTranscriptPath : chosen?.transcriptPath;
      const label = judge ? "judge transcript" : "run transcript";

      if (!chosen || !transcriptPath) {
        notice = chosen ? `no ${label} for this run` : "";

        return false;
      }

      revealTranscript({ transcriptPath, label });

      return true;
    };

    const onData = (input: string) => {
      if (opening) {
        return;
      }

      if (escapeTimer) {
        clearTimeout(escapeTimer);
        escapeTimer = null;
      }

      if (input === "\x1b") {
        escapeTimer = setTimeout(() => finish(null), 50);

        return;
      }

      for (const key of keyParts(input)) {
        const rows = process.stdout.rows ?? 24;
        const pageSize = frameLayout(rows).listHeight;
        const matchCount = matchingChoices({ choices, query: state.query }).length;
        const result = applyKey({ state, key, matchCount, pageSize });
        const nextCount = matchingChoices({ choices, query: result.state.query }).length;
        state = clampSelection({ state: result.state, matchCount: nextCount, pageSize });

        if (result.action === "quit") {
          finish(null);

          return;
        }

        if (result.action === "checkout") {
          const chosen = matchingChoices({ choices, query: state.query })[state.selected];

          if (!chosen || !chosen.present) {
            notice = chosen ? `branch ${chosen.branch} is not in ${chromiumSrc}` : "";
            break;
          }

          finish(chosen);

          return;
        }

        if (result.action === "transcript" || result.action === "judge") {
          const opened = openChosen(result.action);

          if (opened) {
            return;
          }

          break;
        }

        notice = "";
      }

      if (!settled) {
        paint();
      }
    };

    const onResize = () => {
      const pageSize = frameLayout(process.stdout.rows ?? 24).listHeight;
      const matchCount = matchingChoices({ choices, query: state.query }).length;
      state = clampSelection({ state, matchCount, pageSize });
      paint();
    };

    const onSigint = () => {
      if (opening) {
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

/** Arrow keys arrive as one escape sequence; anything else is typed text, one character at a time. */
function keyParts(input: string): string[] {
  if (input.startsWith("\x1b")) {
    return [input];
  }

  return [...input];
}
