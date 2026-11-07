import type { Selection } from "../runner/bench-config/bench-config.types";
import type { PickerDefaults, PickerResult } from "./picker/picker-state.types";

/** The tab the TUI opens on. */
export type StartTab = "start" | "runs" | "setups" | "build";

/** Options for the long-lived start TUI. Jobs run inside it; it only resolves on quit. */
export type OpenStartTuiOptions = {
  selection: Selection;
  defaults: PickerDefaults;
  initialTab: StartTab;
  force: boolean;
  judgeModel: string;
  /** Last Start-tab selection. Omitted when flags already name the matrix, so that file is left alone. */
  savedPath?: string;
  /** Printed into the Start-tab notice when a matrix begins. */
  equivalentCommand: (picked: PickerResult) => string;
};
