import { CHROMIUM_SRC } from "../../paths";
import { uncommittedStatus } from "../../runner/chromium/chromium";
import type { TuiScreen } from "../../tui/open-tui.types";
import type { ChromiumJobController } from "../jobs/chromium-job.types";
import { applyPickerKey, initialPickerState, pickerResult } from "./picker-state";
import type {
  PickerChoices,
  PickerDefaults,
  PickerResult,
  PickerStartOutcome,
  PickerStartRequest,
  PickerState,
} from "./picker-state.types";
import { renderPicker } from "./render-picker";
import { defaultsFromSaved, readSavedPicker, savedFromState, writeSavedPicker } from "./saved/saved-picker";

/**
 * The Start tab: a checklist of tasks and configs plus repeats, the two timeouts, sync, and auto review.
 * Enter starts the matrix as a background job (does not close the TUI). q quits. Esc is left to the TUI.
 * When `savedPath` is set, each key writes the selection there so the next open continues from it.
 */
export function createPickerScreen({
  choices,
  defaults,
  savedPath,
  force,
  jobs,
  onQuit,
  onStart,
}: {
  choices: PickerChoices;
  defaults: PickerDefaults;
  /** Where the last selection is stored. Omitted when this open should neither read nor write it. */
  savedPath?: string;
  force: boolean;
  jobs: ChromiumJobController;
  onQuit: () => void;
  /** Build the plan and start it. */
  onStart: (request: PickerStartRequest) => PickerStartOutcome;
}): TuiScreen {
  const restored = savedPath ? readSavedPicker(savedPath) : null;
  let state = initialPickerState({
    choices,
    defaults: restored ? defaultsFromSaved({ saved: restored, choices }) : defaults,
  });
  let scroll = 0;
  let discardPrompt: { status: string; picked: PickerResult } | null = null;
  let checkingDiscard = false;

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

  const beginMatrix = (picked: PickerResult, startForce: boolean) => {
    const outcome = onStart({ picked, force: startForce });

    if (!outcome.ok) {
      state = { ...state, notice: outcome.notice };

      return;
    }

    const prefix = startForce && !force ? "discarding uncommitted changes · " : "";
    state = { ...state, notice: `${prefix}${outcome.notice}` };
  };

  const requestStart = (picked: PickerResult) => {
    if (force) {
      beginMatrix(picked, true);

      return;
    }

    if (checkingDiscard) {
      return;
    }

    checkingDiscard = true;
    state = { ...state, notice: "checking Chromium checkout…" };
    void uncommittedStatus()
      .then((status) => {
        checkingDiscard = false;

        if (status === "") {
          beginMatrix(picked, false);

          return;
        }

        discardPrompt = { status, picked };
        state = {
          ...state,
          notice: `${CHROMIUM_SRC} has uncommitted changes. y delete and start, n cancel`,
        };
      })
      .catch((error: unknown) => {
        checkingDiscard = false;
        state = {
          ...state,
          notice: error instanceof Error ? error.message : "could not check the checkout",
        };
      });
  };

  return {
    render: ({ rows, columns }) => {
      const job = jobs.status();
      const jobLine = job.kind === "idle" ? job.label : `${job.kind}: ${job.label}`;
      const painted = renderPicker({
        choices,
        state: { ...state, notice: state.notice || jobLine },
        scroll,
        rows,
        columns,
      });
      scroll = painted.scroll;

      return painted.body;
    },
    onKey: (key) => {
      if (discardPrompt) {
        if (key === "y" || key === "Y") {
          const picked = discardPrompt.picked;
          discardPrompt = null;
          beginMatrix(picked, true);

          return;
        }

        if (key === "n" || key === "N") {
          discardPrompt = null;
          state = { ...state, notice: "start cancelled" };

          return;
        }

        return;
      }

      const outcome = applyPickerKey({ state, choices, defaults, key });
      state = persist(outcome.state);

      if (outcome.action === "quit") {
        onQuit();
      }

      if (outcome.action === "start") {
        requestStart(pickerResult({ state, choices }));
      }
    },
    onEscape: () => {
      if (discardPrompt) {
        discardPrompt = null;
        state = { ...state, notice: "start cancelled" };

        return true;
      }

      return false;
    },
    onInterrupt: () => jobs.cancel(),
    onResize: () => {},
    isBusy: () => false,
  };
}
