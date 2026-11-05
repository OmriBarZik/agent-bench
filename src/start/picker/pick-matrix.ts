import process from "node:process";
import { applyPickerKey, initialPickerState, pickerResult } from "./picker-state";
import type { PickerChoices, PickerDefaults, PickerResult, PickerState } from "./picker-state.types";
import { renderPicker } from "./render-picker";

const ENTER_SCREEN = "\x1b[?1049h\x1b[?25l";
const LEAVE_SCREEN = "\x1b[?25h\x1b[?1049l";

/**
 * Full-screen checklist of tasks and configs plus repeats, timeout, and sync.
 * Resolves with the confirmed matrix on enter, or null on esc, q, or ctrl-c.
 * Restores the terminal (cooked mode, paused stdin, main screen) before resolving.
 */
export async function pickMatrix({
  choices,
  defaults,
}: {
  choices: PickerChoices;
  defaults: PickerDefaults;
}): Promise<PickerResult | null> {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  let detach = () => {};

  try {
    process.stdout.write(ENTER_SCREEN);

    return await waitForPick({
      choices,
      state: initialPickerState({ choices, defaults }),
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
  }
}

function waitForPick({
  choices,
  state: initialState,
  onDetach,
}: {
  choices: PickerChoices;
  state: PickerState;
  onDetach: (detach: () => void) => void;
}): Promise<PickerResult | null> {
  return new Promise((resolve) => {
    let state = initialState;
    let scroll = 0;
    let escapeTimer: ReturnType<typeof setTimeout> | null = null;

    const paint = () => {
      const painted = renderPicker({
        choices,
        state,
        scroll,
        rows: process.stdout.rows ?? 24,
        columns: process.stdout.columns ?? 80,
      });
      scroll = painted.scroll;
      process.stdout.write(painted.frame);
    };

    const finish = (result: PickerResult | null) => {
      if (escapeTimer) {
        clearTimeout(escapeTimer);
        escapeTimer = null;
      }

      detach();
      resolve(result);
    };

    const onData = (input: string) => {
      if (escapeTimer) {
        clearTimeout(escapeTimer);
        escapeTimer = null;
      }

      // A lone escape quits, but arrow keys start with the same byte, so wait briefly for the rest.
      if (input === "\x1b") {
        escapeTimer = setTimeout(() => finish(null), 50);

        return;
      }

      for (const key of keyParts(input)) {
        const outcome = applyPickerKey({ state, choices, key });
        state = outcome.state;

        if (outcome.action === "quit") {
          finish(null);

          return;
        }

        if (outcome.action === "start") {
          finish(pickerResult({ state, choices }));

          return;
        }
      }

      paint();
    };

    const detach = () => {
      process.stdin.off("data", onData);
      process.stdout.off("resize", paint);
    };

    onDetach(detach);
    process.stdin.on("data", onData);
    process.stdout.on("resize", paint);
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
