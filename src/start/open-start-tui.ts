import { loadChoices } from "../inspect/list/load-choices";
import { createRunsScreen } from "../inspect/list/runs-screen";
import { CHROMIUM_SRC } from "../paths";
import type { Selection } from "../runner/bench-config/bench-config.types";
import { openTui } from "../tui/open-tui";
import type { TuiHost, TuiTab } from "../tui/open-tui.types";
import type { StartTab, StartTuiPick } from "./open-start-tui.types";
import { createPickerScreen } from "./picker/picker-screen";
import type { PickerChoices, PickerDefaults } from "./picker/picker-state.types";

const TAB_ORDER: StartTab[] = ["start", "runs"];

/**
 * Opens the `bun run start` TUI: a Start tab (pick tasks × configs × repeats) and a Runs tab
 * (the runs in the database: transcripts, builds, judge decisions, deletes, checkout).
 * Tab and shift-tab switch between them. Resolves with null when the user quits.
 */
export async function openStartTui({
  selection,
  defaults,
  initialTab,
  force,
}: {
  selection: Selection;
  defaults: PickerDefaults;
  initialTab: StartTab;
  force: boolean;
}): Promise<StartTuiPick | null> {
  const runChoices = await loadChoices();
  const pickerChoices = toPickerChoices(selection);

  return openTui<StartTuiPick>({
    initialTab: TAB_ORDER.indexOf(initialTab),
    tabs: (host: TuiHost<StartTuiPick>): TuiTab[] => [
      {
        label: "Start",
        screen: createPickerScreen({
          choices: pickerChoices,
          defaults,
          onDone: (picked) => host.finish(picked ? { kind: "start", picked } : null),
        }),
      },
      {
        label: "Runs",
        screen: createRunsScreen({
          choices: runChoices,
          chromiumSrc: CHROMIUM_SRC,
          force,
          controls: host,
          onDone: (choice) => host.finish(choice ? { kind: "checkout", choice } : null),
        }),
      },
    ],
  });
}

function toPickerChoices(selection: Selection): PickerChoices {
  return {
    tasks: selection.tasks.map((task) => ({
      id: task.taskId,
      detail: [task.title, task.difficulty ? `(${task.difficulty})` : ""].filter(Boolean).join(" "),
    })),
    configs: selection.configs.map((config) => ({
      id: config.configId,
      detail: [config.model, config.description].filter(Boolean).join("  "),
    })),
  };
}
