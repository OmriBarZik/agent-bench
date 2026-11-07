import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PickerChoices, PickerState } from "../picker-state.types";
import { defaultsFromSaved, readSavedPicker, savedFromState, writeSavedPicker } from "./saved-picker";
import type { SavedPicker } from "./saved-picker.types";

const CHOICES: PickerChoices = {
  tasks: [
    { id: "t1", detail: "first" },
    { id: "t2", detail: "second" },
  ],
  configs: [{ id: "baseline", detail: "" }],
};

const SAVED: SavedPicker = {
  taskIds: ["t2", "gone"],
  configIds: ["baseline"],
  repeats: 3,
  timeoutMin: 45,
  buildTimeoutMin: 20,
  sync: true,
  autoReview: false,
  cursor: 4,
};

describe("saved picker", () => {
  test("round-trips the selection", () => {
    const directory = mkdtempSync(join(tmpdir(), "picker-"));
    const path = join(directory, "start-picker.json");

    try {
      writeSavedPicker({ path, saved: SAVED });

      expect(readSavedPicker(path)).toEqual(SAVED);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("a missing or damaged file is ignored", () => {
    const directory = mkdtempSync(join(tmpdir(), "picker-"));
    const path = join(directory, "start-picker.json");

    try {
      expect(readSavedPicker(path)).toBeNull();
      writeFileSync(path, "{");

      expect(readSavedPicker(path)).toBeNull();
      writeFileSync(path, JSON.stringify({ taskIds: ["t1"] }));

      expect(readSavedPicker(path)).toBeNull();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("drops ids that are no longer offered", () => {
    expect(defaultsFromSaved({ saved: SAVED, choices: CHOICES }).taskIds).toEqual(["t2"]);
  });

  test("checks everything when every saved id is gone, and keeps an empty selection empty", () => {
    expect(defaultsFromSaved({ saved: { ...SAVED, taskIds: ["gone"] }, choices: CHOICES }).taskIds).toBeUndefined();
    expect(defaultsFromSaved({ saved: { ...SAVED, taskIds: [] }, choices: CHOICES }).taskIds).toEqual([]);
  });

  test("saves the checked ids and the cursor", () => {
    const state: PickerState = {
      tasks: [false, true],
      configs: [true],
      repeats: 2,
      timeoutMin: 60,
      buildTimeoutMin: 90,
      sync: false,
      autoReview: true,
      cursor: 1,
      editing: false,
      notice: "",
    };

    expect(savedFromState({ state, choices: CHOICES })).toMatchObject({
      taskIds: ["t2"],
      configIds: ["baseline"],
      cursor: 1,
    });
  });
});
