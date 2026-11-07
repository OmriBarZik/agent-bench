/** One task or config the picker can check, with the text shown next to its box. */
export type PickerItem = {
  id: string;
  /** Extra text after the id, such as a task title or a config's model and description. */
  detail: string;
};

/** The tasks and configs the picker offers, in file order. */
export type PickerChoices = {
  tasks: PickerItem[];
  configs: PickerItem[];
};

/** What a picker row edits. `task` and `config` rows are checkboxes; the rest are settings. */
export type PickerRowKind = "task" | "config" | "repeats" | "timeoutMin" | "buildTimeoutMin" | "sync" | "autoReview";

/** One row the cursor can stop on. `index` is the task or config position, and 0 for settings. */
export type PickerRow = {
  kind: PickerRowKind;
  index: number;
};

/** Starting values for the picker, usually from the command-line flags. Absent ids mean every one is checked. */
export type PickerDefaults = {
  taskIds?: string[];
  configIds?: string[];
  repeats: number;
  timeoutMin: number;
  buildTimeoutMin: number;
  sync: boolean;
  /** Attach chrome-validate so the agent builds its change and checks it in Chromium. */
  autoReview: boolean;
  /** Index into `pickerRows` to start on. Omitted means the first row. */
  cursor?: number;
};

/** Everything the picker has chosen so far, plus where the cursor is. */
export type PickerState = {
  /** Whether each task in `PickerChoices.tasks` is checked. */
  tasks: boolean[];
  /** Whether each config in `PickerChoices.configs` is checked. */
  configs: boolean[];
  repeats: number;
  timeoutMin: number;
  buildTimeoutMin: number;
  sync: boolean;
  autoReview: boolean;
  /** Index into `pickerRows(choices)`. */
  cursor: number;
  /** True once a digit was typed on the current number row, so the next digit appends instead of replacing. */
  editing: boolean;
  notice: string;
};

/** What the picker should do after one keypress. */
export type PickerAction = "stay" | "start" | "quit";

/** What one keypress did to the picker. */
export type PickerOutcome = {
  state: PickerState;
  action: PickerAction;
};

/** The matrix the picker confirmed. */
export type PickerResult = {
  taskIds: string[];
  configIds: string[];
  repeats: number;
  timeoutMin: number;
  buildTimeoutMin: number;
  sync: boolean;
  autoReview: boolean;
};

/** Whether Enter on the Start tab began a matrix job. */
export type PickerStartOutcome = {
  ok: boolean;
  notice: string;
};

/** What the Start tab passes when Enter starts a matrix. */
export type PickerStartRequest = {
  picked: PickerResult;
  /** Wipe uncommitted Chromium changes for this start. */
  force?: boolean;
};
