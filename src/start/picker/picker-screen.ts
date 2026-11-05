import type { TuiScreen } from "../../tui/open-tui.types";
import { applyPickerKey, initialPickerState, pickerResult } from "./picker-state";
import type { PickerChoices, PickerDefaults, PickerResult } from "./picker-state.types";
import { renderPicker } from "./render-picker";

/**
 * The Start tab: a checklist of tasks and configs plus repeats, timeout, and sync.
 * Calls `onDone` with the confirmed matrix on enter, or null on q or ctrl-c. Esc is left to the TUI, which quits.
 */
export function createPickerScreen({
  choices,
  defaults,
  onDone,
}: {
  choices: PickerChoices;
  defaults: PickerDefaults;
  onDone: (result: PickerResult | null) => void;
}): TuiScreen {
  let state = initialPickerState({ choices, defaults });
  let scroll = 0;

  return {
    render: ({ rows, columns }) => {
      const painted = renderPicker({ choices, state, scroll, rows, columns });
      scroll = painted.scroll;

      return painted.body;
    },
    onKey: (key) => {
      const outcome = applyPickerKey({ state, choices, key });
      state = outcome.state;

      if (outcome.action === "quit") {
        onDone(null);
      }

      if (outcome.action === "start") {
        onDone(pickerResult({ state, choices }));
      }
    },
    onEscape: () => false,
    onInterrupt: () => false,
    onResize: () => {},
    isBusy: () => false,
  };
}
