import type { PickerRow, PickerRowKind, PickerState } from "./picker-state.types";

const MAX_NUMBER = 999;

/** Flips the checkbox under the cursor; number rows are left alone. */
export function toggleRow({ state, row }: { state: PickerState; row: PickerRow }): PickerState {
  if (row.kind === "task") {
    return { ...state, tasks: flipAt({ checked: state.tasks, index: row.index }) };
  }

  if (row.kind === "config") {
    return { ...state, configs: flipAt({ checked: state.configs, index: row.index }) };
  }

  if (row.kind === "sync") {
    return { ...state, sync: !state.sync };
  }

  if (row.kind === "autoReview") {
    return { ...state, autoReview: !state.autoReview };
  }

  return state;
}

/** Checks or unchecks every task (or every config) at once. */
export function toggleSection({ state, kind }: { state: PickerState; kind: PickerRowKind }): PickerState {
  if (kind === "task") {
    return { ...state, tasks: flipAll(state.tasks) };
  }

  if (kind === "config") {
    return { ...state, configs: flipAll(state.configs) };
  }

  return state;
}

/**
 * Moves a number row by `delta`, staying within 1–999.
 * A positive delta checks sync or auto review; a negative one unchecks it.
 */
export function adjust({
  state,
  kind,
  delta,
}: {
  state: PickerState;
  kind: PickerRowKind;
  delta: number;
}): PickerState {
  if (kind === "repeats") {
    return { ...state, repeats: clampNumber(state.repeats + delta), editing: false };
  }

  if (kind === "timeoutMin") {
    return { ...state, timeoutMin: clampNumber(state.timeoutMin + delta), editing: false };
  }

  if (kind === "buildTimeoutMin") {
    return { ...state, buildTimeoutMin: clampNumber(state.buildTimeoutMin + delta), editing: false };
  }

  if (kind === "sync") {
    return { ...state, sync: delta > 0 };
  }

  if (kind === "autoReview") {
    return { ...state, autoReview: delta > 0 };
  }

  return state;
}

/** Types a digit on a number row. The first digit after moving onto the row replaces the value. */
export function typeDigit({
  state,
  kind,
  digit,
}: {
  state: PickerState;
  kind: PickerRowKind;
  digit: string;
}): PickerState {
  if (!isNumberRow(kind)) {
    return state;
  }

  const current = state[kind];
  const typed = state.editing ? Number(`${current}${digit}`) : Number(digit);

  return { ...state, [kind]: typed > MAX_NUMBER ? current : typed, editing: true };
}

/** Drops the last digit of a number row. It may reach 0, which the picker refuses to start with. */
export function eraseDigit({ state, kind }: { state: PickerState; kind: PickerRowKind }): PickerState {
  if (!isNumberRow(kind)) {
    return state;
  }

  return { ...state, [kind]: Math.floor(state[kind] / 10), editing: true };
}

function isNumberRow(kind: PickerRowKind): kind is "repeats" | "timeoutMin" | "buildTimeoutMin" {
  return kind === "repeats" || kind === "timeoutMin" || kind === "buildTimeoutMin";
}

function flipAt({ checked, index }: { checked: boolean[]; index: number }): boolean[] {
  return checked.map((value, position) => (position === index ? !value : value));
}

/** Unchecks everything when all are checked; otherwise checks everything. */
function flipAll(checked: boolean[]): boolean[] {
  const allChecked = checked.every(Boolean);

  return checked.map(() => !allChecked);
}

function clampNumber(value: number): number {
  return Math.min(Math.max(value, 1), MAX_NUMBER);
}
