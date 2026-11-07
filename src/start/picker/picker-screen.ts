import type { TuiScreen } from "../../tui/open-tui.types";
import { applyPickerKey, initialPickerState, pickerResult } from "./picker-state";
import type { PickerChoices, PickerDefaults, PickerResult, PickerState } from "./picker-state.types";
import { renderPicker } from "./render-picker";
import { defaultsFromSaved, readSavedPicker, savedFromState, writeSavedPicker } from "./saved/saved-picker";

/**
 * The Start tab: a checklist of tasks and configs plus repeats, the two timeouts, sync, and auto review.
 * Calls `onDone` with the confirmed matrix on enter, or null on q or ctrl-c. Esc is left to the TUI, which quits.
 * When `savedPath` is set, each key writes the selection there so the next open continues from it.
 */
export function createPickerScreen({
  choices,
  defaults,
  savedPath,
  onDone,
}: {
  choices: PickerChoices;
  defaults: PickerDefaults;
  /** Where the last selection is stored. Omitted when this open should neither read nor write it. */
  savedPath?: string;
  onDone: (result: PickerResult | null) => void;
}): TuiScreen {
  const restored = savedPath ? readSavedPicker(savedPath) : null;
  let state = initialPickerState({
    choices,
    defaults: restored ? defaultsFromSaved({ saved: restored, choices }) : defaults,
  });
  let scroll = 0;

  const persist = (next: PickerState): PickerState => {
    if (!savedPath) {
      return next;
    }

    try {
      writeSavedPicker({ path: savedPath, saved: savedFromState({ state: next, choices }) });
    } catch {
      // The selection still works this session. The notice says it will not be there next time.
      if (!next.notice) {
        return { ...next, notice: "could not save this selection" };
      }
    }

    return next;
  };

  return {
    render: ({ rows, columns }) => {
      const painted = renderPicker({ choices, state, scroll, rows, columns });
      scroll = painted.scroll;

      return painted.body;
    },
    onKey: (key) => {
      const outcome = applyPickerKey({ state, choices, defaults, key });
      state = persist(outcome.state);

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
