import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pickerResult } from "../picker-state";
import type { PickerChoices, PickerDefaults, PickerState } from "../picker-state.types";
import type { SavedPicker } from "./saved-picker.types";

const MAX_NUMBER = 999;

/** The checks, settings, and cursor to write for this picker state. */
export function savedFromState({ state, choices }: { state: PickerState; choices: PickerChoices }): SavedPicker {
  return { ...pickerResult({ state, choices }), cursor: state.cursor };
}

/**
 * Starting values from a saved selection. Ids that are no longer in `choices` are dropped, so a new
 * task or config stays unchecked until it is picked.
 */
export function defaultsFromSaved({ saved, choices }: { saved: SavedPicker; choices: PickerChoices }): PickerDefaults {
  return {
    taskIds: knownIds({
      savedIds: saved.taskIds,
      offered: choices.tasks.map((task) => task.id),
    }),
    configIds: knownIds({
      savedIds: saved.configIds,
      offered: choices.configs.map((config) => config.id),
    }),
    repeats: saved.repeats,
    timeoutMin: saved.timeoutMin,
    buildTimeoutMin: saved.buildTimeoutMin,
    sync: saved.sync,
    autoReview: saved.autoReview,
    cursor: saved.cursor,
  };
}

/** Reads the saved selection. A missing or damaged file returns null so the command defaults are used. */
export function readSavedPicker(path: string): SavedPicker | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return parseSavedPicker(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    // A damaged preference file must not stop the TUI.
    return null;
  }
}

/** Writes the selection, creating `data/` when this is the first thing stored there. */
export function writeSavedPicker({ path, saved }: { path: string; saved: SavedPicker }): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(saved, null, 2)}\n`);
}

function parseSavedPicker(value: unknown): SavedPicker | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const taskIds = stringList(record.taskIds);
  const configIds = stringList(record.configIds);
  const repeats = wholeNumber(record.repeats);
  const timeoutMin = wholeNumber(record.timeoutMin);
  const buildTimeoutMin = wholeNumber(record.buildTimeoutMin);
  const cursor = cursorIndex(record.cursor);

  if (
    !taskIds ||
    !configIds ||
    repeats === null ||
    timeoutMin === null ||
    buildTimeoutMin === null ||
    cursor === null
  ) {
    return null;
  }

  if (typeof record.sync !== "boolean" || typeof record.autoReview !== "boolean") {
    return null;
  }

  return {
    taskIds,
    configIds,
    repeats,
    timeoutMin,
    buildTimeoutMin,
    sync: record.sync,
    autoReview: record.autoReview,
    cursor,
  };
}

/** Ids still offered. An empty save stays empty; a save whose ids all disappeared means check everything. */
function knownIds({ savedIds, offered }: { savedIds: string[]; offered: string[] }): string[] | undefined {
  const known = savedIds.filter((id) => offered.includes(id));

  if (savedIds.length > 0 && known.length === 0) {
    return undefined;
  }

  return known;
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }

  return value;
}

function wholeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > MAX_NUMBER) {
    return null;
  }

  return value;
}

function cursorIndex(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
}
