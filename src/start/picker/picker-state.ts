import { adjust, eraseDigit, toggleRow, toggleSection, typeDigit } from "./picker-edit";
import { isDown, isEnd, isHome, isLeft, isRight, isUp } from "./picker-keys";
import type {
  PickerChoices,
  PickerDefaults,
  PickerOutcome,
  PickerResult,
  PickerRow,
  PickerRowKind,
  PickerState,
} from "./picker-state.types";

/** The rows the cursor moves over: every task, every config, then repeats, timeout, and sync. */
export function pickerRows(choices: PickerChoices): PickerRow[] {
  return [
    ...indexRows({ kind: "task", count: choices.tasks.length }),
    ...indexRows({ kind: "config", count: choices.configs.length }),
    { kind: "repeats", index: 0 },
    { kind: "timeoutMin", index: 0 },
    { kind: "sync", index: 0 },
  ];
}

/** Checks the default ids (or every task and config when none are given) and puts the cursor on the first row. */
export function initialPickerState({
  choices,
  defaults,
}: {
  choices: PickerChoices;
  defaults: PickerDefaults;
}): PickerState {
  const { taskIds, configIds } = defaults;

  return {
    tasks: choices.tasks.map((task) => !taskIds || taskIds.includes(task.id)),
    configs: choices.configs.map((config) => !configIds || configIds.includes(config.id)),
    repeats: defaults.repeats,
    timeoutMin: defaults.timeoutMin,
    sync: defaults.sync,
    cursor: 0,
    editing: false,
    notice: "",
  };
}

/** How many runs the current selection starts. */
export function runCount(state: PickerState): number {
  return countChecked(state.tasks) * countChecked(state.configs) * state.repeats;
}

/** The checked ids and settings. */
export function pickerResult({ state, choices }: { state: PickerState; choices: PickerChoices }): PickerResult {
  return {
    taskIds: choices.tasks.filter((task, index) => state.tasks[index]).map((task) => task.id),
    configIds: choices.configs.filter((config, index) => state.configs[index]).map((config) => config.id),
    repeats: state.repeats,
    timeoutMin: state.timeoutMin,
    sync: state.sync,
  };
}

/**
 * Applies one keypress. Up/down (or k/j) move, space toggles, a toggles the whole section,
 * left/right change a number or the sync box, digits type a number, enter starts, and esc, q, or ctrl-c quit.
 */
export function applyPickerKey({
  state,
  choices,
  key,
}: {
  state: PickerState;
  choices: PickerChoices;
  key: string;
}): PickerOutcome {
  const rows = pickerRows(choices);
  const row = rows[state.cursor];
  const cleared: PickerState = { ...state, notice: "" };

  if (key === "\x03" || key === "\x1b" || key === "q") {
    return { state: cleared, action: "quit" };
  }

  if (key === "\r" || key === "\n") {
    return confirm(cleared);
  }

  if (isUp(key) || key === "k") {
    return stay(moveCursor({ state: cleared, cursor: state.cursor - 1, rowCount: rows.length }));
  }

  if (isDown(key) || key === "j") {
    return stay(moveCursor({ state: cleared, cursor: state.cursor + 1, rowCount: rows.length }));
  }

  if (isHome(key)) {
    return stay(moveCursor({ state: cleared, cursor: 0, rowCount: rows.length }));
  }

  if (isEnd(key)) {
    return stay(moveCursor({ state: cleared, cursor: rows.length - 1, rowCount: rows.length }));
  }

  if (!row) {
    return stay(cleared);
  }

  if (key === " ") {
    return stay(toggleRow({ state: cleared, row }));
  }

  if (key === "a") {
    return stay(toggleSection({ state: cleared, kind: row.kind }));
  }

  if (isLeft(key) || key === "-") {
    return stay(adjust({ state: cleared, kind: row.kind, delta: -1 }));
  }

  if (isRight(key) || key === "+") {
    return stay(adjust({ state: cleared, kind: row.kind, delta: 1 }));
  }

  if (/^[0-9]$/.test(key)) {
    return stay(typeDigit({ state: cleared, kind: row.kind, digit: key }));
  }

  if (key === "\x7f" || key === "\b") {
    return stay(eraseDigit({ state: cleared, kind: row.kind }));
  }

  return stay(cleared);
}

function confirm(state: PickerState): PickerOutcome {
  const problem = selectionProblem(state);

  if (problem) {
    return { state: { ...state, notice: problem }, action: "stay" };
  }

  return { state, action: "start" };
}

function selectionProblem(state: PickerState): string | null {
  if (countChecked(state.tasks) === 0) {
    return "check at least one task";
  }

  if (countChecked(state.configs) === 0) {
    return "check at least one config";
  }

  if (state.repeats < 1) {
    return "repeats must be at least 1";
  }

  if (state.timeoutMin < 1) {
    return "timeout must be at least 1 minute";
  }

  return null;
}

function stay(state: PickerState): PickerOutcome {
  return { state, action: "stay" };
}

function moveCursor({
  state,
  cursor,
  rowCount,
}: {
  state: PickerState;
  cursor: number;
  rowCount: number;
}): PickerState {
  const clamped = Math.min(Math.max(cursor, 0), Math.max(rowCount - 1, 0));

  return { ...state, cursor: clamped, editing: false };
}

function indexRows({ kind, count }: { kind: PickerRowKind; count: number }): PickerRow[] {
  const rows: PickerRow[] = [];

  for (let index = 0; index < count; index++) {
    rows.push({ kind, index });
  }

  return rows;
}

function countChecked(checked: boolean[]): number {
  return checked.filter(Boolean).length;
}
